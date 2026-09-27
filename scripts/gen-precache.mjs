// Rebuilds the precache list in sw.js from the files in this repo.
//
//   node scripts/gen-precache.mjs          rewrite the list in sw.js
//   node scripts/gen-precache.mjs --check  exit 1 if sw.js is out of date
//
// Every web asset in the repo is listed, so a new game folder is picked up
// without touching this script. Skipped: dotfiles and dot-folders (.git),
// node_modules, scripts/ and test folders, *.test.* and *.spec.* files, docs
// such as READMEs, package.json, package-lock.json, and sw.js itself.
//
// The version is a hash of every listed file, so any change to the site gives
// sw.js new bytes, which is what makes browsers install the update.

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const swPath = path.join(root, "sw.js");

const ASSET_EXTENSIONS = new Set([
  ".html", ".css", ".js", ".mjs", ".json", ".webmanifest", ".txt",
  ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico",
  ".woff", ".woff2", ".ttf", ".otf",
  ".mp3", ".m4a", ".ogg", ".wav",
]);
const SKIP_DIRS = new Set([
  "node_modules", "scripts", "test", "tests", "__tests__",
  "test-results", "playwright-report",
]);
const SKIP_FILES = new Set(["package.json", "package-lock.json"]);
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]s$/;

function isAsset(relPath, name) {
  if (relPath === "sw.js" || SKIP_FILES.has(name) || TEST_FILE.test(name)) return false;
  return ASSET_EXTENSIONS.has(path.extname(name).toLowerCase());
}

async function collect(dir, rel = "") {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...(await collect(path.join(dir, entry.name), relPath)));
      }
    } else if (entry.isFile() && isAsset(relPath, entry.name)) {
      files.push(relPath);
    }
  }
  return files;
}

const files = (await collect(root)).sort();
const hash = createHash("sha256");
for (const file of files) {
  hash.update(file).update("\0");
  hash.update(await readFile(path.join(root, file))).update("\0");
}
const version = hash.digest("hex").slice(0, 12);

const block = [
  "// <precache>",
  `const PRECACHE_VERSION = ${JSON.stringify(version)};`,
  `const PRECACHE_URLS = ${JSON.stringify(files, null, 2)};`,
  "// </precache>",
].join("\n");

const MARKERS = /\/\/ <precache>[\s\S]*?\/\/ <\/precache>/;
const current = await readFile(swPath, "utf8");
if (!MARKERS.test(current)) {
  console.error("sw.js is missing the // <precache> ... // </precache> markers.");
  process.exit(1);
}
const next = current.replace(MARKERS, block);

if (process.argv.includes("--check")) {
  if (next !== current) {
    console.error("sw.js precache list is out of date. Run: node scripts/gen-precache.mjs");
    process.exit(1);
  }
  console.log(`sw.js is up to date: ${files.length} files, version ${version}.`);
} else if (next === current) {
  console.log(`sw.js already up to date: ${files.length} files, version ${version}.`);
} else {
  await writeFile(swPath, next);
  console.log(`sw.js updated: ${files.length} files, version ${version}.`);
}
