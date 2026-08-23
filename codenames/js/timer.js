import { state } from "./state.js";
import { sound } from "./sound.js";

let intervalId = null;
let onExpire = null;

function chip() {
  return document.getElementById("timer-chip");
}

function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.max(0, secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function remainingSecs(timer) {
  if (!timer) return 0;
  if (timer.paused) return Math.max(0, Math.floor(timer.remainingSec || 0));
  return Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
}

function show(team, secs) {
  const c = chip();
  if (!c) return;
  c.classList.remove("hidden");
  c.dataset.team = team || "";
  c.textContent = `⏱ ${fmt(secs)}`;
  c.classList.toggle("urgent", secs <= 5 && secs > 0);
}

function hide() {
  const c = chip();
  if (!c) return;
  c.classList.add("hidden");
  c.classList.remove("urgent");
  c.removeAttribute("data-team");
  c.textContent = "";
}

function tickOnce() {
  const game = state.getGame();
  if (!game?.timer) {
    stop();
    return;
  }
  const secs = remainingSecs(game.timer);
  show(game.currentTeam, secs);
  if (secs > 0 && secs <= 5 && !game.timer.paused) sound.play("tick");
  if (secs <= 0 && !game.timer.paused) {
    sound.play("timeUp");
    onExpire?.();
  }
}

export const timer = {
  init({ onExpire: cb }) {
    onExpire = cb;
    chip()?.addEventListener("click", () => {
      this.togglePause();
    });
    this.refresh();
  },
  start(durationSec) {
    const game = state.getGame();
    if (!game) return;
    game.timer = {
      durationSec,
      endsAt: Date.now() + durationSec * 1000,
      paused: false,
    };
    state.saveGame(game);
    this.refresh();
  },
  cancel() {
    const game = state.getGame();
    if (!game) return;
    game.timer = null;
    state.saveGame(game);
    stop();
  },
  togglePause() {
    const game = state.getGame();
    if (!game?.timer) return;
    if (game.timer.paused) {
      game.timer.endsAt = Date.now() + game.timer.remainingSec * 1000;
      game.timer.paused = false;
      delete game.timer.remainingSec;
    } else {
      game.timer.remainingSec = remainingSecs(game.timer);
      game.timer.paused = true;
    }
    state.saveGame(game);
    this.refresh();
  },
  refresh() {
    const game = state.getGame();
    stop();
    if (!game?.timer || game.over) {
      hide();
      return;
    }
    tickOnce();
    intervalId = setInterval(tickOnce, 250);
  },
};

function stop() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}
