// Tiny localStorage wrapper shared by the two-player games. Every key is
// namespaced so the duel games never collide with the other cabinets, and
// every call is safe when storage is missing (private mode, Node tests).

const PREFIX = "playground.duel.";

export function read(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}

export function remove(key) {
  try {
    globalThis.localStorage?.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

const DEFAULT_SETTINGS = {
  theme: "system",
  sound: true,
  haptics: true,
  tabletop: false,
};

export function getSettings() {
  const saved = read("settings", {});
  return { ...DEFAULT_SETTINGS, ...(saved && typeof saved === "object" ? saved : {}) };
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  write("settings", next);
  return next;
}
