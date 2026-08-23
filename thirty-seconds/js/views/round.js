import { template, el, toast, confirmAction } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";
import {
  currentTeam,
  describerName,
  paletteFor,
  startPlaying,
  toggleGuess,
  scoredCount,
  finishRound,
  applyMove,
  remainingSecs,
  historyEntry,
  pauseRoundTimer,
  resumeRoundTimer,
} from "../game.js";
import { sound } from "../sound.js";
import { timer } from "../timer.js";

const ZERO_QUIPS = [
  "Zero? Did you forget to tap the ones they got, or was this round a write-off?",
  "Not even one? Cancel if you just forgot to mark them. OK if this team really ate dirt.",
  "A vintage nothing. Forgotten ticks — or did the well actually run dry?",
];

function confirmZeroScore() {
  const quip = ZERO_QUIPS[Math.floor(Math.random() * ZERO_QUIPS.length)];
  return confirmAction(quip);
}

export function renderRound(root) {
  const game = state.getGame();
  if (!game) {
    toast("No game in progress");
    navigate("home");
    return;
  }
  if (game.over && !game.round) {
    navigate("end");
    return;
  }
  if (!game.round) {
    navigate("board");
    return;
  }

  root.appendChild(template("tpl-round"));
  const team = currentTeam(game);
  const pal = paletteFor(team.color);
  const who = describerName(team);

  root.querySelector("#round-team").textContent = team.name;
  root.querySelector("#round-team").style.color = pal.hex;
  root.querySelector("#round-who").textContent = who ? `${who} describes` : "Describe these five";
  root.querySelector(".round").style.setProperty("--team", pal.hex);

  const timerEl = root.querySelector("#round-timer");
  const overlay = root.querySelector("#countdown-overlay");
  const list = root.querySelector("#word-list");
  const goBtn = root.querySelector("#btn-go");
  const pauseBtn = root.querySelector("#btn-pause");
  const doneBtn = root.querySelector("#btn-finish-round");
  const hintEl = root.querySelector(".round-hint");

  let cancelled = false;
  let countdownId = null;
  let userPaused = !!game.round.timer?.paused;

  function save() {
    state.saveGame(game);
  }

  function renderWords() {
    const hide = game.round.phase === "countdown";
    list.innerHTML = "";
    list.classList.toggle("hidden", hide);
    if (hide) return;
    game.round.words.forEach((w, idx) => {
      const canTap = game.round.phase === "playing" || game.round.phase === "done";
      list.appendChild(
        el(
          "button",
          {
            type: "button",
            class: `word-card${w.guessed ? " guessed" : ""}`,
            disabled: !canTap,
            onclick: () => {
              const was = w.guessed;
              if (!toggleGuess(game, idx)) return;
              sound.play(w.guessed ? "mark" : "unmark");
              save();
              renderWords();
              renderActions();
              if (!was && scoredCount(game.round) === 5 && game.round.phase === "playing") {
                finishRound(game, { lock: false });
                timer.stop();
                sound.play("endTurn");
                save();
                renderAll();
              }
            },
          },
          el("span", { class: "word-text" }, w.text),
          el("span", { class: "word-mark", "aria-hidden": "true" }, w.guessed ? "✓" : "")
        )
      );
    });
  }

  function renderTimerFace() {
    const round = game.round;
    if (round.phase === "peek") {
      timerEl.textContent = String(game.timerSec);
      timerEl.classList.remove("urgent", "done", "paused");
    } else if (round.phase === "countdown") {
      const left = Math.max(1, Math.ceil((round.countdownEndsAt - Date.now()) / 1000));
      timerEl.textContent = String(left);
      timerEl.classList.remove("urgent", "done", "paused");
    } else if (round.phase === "playing") {
      const secs = remainingSecs(round.timer);
      timerEl.textContent = String(secs);
      timerEl.classList.toggle("urgent", secs <= 5 && secs > 0 && !round.timer?.paused);
      timerEl.classList.toggle("paused", !!round.timer?.paused);
      timerEl.classList.remove("done");
    } else {
      timerEl.textContent = "0";
      timerEl.classList.add("done");
      timerEl.classList.remove("urgent", "paused");
    }
  }

  function renderActions() {
    const round = game.round;
    goBtn.classList.toggle("hidden", round.phase !== "peek");
    const n = scoredCount(round);
    const playing = round.phase === "playing";
    pauseBtn.classList.toggle("hidden", !playing);
    pauseBtn.textContent = round.timer?.paused ? "Resume timer" : "Pause";
    if (round.phase === "done") {
      doneBtn.classList.remove("hidden");
      doneBtn.disabled = false;
      doneBtn.textContent = n === 0 ? "No points — next team" : `Advance ${n} space${n === 1 ? "" : "s"}`;
    } else if (playing) {
      doneBtn.classList.remove("hidden");
      doneBtn.disabled = n < 5;
      doneBtn.textContent = n === 5 ? "Got them all — advance 5" : "Playing…";
    } else {
      doneBtn.classList.add("hidden");
    }
    if (hintEl) {
      hintEl.textContent =
        round.phase === "done"
          ? "Time’s up — tap the ones they actually got, then advance."
          : "Tap a word when it is guessed. Tap again to undo. Any order is fine.";
    }
  }

  function renderOverlay() {
    if (game.round.phase !== "countdown") {
      overlay.classList.add("hidden");
      overlay.textContent = "";
      return;
    }
    overlay.classList.remove("hidden");
    const ms = game.round.countdownEndsAt - Date.now();
    if (ms <= 200) overlay.textContent = "GO";
    else overlay.textContent = String(Math.max(1, Math.ceil(ms / 1000)));
  }

  function renderAll() {
    renderWords();
    renderTimerFace();
    renderActions();
    renderOverlay();
  }

  function onTick(secs) {
    if (cancelled || !game.round || game.round.phase !== "playing") return;
    timerEl.textContent = String(secs);
    timerEl.classList.toggle("urgent", secs <= 5 && secs > 0 && !game.round.timer?.paused);
    timerEl.classList.toggle("paused", !!game.round.timer?.paused);
    timerEl.classList.remove("done");
  }

  function onExpire() {
    if (cancelled || !game.round || game.round.phase !== "playing") return;
    finishRound(game, { lock: false });
    timer.stop();
    sound.play("timeUp");
    save();
    renderAll();
  }

  function beginPlay() {
    startPlaying(game);
    save();
    sound.play("go");
    timer.init({ onExpire, onTick });
    renderAll();
  }

  function tickCountdown() {
    if (cancelled || !game.round || game.round.phase !== "countdown") return;
    const left = game.round.countdownEndsAt - Date.now();
    if (left <= 0) {
      clearInterval(countdownId);
      countdownId = null;
      beginPlay();
      return;
    }
    const sec = Math.ceil(left / 1000);
    if (overlay.dataset.sec !== String(sec)) {
      overlay.dataset.sec = String(sec);
      sound.play("countdown");
    }
    renderTimerFace();
    renderOverlay();
  }

  goBtn.addEventListener("click", () => {
    beginPlay();
  });

  pauseBtn.addEventListener("click", () => {
    if (!game.round || game.round.phase !== "playing") return;
    if (game.round.timer?.paused) {
      resumeRoundTimer(game);
      userPaused = false;
    } else {
      pauseRoundTimer(game);
      userPaused = true;
    }
    save();
    timer.refresh();
    renderAll();
  });

  doneBtn.addEventListener("click", () => {
    if (!game.round) return;
    if (game.round.phase === "playing") {
      if (scoredCount(game.round) < 5) return;
      finishRound(game, { lock: false });
      timer.stop();
      save();
    }
    if (game.round.phase !== "done") return;
    if (scoredCount(game.round) === 0 && !confirmZeroScore()) return;
    const result = applyMove(game);
    save();
    if (result.won) {
      state.appendHistory(historyEntry(game));
    }
    navigate("board");
  });

  function onVisibility() {
    if (cancelled || game.round?.phase !== "playing") return;
    if (document.hidden) {
      if (pauseRoundTimer(game)) {
        save();
        timer.refresh();
        renderAll();
      }
      return;
    }
    if (!userPaused && resumeRoundTimer(game)) {
      save();
      timer.refresh();
      renderAll();
    }
  }

  function onPageHide() {
    if (game.round?.phase === "playing") pauseRoundTimer(game);
    save();
  }

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);

  if (game.round.phase === "playing") {
    timer.init({ onExpire, onTick });
  } else if (game.round.phase === "countdown") {
    sound.play("countdown");
    countdownId = setInterval(tickCountdown, 100);
    tickCountdown();
  } else {
    timer.stop();
  }

  renderAll();

  return () => {
    cancelled = true;
    if (countdownId) clearInterval(countdownId);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    if (game.round?.phase === "playing") pauseRoundTimer(game);
    save();
    timer.stop();
  };
}
