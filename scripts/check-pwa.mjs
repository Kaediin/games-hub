// Checks that the site installs and works offline, in headless Chromium.
//
//   npx -y -p playwright node scripts/check-pwa.mjs [--base=/playground/]
//
// Serves the repo from a subpath on localhost, then checks that:
// - the precache list in sw.js is current
// - the manifest has what installing needs and every icon loads at its size
// - every page links the manifest, the apple-touch-icon and js/pwa.js
// - the service worker registers, takes control and precaches every file
// - with the server stopped and the browser offline, the hub and every game
//   load and reload from the cache, render, and get every file they request

import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./playwright.mjs";

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

function startServer() {
  const sockets = new Set();
  const server = createServer(async (req, res) => {
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
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () =>
      resolve({
        port: server.address().port,
        stop: () =>
          new Promise((done) => {
            for (const socket of sockets) socket.destroy();
            server.close(done);
          }),
      }),
    );
  });
}

const failures = [];
function check(ok, label, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures.push(label);
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

const server = await startServer();
const origin = `http://127.0.0.1:${server.port}`;
const site = `${origin}${BASE}`;
const manifestUrl = `${site}manifest.webmanifest`;
console.log(`Serving the repo at ${site}\n`);

const browser = await launchChromium();
const context = await browser.newContext();
const page = await context.newPage();
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
  // Manifest and icons.
  await page.goto(site);
  const manifest = await page.evaluate(async (url) => (await fetch(url)).json(), manifestUrl);
  const resolve = (value) => new URL(value, manifestUrl).href;
  check(Boolean(manifest.name && manifest.short_name), "manifest has a name and short_name");
  check(resolve(manifest.start_url) === site, "manifest start_url opens the hub", manifest.start_url);
  check(resolve(manifest.scope) === site, "manifest scope covers the whole site", manifest.scope);
  check(manifest.display === "standalone", "manifest display is standalone");
  check(Boolean(manifest.theme_color && manifest.background_color), "manifest has theme and background colours");

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
    check(image.size === icon.sizes, `${name} is ${icon.sizes}`, image.size);
    if (icon.opaque) check(image.opaque, `${name} is fully opaque`);
  }

  // Service worker.
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
  const worker = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, script: reg.active.scriptURL, state: reg.active.state };
  });
  check(
    worker.scope === site && worker.script === `${site}sw.js` && worker.state === "activated",
    "service worker registers for the whole site and controls the page",
    `${worker.script}, scope ${worker.scope}`,
  );
  const cached = await page.evaluate(async () => {
    const name = (await caches.keys()).find((key) => key.startsWith("playground-precache-"));
    return name ? (await (await caches.open(name)).keys()).map((request) => request.url) : [];
  });
  const missing = precacheUrls.filter((file) => !cached.includes(new URL(file, site).href));
  check(missing.length === 0, `service worker precached all ${precacheUrls.length} files`, missing.join(", "));

  // One online visit to every page: install tags, and fonts get cached.
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
  }

  // Offline: no server, no network.
  await server.stop();
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
  await browser.close();
  await server.stop();
}

console.log(failures.length ? `\n${failures.length} check(s) failed.` : "\nAll checks passed.");
process.exit(failures.length ? 1 : 0);
