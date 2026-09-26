// Checks that the site installs and works offline, in headless Chromium.
//
//   npx -y -p playwright node scripts/check-pwa.mjs [--base=/playground/]
//
// Serves the repo from a subpath on localhost, then checks that:
// - the precache list in sw.js is current
// - Chrome parses the manifest and finds the site installable, and every icon
//   loads at its declared size
// - every page links the manifest, the apple-touch-icon and js/pwa.js
// - the service worker registers, takes control and precaches every file, and
//   the first page's Google Fonts are cached
// - with the network cut, the hub and every game load and reload from the
//   cache, render, and get every file they request
//
// The browser goes through a local proxy that is switched off for the offline
// part, because Chromium's offline emulation misses service worker requests.

import { execFileSync } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { connect } from "node:net";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchPersistentChromium } from "./playwright.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseArg = process.argv.find((arg) => arg.startsWith("--base="))?.slice(7);
const trimmed = (baseArg ?? "playground").replace(/^\/+|\/+$/g, "");
const BASE = trimmed ? `/${trimmed}/` : "/";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function listen(server) {
  const sockets = new Set();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () =>
      resolve({
        port: server.address().port,
        dropConnections: () => sockets.forEach((socket) => socket.destroy()),
        stop: () =>
          new Promise((done) => {
            sockets.forEach((socket) => socket.destroy());
            server.close(() => done());
          }),
      }),
    );
  });
}

function startSiteServer() {
  return listen(
    createServer(async (req, res) => {
      const { pathname } = new URL(req.url, "http://localhost");
      try {
        if (!pathname.startsWith(BASE)) throw new Error("outside base");
        let file = path.join(root, decodeURIComponent(pathname.slice(BASE.length)));
        if (file !== root && !file.startsWith(root + path.sep)) throw new Error("outside root");
        if ((await stat(file)).isDirectory()) {
          if (!pathname.endsWith("/")) {
            res.writeHead(301, { location: `${pathname}/` }).end();
            return;
          }
          file = path.join(file, "index.html");
        }
        const body = await readFile(file);
        res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404).end();
      }
    }),
  );
}

// Forwards everything while online; once offline, drops every connection.
async function startProxy() {
  let online = true;
  const server = createServer((req, res) => {
    if (!online) return void req.socket.destroy();
    const url = new URL(req.url);
    const upstream = httpRequest(
      { host: url.hostname, port: url.port || 80, path: url.pathname + url.search, method: req.method, headers: req.headers },
      (response) => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      },
    );
    upstream.on("error", () => res.destroy());
    req.pipe(upstream);
  });
  server.on("connect", (req, socket, head) => {
    if (!online) return void socket.destroy();
    const [host, port] = req.url.split(":");
    const upstream = connect(Number(port) || 443, host, () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
    socket.on("close", () => upstream.destroy());
  });
  const proxy = await listen(server);
  proxy.goOffline = () => {
    online = false;
    proxy.dropConnections();
  };
  return proxy;
}

const failures = [];
function check(ok, label, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures.push(label);
}

async function poll(fn, timeout = 5000) {
  const start = Date.now();
  let value = await fn();
  while (!value && Date.now() - start < timeout) {
    await new Promise((r) => setTimeout(r, 100));
    value = await fn();
  }
  return value;
}

let precacheCurrent = true;
try {
  execFileSync(process.execPath, [path.join(root, "scripts", "gen-precache.mjs"), "--check"], {
    stdio: "pipe",
  });
} catch {
  precacheCurrent = false;
}
check(precacheCurrent, "sw.js precache list is current", precacheCurrent ? "" : "run node scripts/gen-precache.mjs");

const swSource = await readFile(path.join(root, "sw.js"), "utf8");
const precacheUrls = JSON.parse(swSource.match(/const PRECACHE_URLS = (\[[\s\S]*?\]);/)[1]);
const pages = precacheUrls
  .filter((file) => file === "index.html" || file.endsWith("/index.html"))
  .map((file) => file.slice(0, -"index.html".length))
  .sort((a, b) => (a === "" ? -1 : b === "" ? 1 : 0));
const pageName = (page) => (page ? page.slice(0, -1) : "hub");

const server = await startSiteServer();
const proxy = await startProxy();
const site = `http://127.0.0.1:${server.port}${BASE}`;
const manifestUrl = `${site}manifest.webmanifest`;
console.log(`Serving the repo at ${site}\n`);

// A persistent profile, because Chrome never reports incognito as installable.
const profile = await mkdtemp(path.join(os.tmpdir(), "playground-pwa-"));
const context = await launchPersistentChromium(profile, {
  proxy: { server: `http://127.0.0.1:${proxy.port}` },
});
const page = context.pages()[0] ?? (await context.newPage());
const cdp = await context.newCDPSession(page);
const pageErrors = [];
const badRequests = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("requestfailed", (request) => {
  if (request.url().startsWith(site)) badRequests.push(`failed ${request.url()}`);
});
page.on("response", (response) => {
  if (response.url().startsWith(site) && response.status() >= 400) {
    badRequests.push(`${response.status()} ${response.url()}`);
  }
});

try {
  // First visit: service worker, precache, fonts.
  await page.goto(site);
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
  const worker = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, script: reg.active.scriptURL };
  });
  check(
    worker.scope === site && worker.script === `${site}sw.js`,
    "service worker registers for the whole site and controls the page",
    `scope ${worker.scope}`,
  );
  const cachedUrls = () =>
    page.evaluate(async () => {
      const urls = [];
      for (const name of await caches.keys()) {
        for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
      }
      return urls;
    });
  const precached = await cachedUrls();
  const missing = precacheUrls.filter((file) => !precached.includes(new URL(file, site).href));
  check(missing.length === 0, `service worker precached all ${precacheUrls.length} files`, missing.join(", "));
  const firstFonts = await poll(async () =>
    (await cachedUrls()).filter((url) => url.startsWith("https://fonts.gstatic.com/")).length,
  );
  check(firstFonts > 0, "the first page's Google Fonts are cached", `${firstFonts} font files`);

  // Manifest and icons.
  const appManifest = await cdp.send("Page.getAppManifest");
  check(appManifest.url === manifestUrl, "the hub links the manifest", appManifest.url);
  check(
    appManifest.errors.length === 0,
    "Chrome parses the manifest without errors",
    appManifest.errors.map((error) => error.message).join("; "),
  );
  const manifest = JSON.parse(appManifest.data);
  const resolve = (value) => new URL(value, manifestUrl).href;
  check(Boolean(manifest.name && manifest.short_name), "manifest has a name and short_name");
  check(resolve(manifest.start_url) === site, "manifest start_url opens the hub", manifest.start_url);
  check(resolve(manifest.scope) === site, "manifest scope covers the whole site", manifest.scope);
  check(manifest.display === "standalone", "manifest display is standalone");

  const icons = (manifest.icons ?? []).map((icon) => ({ ...icon, url: resolve(icon.src) }));
  const hasIcon = (size, purpose) =>
    icons.some(
      (icon) =>
        icon.sizes === `${size}x${size}` &&
        icon.type === "image/png" &&
        (icon.purpose ?? "any").split(" ").includes(purpose),
    );
  check(hasIcon(192, "any") && hasIcon(512, "any"), "manifest has 192 and 512 PNG icons");
  check(hasIcon(512, "maskable"), "manifest has a maskable 512 PNG icon");

  const touchIcon = await page.evaluate(
    () => document.querySelector('link[rel="apple-touch-icon"]')?.href,
  );
  const toInspect = [
    ...icons.map((icon) => ({ ...icon, opaque: icon.purpose === "maskable" })),
    { url: touchIcon, sizes: "180x180", opaque: true },
  ];
  for (const icon of toInspect) {
    const image = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let opaque = true;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 255) {
          opaque = false;
          break;
        }
      }
      return { size: `${img.naturalWidth}x${img.naturalHeight}`, opaque };
    }, icon.url);
    const name = icon.url.slice(site.length);
    check(image.size === icon.sizes, `${name} is ${icon.sizes}`);
    if (icon.opaque) check(image.opaque, `${name} is fully opaque`);
  }

  // Every page: install tags and installability. Visiting also caches fonts.
  for (const pagePath of pages) {
    await page.goto(site + pagePath, { waitUntil: "networkidle" });
    const tags = await page.evaluate(() => {
      const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content;
      return {
        manifest: document.querySelector('link[rel="manifest"]')?.href,
        touchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.href,
        scripts: [...document.querySelectorAll('script[type="module"]')].map((s) => s.src),
        capable: meta("apple-mobile-web-app-capable"),
        mobileCapable: meta("mobile-web-app-capable"),
        title: meta("apple-mobile-web-app-title"),
        statusBar: meta("apple-mobile-web-app-status-bar-style"),
      };
    });
    const missingTags = [
      tags.manifest !== manifestUrl && "manifest",
      tags.touchIcon !== `${site}icons/icon-180.png` && "apple-touch-icon",
      !tags.scripts.includes(`${site}js/pwa.js`) && "js/pwa.js",
      tags.capable !== "yes" && "apple-mobile-web-app-capable",
      tags.mobileCapable !== "yes" && "mobile-web-app-capable",
      !tags.title && "apple-mobile-web-app-title",
      !tags.statusBar && "apple-mobile-web-app-status-bar-style",
    ].filter(Boolean);
    check(missingTags.length === 0, `${pageName(pagePath)} has the install tags`, missingTags.join(", "));
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    check(
      installabilityErrors.length === 0,
      `Chrome can install the site from ${pageName(pagePath)}`,
      installabilityErrors.map((error) => error.errorId).join(", "),
    );
  }

  // Offline: server stopped, proxy cut, browser offline.
  await server.stop();
  proxy.goOffline();
  await context.setOffline(true);
  for (const pagePath of pages) {
    for (const how of ["opens", "reloads"]) {
      pageErrors.length = 0;
      badRequests.length = 0;
      const response =
        how === "opens"
          ? await page.goto(site + pagePath, { waitUntil: "load" })
          : await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(400);
      const state = await page.evaluate(async () => {
        await document.fonts.ready;
        return {
          text: document.body.innerText.trim().length,
          fonts: [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family))],
        };
      });
      const problems = [
        !response?.ok() && `status ${response?.status()}`,
        response && !response.fromServiceWorker() && "not served by the service worker",
        state.text < 20 && "page is blank",
        ...pageErrors,
        ...badRequests,
      ].filter(Boolean);
      const fonts = state.fonts.length ? `fonts: ${state.fonts.join(", ")}` : "system fonts";
      check(
        problems.length === 0,
        `${pageName(pagePath)} ${how} offline`,
        problems.length ? problems.join("; ") : fonts,
      );
    }
  }
} finally {
  await context.close();
  await server.stop();
  await proxy.stop();
  await rm(profile, { recursive: true, force: true });
}

console.log(failures.length ? `\n${failures.length} check(s) failed.` : "\nAll checks passed.");
process.exit(failures.length ? 1 : 0);
