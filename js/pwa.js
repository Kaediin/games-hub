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
    if (!replaced) return;
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
