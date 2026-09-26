import { read, write } from "./store.js";

// Keeps the current round across refreshes, and keeps the screen awake
// while a round is on the table.

export function loadSession(gameId) {
  const raw = read(`${gameId}.session`, null);
  if (!raw || typeof raw !== "object") return null;
  return {
    screen: raw.screen === "play" ? "play" : "setup",
    starter: raw.starter === 1 ? 1 : 0,
    moves: Array.isArray(raw.moves) ? raw.moves.filter(Number.isInteger) : [],
  };
}

export function saveSession(gameId, session) {
  write(`${gameId}.session`, session);
}

let sentinel = null;
let wanted = false;

async function acquire() {
  if (!wanted || sentinel || document.visibilityState !== "visible") return;
  try {
    sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => {
      sentinel = null;
    });
  } catch {
    sentinel = null;
  }
}

export function keepAwake(on) {
  if (!("wakeLock" in navigator)) return;
  wanted = on;
  if (on) acquire();
  else if (sentinel) {
    sentinel.release().catch(() => {});
    sentinel = null;
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") acquire();
  });
}
