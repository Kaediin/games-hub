import { state } from "./state.js";
import { remainingSecs } from "./game.js";
import { sound } from "./sound.js";

let intervalId = null;
let onExpire = null;
let onTick = null;
let lastUrgentSec = null;

function chip() {
  return document.getElementById("timer-chip");
}

function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.max(0, secs % 60);
  if (m <= 0) return String(s);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function show(secs) {
  const c = chip();
  if (!c) return;
  c.classList.remove("hidden");
  c.textContent = fmt(secs);
  c.classList.toggle("urgent", secs <= 5 && secs > 0);
}

function hide() {
  const c = chip();
  if (!c) return;
  c.classList.add("hidden");
  c.classList.remove("urgent");
  c.textContent = "";
}

function tickOnce() {
  const game = state.getGame();
  const timer = game?.round?.timer;
  if (!timer || game.round.phase !== "playing") {
    stop();
    hide();
    return;
  }
  const secs = remainingSecs(timer);
  show(secs);
  onTick?.(secs);
  if (secs > 0 && secs <= 5 && !timer.paused && lastUrgentSec !== secs) {
    lastUrgentSec = secs;
    sound.play("tick");
  }
  if (secs <= 0 && !timer.paused) {
    lastUrgentSec = null;
    stop();
    hide();
    onExpire?.();
  }
}

export const timer = {
  init({ onExpire: cb, onTick: tickCb } = {}) {
    onExpire = cb || null;
    onTick = tickCb || null;
    this.refresh();
  },
  refresh() {
    const game = state.getGame();
    stop();
    lastUrgentSec = null;
    if (!game?.round?.timer || game.round.phase !== "playing") {
      hide();
      return;
    }
    tickOnce();
    intervalId = setInterval(tickOnce, 200);
  },
  stop() {
    stop();
    hide();
  },
};

function stop() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}
