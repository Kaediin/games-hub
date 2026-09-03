import { template, el, toast } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";
import {
  setObject,
  pickGuesser,
  clearGuesser,
  openCover,
  submitGuess,
  skipCurrent,
  skipPlayer,
  skipRemaining,
  revealRound,
  playerById,
  guessedCount,
} from "../game.js";
import { persist, resumeRoute } from "../play.js";
import { mountRoster } from "../roster.js";

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
  const pick = root.querySelector("#phase-pick");
  const cover = root.querySelector("#phase-cover");
  const guess = root.querySelector("#phase-guess");
  const actual = root.querySelector("#phase-actual");

  const showPick = round.status === "guessing" && !round.currentGuesserId;
  const showCover = round.status === "guessing" && !!round.currentGuesserId && !round.coverOpen;
  const showGuess = round.status === "guessing" && round.coverOpen;

  setPhase(naming, round.status === "naming");
  setPhase(pick, showPick);
  setPhase(cover, showCover);
  setPhase(guess, showGuess);
  setPhase(actual, round.status === "actual");

  root.querySelector("#round-kicker").textContent = `Round ${round.roundNumber}`;

  if (round.status === "naming") bindNaming(game, root);
  else if (showPick) bindPick(game, root);
  else if (showCover) bindCover(game, root);
  else if (showGuess) bindGuess(game, root);
  else if (round.status === "actual") bindActual(game, root);

  mountRoster(root.querySelector("#round-roster"), game, {
    onChange: () => {
      persist(game);
      navigate("round");
    },
    metaFor: (p) => playerRoundMeta(game, p.id),
  });
}

function playerRoundMeta(game, playerId) {
  const round = game.currentRound;
  if (!round || round.status === "naming") return "";
  if (round.guesses.some((g) => g.playerId === playerId)) return "in";
  if (round.guessOrder.includes(playerId)) return "waiting";
  return "skipped";
}

function setPhase(node, on) {
  if (!node) return;
  node.hidden = !on;
  node.classList.toggle("hidden", !on);
}

function progressLabel(game) {
  const round = game.currentRound;
  return `${guessedCount(round)} / ${game.players.length} guesses submitted`;
}

function bindNaming(game, root) {
  const round = game.currentRound;
  const nameInput = root.querySelector("#object-name");
  const unitInput = root.querySelector("#object-unit");
  nameInput.value = round.objectName || "";
  unitInput.value = round.unit || "grams";
  nameInput.focus();

  root.querySelector("#naming-back").addEventListener("click", (e) => {
    e.preventDefault();
    game.currentRound = null;
    persist(game);
    navigate("lobby");
  });

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

function bindPick(game, root) {
  const round = game.currentRound;
  root.querySelector("#pick-progress").textContent = progressLabel(game);
  const list = root.querySelector("#pick-list");
  list.innerHTML = "";

  const pending = new Set(round.guessOrder);
  const guessed = new Set(round.guesses.map((g) => g.playerId));

  game.players.forEach((p) => {
    if (pending.has(p.id)) {
      list.appendChild(
        el(
          "li",
          { class: "pick-row" },
          el(
            "button",
            {
              type: "button",
              class: "pick-player",
              onclick: () => {
                const r = pickGuesser(game, p.id);
                if (!r.ok) {
                  toast(r.error);
                  return;
                }
                persist(game);
                navigate("round");
              },
            },
            el("span", { class: "player-name" }, p.displayName),
            el("span", { class: "player-meta" }, "Tap to guess")
          ),
          el(
            "button",
            {
              type: "button",
              class: "chip-remove",
              "aria-label": `Skip ${p.displayName}`,
              onclick: () => {
                const r = skipPlayer(game, p.id);
                if (!r.ok) {
                  toast(r.error);
                  return;
                }
                persist(game);
                navigate("round");
              },
            },
            "Skip"
          )
        )
      );
      return;
    }

    const label = guessed.has(p.id) ? "in" : "skipped";
    list.appendChild(
      el(
        "li",
        { class: `pick-row is-done is-${guessed.has(p.id) ? "in" : "skip"}` },
        el("span", { class: "player-name" }, p.displayName),
        el("span", { class: "player-meta" }, label)
      )
    );
  });

  const skipRest = root.querySelector("#pick-skip-rest");
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

function bindCover(game, root) {
  const round = game.currentRound;
  const player = playerById(game, round.currentGuesserId);
  root.querySelector("#cover-name").textContent = player?.displayName || "the next player";
  root.querySelector("#cover-progress").textContent = progressLabel(game);
  const submitted = root.querySelector("#submitted-list");
  if (submitted) submitted.replaceChildren();

  root.querySelector("#cover-ready").addEventListener("click", () => {
    openCover(game);
    persist(game);
    navigate("round");
  });
  root.querySelector("#cover-back").addEventListener("click", () => {
    clearGuesser(game);
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
    clearGuesser(game);
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
