import { getSettings } from "./store.js";

// Haptic taps. Android and friends get navigator.vibrate. iPhone Safari has
// no vibrate API, but since iOS 18 toggling a native <input switch> plays a
// system haptic, so we click a hidden one. Anywhere else this does nothing.

const PATTERNS = {
  tap: [8],
  land: [14],
  undo: [10],
  invalid: [12, 50, 12],
  win: [18, 70, 18, 70, 36],
  draw: [16, 90, 16],
};

const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

const isAppleTouch =
  typeof navigator !== "undefined" &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export const hapticsSupported = canVibrate || isAppleTouch;

function switchTick() {
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  label.remove();
}

export function haptic(name = "tap") {
  if (!hapticsSupported || getSettings().haptics === false) return;
  const pattern = PATTERNS[name] || PATTERNS.tap;
  try {
    if (canVibrate) {
      navigator.vibrate(pattern);
      return;
    }
    // One switch tick per pulse. Only the first is guaranteed to land, since
    // iOS wants each tick inside a user gesture; the rest are a bonus.
    for (let i = 0; i < pattern.length; i += 2) {
      const at = pattern.slice(0, i).reduce((sum, ms) => sum + ms, 0);
      if (at === 0) switchTick();
      else setTimeout(switchTick, at);
    }
  } catch {
    /* ignore */
  }
}
