import { getSettings, saveSettings } from "./store.js";

// Light, dark or system. One setting shared by both duel games. The page
// head sets data-theme before first paint; this keeps it in sync after.

const THEME_COLORS = { dark: "#1a1410", light: "#f6ecda" };
const listeners = new Set();
const mq = window.matchMedia("(prefers-color-scheme: dark)");

export function effectiveTheme(mode = getSettings().theme) {
  if (mode === "light" || mode === "dark") return mode;
  return mq.matches ? "dark" : "light";
}

function apply(mode) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  const effective = effectiveTheme(mode);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLORS[effective];
  listeners.forEach((fn) => fn(mode, effective));
}

export function initTheme() {
  apply(getSettings().theme);
  mq.addEventListener?.("change", () => {
    if (getSettings().theme === "system") apply("system");
  });
}

export function setTheme(mode) {
  saveSettings({ theme: mode });
  apply(mode);
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
