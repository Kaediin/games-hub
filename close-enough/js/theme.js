import { state } from "./state.js";

const root = document.documentElement;

function applyTheme(theme) {
  root.dataset.theme = theme;
  const btn = document.getElementById("btn-theme");
  if (!btn) return;
  const lightIcon = btn.querySelector(".ico-theme-light");
  const darkIcon = btn.querySelector(".ico-theme-dark");
  const effective =
    theme === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  lightIcon.classList.toggle("hidden", effective === "light");
  darkIcon.classList.toggle("hidden", effective === "dark");
  btn.title = `Theme: ${theme}`;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = effective === "dark" ? "#121c1a" : "#e4572e";
}

export function initTheme() {
  const settings = state.getSettings();
  applyTheme(settings.theme || "system");

  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", () => {
    if (state.getSettings().theme === "system") applyTheme("system");
  });

  const btn = document.getElementById("btn-theme");
  btn?.addEventListener("click", () => {
    const cur = state.getSettings().theme || "system";
    const next = cur === "system" ? "light" : cur === "light" ? "dark" : "system";
    state.saveSettings({ theme: next });
    applyTheme(next);
  });
}
