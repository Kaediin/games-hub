import { template, toast } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";
import {
  setObject,
  openCover,
  closeCover,
  submitGuess,
  skipCurrent,
  skipRemaining,
  revealRound,
  playerById,
  guessedCount,
} from "../game.js";
import { persist, resumeRoute } from "../play.js";

export function renderRound(root) {
  const game = state.getGame();
  if (!game) {
    navigate("home");
    return;
  }
  const dest = resumeRoute(game);
  if (dest !== "round") {
    navigate(dest);
    return;
  }

  root.appendChild(template("tpl-round"));
  const round = game.currentRound;
  const naming = root.querySelector("#phase-naming");
  const cover = root.querySelector("#phase-cover");
  const guess = root.querySelector("#phase-guess");
  const actual = root.querySelector("#phase-actual");

  naming.hidden = round.status !== "naming";
  naming.classList.toggle("hidden", round.status !== "naming");
  const showCover = round.status === "guessing" && !round.coverOpen;
  const showGuess = round.status === "guessing" && round.coverOpen;
  cover.hidden = !showCover;
  cover.classList.toggle("hidden", !showCover);
  guess.hidden = !showGuess;
  guess.classList.toggle("hidden", !showGuess);
  actual.hidden = round.status !== "actual";
  actual.classList.toggle("hidden", round.status !== "actual");

  root.querySelector("#round-kicker").textContent = `Round ${round.roundNumber}`;

  if (round.status === "naming") bindNaming(game, root);
  else if (showCover) bindCover(game, root);
  else if (showGuess) bindGuess(game, root);
  else if (round.status === "actual") bindActual(game, root);
}

function bindNaming(game, root) {
  const round = game.currentRound;
  const nameInput = root.querySelector("#object-name");
  const unitInput = root.querySelector("#object-unit");
  nameInput.value = round.objectName || "";
  unitInput.value = round.unit || "grams";
  nameInput.focus();

  root.querySelector("#lock-object").addEventListener("click", () => {
    const r = setObject(game, nameInput.value, unitInput.value);
    if (!r.ok) {
      toast(r.error);
      return;
    }
    persist(game);
    navigate("round");
  });
}

function progressLabel(game) {
  const round = game.currentRound;
  const total = game.players.length;
  return `${guessedCount(round)} / ${total} guesses submitted`;
}

function bindCover(game, root) {
  const round = game.currentRound;
  const player = playerById(game, round.currentGuesserId);
  root.querySelector("#cover-name").textContent = player?.displayName || "the next player";
  root.querySelector("#cover-progress").textContent = progressLabel(game);
  fillSubmitted(game, root.querySelector("#submitted-list"));

  root.querySelector("#cover-ready").addEventListener("click", () => {
    openCover(game);
    persist(game);
    navigate("round");
  });
  root.querySelector("#cover-skip").addEventListener("click", () => {
    const r = skipCurrent(game);
    if (!r.ok) {
      toast(r.error);
      return;
    }
    persist(game);
    navigate(game.currentRound.status === "actual" ? "round" : "round");
  });

  const skipRest = root.querySelector("#cover-skip-rest");
  skipRest.disabled = !round.guesses.length;
  skipRest.addEventListener("click", () => {
    const r = skipRemaining(game);
    if (!r.ok) {
      toast(r.error);
      return;
    }
    persist(game);
    navigate("round");
  });
}

function bindGuess(game, root) {
  const round = game.currentRound;
  const player = playerById(game, round.currentGuesserId);
  root.querySelector("#guess-who").textContent = player?.displayName || "";
  root.querySelector("#guess-object").textContent = round.objectName;
  root.querySelector("#guess-unit").textContent = round.unit || "";
  root.querySelector("#guess-prompt").textContent = "What's your guess?";
  const input = root.querySelector("#guess-input");
  input.focus();

  root.querySelector("#guess-lock").addEventListener("click", () => {
    const r = submitGuess(game, input.value);
    if (!r.ok) {
      toast(r.error);
      return;
    }
    persist(game);
    navigate("round");
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      root.querySelector("#guess-lock").click();
    }
  });
  root.querySelector("#guess-back").addEventListener("click", () => {
    closeCover(game);
    persist(game);
    navigate("round");
  });
}

function bindActual(game, root) {
  const round = game.currentRound;
  root.querySelector("#actual-object").textContent = round.objectName;
  root.querySelector("#actual-unit").textContent = round.unit || "";
  root.querySelector("#actual-progress").textContent = progressLabel(game);
  fillSubmitted(game, root.querySelector("#actual-submitted"));
  const input = root.querySelector("#actual-input");
  input.focus();

  root.querySelector("#btn-reveal").addEventListener("click", () => {
    const r = revealRound(game, input.value);
    if (!r.ok) {
      toast(r.error);
      return;
    }
    persist(game);
    navigate("reveal");
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      root.querySelector("#btn-reveal").click();
    }
  });
}

function fillSubmitted(game, list) {
  if (!list) return;
  list.innerHTML = "";
  const round = game.currentRound;
  const guessed = new Set(round.guesses.map((g) => g.playerId));
  const stillUp = new Set(round.guessOrder);
  game.players.forEach((p) => {
    const li = document.createElement("li");
    let label = "skipped";
    let cls = "is-skip";
    if (guessed.has(p.id)) {
      label = "in";
      cls = "is-done";
    } else if (stillUp.has(p.id)) {
      label = "waiting";
      cls = "is-wait";
    }
    li.className = cls;
    li.textContent = `${p.displayName} · ${label}`;
    list.appendChild(li);
  });
}
