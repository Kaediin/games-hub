// Registers the site-wide service worker. Every page loads this file, from the
// hub or a game folder, so paths resolve from here rather than from the page.

const SW_URL = new URL("../sw.js", import.meta.url);
const SCOPE = new URL("../", import.meta.url);

if ("serviceWorker" in navigator) {
  const sw = navigator.serviceWorker;
  let registration = null;
  let controller = sw.controller;
  let updated = false;

  // A new version takes over as soon as it is installed. A page that was
  // already open keeps running the old code, so it reloads the next time it is
  // hidden rather than under someone's fingers mid-game.
  sw.addEventListener("controllerchange", () => {
    const replaced = controller !== null;
    controller = sw.controller;
    if (!replaced) {
      cacheFontsInUse();
      return;
    }
    updated = true;
    if (document.visibilityState === "hidden") location.reload();
  });

  // Home-screen apps can stay open for days, so check for a new version each
  // time the app comes back to the foreground.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (updated) location.reload();
    } else if (registration) {
      registration.update().catch(() => {});
    }
  });

  const register = () =>
    sw
      .register(SW_URL, { scope: SCOPE.href, updateViaCache: "none" })
      .then((reg) => {
        registration = reg;
      })
      .catch((error) => console.warn("Service worker registration failed:", error));

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

// A page that loaded before the service worker controlled it fetched its Google
// Fonts past the worker. Fetch them again through it so they work offline: each
// stylesheet, then its Latin font files, the subset these pages render. Pages
// can't see which font files the browser picked, so the CSS is read instead.
async function cacheFontsInUse() {
  const sheets = document.querySelectorAll(
    'link[rel="stylesheet"][href^="https://fonts.googleapis.com/"]',
  );
  for (const { href } of sheets) {
    try {
      const css = await (await fetch(href, { mode: "cors" })).text();
      const files = new Set();
      for (const [, rules] of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
        const src = rules.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];
        if (src && coversLatin(rules)) files.add(src);
      }
      await Promise.all([...files].map((src) => fetch(src).catch(() => {})));
    } catch {}
  }
}

function coversLatin(rules) {
  const ranges = rules.match(/unicode-range:\s*([^;]+)/)?.[1];
  if (!ranges) return true;
  return ranges.split(",").some((range) => {
    const [start, end = start] = range.trim().replace(/^U\+/i, "").split("-");
    return parseInt(start, 16) <= 0x41 && parseInt(end, 16) >= 0x41;
  });
}
