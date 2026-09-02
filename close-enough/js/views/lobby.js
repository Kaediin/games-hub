import { template, el, toast, confirmAction } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";
import { addPlayer, removePlayer, startRound, endGame, historyEntry } from "../game.js";
import { persist, resumeRoute } from "../play.js";
import { boardFor, formatAvg, renderPodium, renderTable } from "../standings.js";

export function renderLobby(root) {
  const game = state.getGame();
  if (!game) {
    navigate("home");
    return;
  }
  const dest = resumeRoute(game);
  if (dest !== "lobby") {
    navigate(dest);
    return;
  }

  root.appendChild(template("tpl-lobby"));
  root.querySelector("#lobby-count").textContent =
    game.players.length === 1 ? "1 player" : `${game.players.length} players`;
  const waitEl = root.querySelector("#lobby-wait");
  if (game.rounds.length) waitEl.classList.add("hidden");

  const list = root.querySelector("#lobby-players");
  const canRemove = game.players.length > 1;
  game.players.forEach((p) => {
    const row = boardFor(game).find((r) => r.id === p.id);
    const meta = row?.roundsParticipated
      ? `${formatAvg(row.averageDistance)} avg`
      : "not played yet";
    const actions = [
      el("span", { class: "player-meta" }, meta),
    ];
    if (canRemove) {
      actions.push(
        el(
          "button",
          {
            type: "button",
            class: "chip-remove",
            "aria-label": `Remove ${p.displayName}`,
            onclick: () => {
              if (
                !confirmAction(
                  `Remove ${p.displayName}? They won't play the next round. Past rounds stay in history.`
                )
              )
                return;
              const r = removePlayer(game, p.id);
              if (!r.ok) {
                toast(r.error);
                return;
              }
              persist(game);
              navigate("lobby");
            },
          },
          "Remove"
        )
      );
    }
    list.appendChild(
      el(
        "li",
        { class: "player-row" },
        el("span", { class: "player-name" }, p.displayName),
        el("div", { class: "player-actions" }, ...actions)
      )
    );
  });

  const ranked = boardFor(game);
  const board = root.querySelector("#lobby-board");
  if (game.rounds.length) {
    board.append(
      el("h2", { class: "section-label" }, "Who's actually good at this?"),
      renderPodium(ranked),
      renderTable(ranked, { compact: true })
    );
  }

  const past = root.querySelector("#lobby-rounds");
  if (game.rounds.length) {
    game.rounds.forEach((r) => {
      past.appendChild(roundSummary(r));
    });
  } else {
    past.appendChild(el("p", { class: "muted" }, "No rounds yet."));
  }

  const addInput = root.querySelector("#late-name");
  root.querySelector("#late-add").addEventListener("click", () => {
    const r = addPlayer(game, addInput.value);
    if (!r.ok) {
      toast(r.error);
      return;
    }
    persist(game);
    navigate("lobby");
  });
  addInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      root.querySelector("#late-add").click();
    }
  });

  root.querySelector("#start-round").addEventListener("click", () => {
    const r = startRound(game);
    if (!r.ok) {
      toast(r.error);
      return;
    }
    persist(game);
    navigate("round");
  });

  root.querySelector("#end-game").addEventListener("click", () => {
    if (!confirmAction("End this game and lock in the podium?")) return;
    endGame(game);
    state.appendHistory(historyEntry(game));
    persist(game);
    navigate("end");
  });
}

export function roundSummary(round) {
  const winners = round.participants.filter((p) => p.isWinner).map((p) => p.displayName);
  const losers = round.participants.filter((p) => p.isLoser).map((p) => p.displayName);
  const line = winners.length ? `🏆 ${winners.join(", ")}` : "No winner";
  const skull = losers.length ? ` · 💀 ${losers.join(", ")}` : "";
  return el(
    "li",
    { class: "round-summary" },
    el(
      "div",
      { class: "round-summary-head" },
      el("strong", {}, `Round ${round.roundNumber} · ${round.objectName}`),
      el("span", { class: "muted" }, `actual ${round.actualValue} ${round.unit || ""}`.trim())
    ),
    el("p", { class: "muted" }, `${line}${skull}`),
    el(
      "ul",
      { class: "guess-mini" },
      ...round.participants.map((p) =>
        el(
          "li",
          {},
          `${p.displayName}: ${p.guess} (${p.distance} off)`
        )
      )
    )
  );
}
