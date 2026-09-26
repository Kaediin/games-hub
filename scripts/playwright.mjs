// Finds Playwright without making it a dependency of this repo: a local
// install, the package an `npx -p playwright` run put on PATH, or a global one.

import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import path from "node:path";

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {}
  const dirs = (process.env.PATH || "")
    .split(path.delimiter)
    .filter((dir) => dir.endsWith(path.join("node_modules", ".bin")))
    .map((dir) => path.dirname(dir));
  try {
    dirs.push(execSync("npm root -g", { encoding: "utf8" }).trim());
  } catch {}
  for (const dir of dirs) {
    try {
      return createRequire(path.join(dir, "noop.js"))("playwright");
    } catch {}
  }
  const script = path.relative(process.cwd(), process.argv[1]);
  throw new Error(`Playwright not found. Run: npx -y -p playwright node ${script}`);
}

// Uses Playwright's own Chromium when installed, otherwise a local Google Chrome.
async function withChromeFallback(launch) {
  const { chromium } = await loadPlaywright();
  try {
    return await launch(chromium, {});
  } catch (bundledError) {
    try {
      return await launch(chromium, { channel: "chrome" });
    } catch {
      throw bundledError;
    }
  }
}

export function launchChromium(options = {}) {
  return withChromeFallback((chromium, extra) => chromium.launch({ ...options, ...extra }));
}

export function launchPersistentChromium(userDataDir, options = {}) {
  return withChromeFallback((chromium, extra) =>
    chromium.launchPersistentContext(userDataDir, { ...options, ...extra }),
  );
}
