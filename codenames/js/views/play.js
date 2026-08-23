import { template, el, confirmAction, toast } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";
import { revealTile, endTurnManually, encodeKeyPayload } from "../game.js";
import { sound } from "../sound.js";
import { timer } from "../timer.js";
import { openInfoModal, closeInfoModal } from "../infoModal.js";

const SOUND_BY_OUTCOME = {
  team: "revealTeam",
  neutral: "revealNeutral",
  wrong: "revealOther",
  assassin: "assassin",
};

export function renderPlay(root) {
  const game = state.getGame();
  if (!game) {
    toast("No game in progress");
    navigate("home");
    return;
  }

  root.appendChild(template("tpl-play"));
  const board = root.querySelector("#board");
  const turnEl = root.querySelector("#turn-indicator");
  const scoreRed = root.querySelector("#score-red");
  const scoreBlue = root.querySelector("#score-blue");
  const spyRed = root.querySelector("#spymaster-red");
  const spyBlue = root.querySelector("#spymaster-blue");
  const popover = document.getElementById("timer-popover");

  spyRed.textContent = game.spymasters.red ? `★ ${game.spymasters.red}` : "";
  spyBlue.textContent = game.spymasters.blue ? `★ ${game.spymasters.blue}` : "";

  function rebuildBoard() {
    board.innerHTML = "";
    game.tiles.forEach((tile, i) => {
      const classes = ["tile"];
      if (tile.revealed) {
        classes.push("revealed");
        classes.push(tile.color);
      }
      const node = el(
        "button",
        {
          class: classes.join(" "),
          type: "button",
          "aria-label": tile.revealed ? `${tile.word} (${tile.color})` : tile.word,
          disabled: tile.revealed || game.over,
          onclick: () => onTileClick(i),
        },
        tile.word
      );
      board.appendChild(node);
    });
  }

  function refreshScores() {
    scoreRed.textContent = `${game.revealedCounts.red} / ${game.scores.red}`;
    scoreBlue.textContent = `${game.revealedCounts.blue} / ${game.scores.blue}`;
    turnEl.dataset.team = game.over ? "" : game.currentTeam;
    turnEl.querySelector(".turn-team").textContent = game.over
      ? "Over"
      : game.currentTeam === "red"
        ? "Red"
        : "Blue";
  }

  function onTileClick(i) {
    if (game.over) return;
    const result = revealTile(game, i);
    if (!result.changed) return;
    state.saveGame(game);
    sound.play(SOUND_BY_OUTCOME[result.outcome] || "revealNeutral");
    rebuildBoard();
    refreshScores();
    if (result.endedTurn || game.over) timer.cancel();
    if (game.over) handleGameOver();
  }

  function handleGameOver() {
    setTimeout(() => {
      sound.play(game.winner ? "win" : "loss");
    }, 250);
    // Stamp history once — guarded against re-entry.
    if (!game.historySaved) {
      const entry = {
        id: game.id,
        finishedAt: Date.now(),
        startedAt: game.createdAt,
        teams: game.teams,
        spymasters: game.spymasters,
        winner: game.winner,
        winReason: game.winReason,
        finalScores: {
          red: game.revealedCounts.red,
          blue: game.revealedCounts.blue,
          redTotal: game.scores.red,
          blueTotal: game.scores.blue,
        },
        startingTeam: game.startingTeam,
        // Full board snapshot so the spymaster key can be revisited later.
        keyPayload: encodeKeyPayload(game),
      };
      state.appendHistory(entry);
      game.historySaved = true;
      state.saveGame(game);
    }
    setTimeout(() => navigate("end"), 700);
  }

  // ----- End turn -----
  root.querySelector("#btn-end-turn").addEventListener("click", () => {
    if (game.over) return;
    endTurnManually(game);
    state.saveGame(game);
    timer.cancel();
    sound.play("endTurn");
    refreshScores();
  });

  // ----- Info modal (QR + teams) -----
  root.querySelector("#btn-info").addEventListener("click", () => {
    openInfoModal(game);
  });

  // ----- Quit -----
  root.querySelector("#btn-quit").addEventListener("click", () => {
    if (!confirmAction("Quit this game? Progress won't be saved to history.")) return;
    timer.cancel();
    state.clearGame();
    navigate("home");
  });

  // ----- Timer popover wiring -----
  const timerBtn = root.querySelector("#btn-timer");
  const pickPane = popover.querySelector('[data-timer-state="pick"]');
  const runPane = popover.querySelector('[data-timer-state="running"]');
  const statusEl = popover.querySelector("#timer-popover-status");
  const pauseBtn = popover.querySelector('[data-action="pause-timer"]');
  let popoverInterval = null;

  function fmtSecs(s) {
    const m = Math.floor(s / 60);
    const sec = Math.max(0, s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  function showPopoverState() {
    const g = state.getGame();
    const hasTimer = !!g?.timer;
    pickPane.classList.toggle("hidden", hasTimer);
    runPane.classList.toggle("hidden", !hasTimer);
    if (hasTimer) {
      refreshPopoverStatus();
      if (!popoverInterval) popoverInterval = setInterval(refreshPopoverStatus, 250);
    } else {
      clearPopoverInterval();
    }
  }

  function refreshPopoverStatus() {
    const g = state.getGame();
    if (!g?.timer) { statusEl.textContent = ""; return; }
    const t = g.timer;
    const remaining = t.paused
      ? Math.max(0, Math.floor(t.remainingSec || 0))
      : Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
    statusEl.textContent = t.paused ? `⏸ ${fmtSecs(remaining)} (paused)` : `⏱ ${fmtSecs(remaining)}`;
    pauseBtn.textContent = t.paused ? "Resume" : "Pause";
  }

  function clearPopoverInterval() {
    if (popoverInterval) clearInterval(popoverInterval);
    popoverInterval = null;
  }

  function openTimer() {
    showPopoverState();
    popover.classList.remove("hidden");
  }
  function closeTimer() {
    popover.classList.add("hidden");
    clearPopoverInterval();
  }

  timerBtn.addEventListener("click", openTimer);

  function startTimerWith(secs) {
    timer.start(secs);
    showPopoverState();
    closeTimer();
  }

  popover.querySelectorAll("[data-secs]").forEach((b) => {
    b.onclick = () => startTimerWith(parseInt(b.dataset.secs, 10));
  });
  popover.querySelector('[data-action="custom"]').onclick = () => {
    const v = window.prompt("Timer length (seconds)", "60");
    const secs = parseInt(v, 10);
    if (!Number.isFinite(secs) || secs <= 0) return;
    startTimerWith(Math.min(secs, 60 * 30));
  };
  popover.querySelector('[data-action="pause-timer"]').onclick = () => {
    timer.togglePause();
    refreshPopoverStatus();
  };
  popover.querySelector('[data-action="restart-timer"]').onclick = () => {
    const g = state.getGame();
    const dur = g?.timer?.durationSec;
    if (dur) timer.start(dur);
    refreshPopoverStatus();
  };
  popover.querySelector('[data-action="stop-timer"]').onclick = () => {
    timer.cancel();
    showPopoverState();
    closeTimer();
  };
  popover.querySelectorAll('[data-action="close-timer"]').forEach((b) => {
    b.onclick = closeTimer;
  });

  // Init timer system & expiration handler.
  timer.init({
    onExpire: () => {
      // Auto-end the turn when time runs out.
      if (game.over) return;
      endTurnManually(game);
      state.saveGame(game);
      timer.cancel();
      refreshScores();
      toast("Time's up — turn ended");
    },
  });

  rebuildBoard();
  refreshScores();
  if (game.over) handleGameOver();

  return () => {
    closeTimer();
    closeInfoModal();
  };
}
