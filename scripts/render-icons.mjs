// Renders icons/icon.svg into the PNGs used by the manifest and iOS.
//
//   npx -y -p playwright node scripts/render-icons.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./playwright.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "icons");

const TARGETS = [
  { file: "icon-180.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
];

// Launchers may crop maskable icons to a circle 80% of the canvas wide, so the
// art is shrunk into that safe zone while the background stays full-bleed.
const MASKABLE_SCALE = 0.8;

function toMaskable(svg) {
  const open = '<g id="art">';
  const viewBox = svg.match(/viewBox="([\d.\s-]+)"/);
  if (!svg.includes(open) || !viewBox) {
    throw new Error(`icons/icon.svg needs a viewBox and a ${open} group`);
  }
  const [x, y, w, h] = viewBox[1].trim().split(/\s+/).map(Number);
  const cx = x + w / 2;
  const cy = y + h / 2;
  return svg.replace(
    open,
    `<g id="art" transform="translate(${cx} ${cy}) scale(${MASKABLE_SCALE}) translate(${-cx} ${-cy})">`,
  );
}

const svg = await readFile(path.join(iconsDir, "icon.svg"), "utf8");
const browser = await launchChromium();
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const { file, size, maskable } of TARGETS) {
  const source = maskable ? toMaskable(svg) : svg;
  const src = `data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><style>html,body{margin:0}img{display:block}</style>` +
      `<img width="${size}" height="${size}" src="${src}">`,
  );
  await page.locator("img").evaluate((img) => img.decode());
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
  await writeFile(path.join(iconsDir, file), png);
  console.log(`icons/${file} (${size}x${size})`);
}

await browser.close();
