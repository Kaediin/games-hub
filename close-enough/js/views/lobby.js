import { template, el, toast, confirmAction } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";
import { startRound, endGame, historyEntry } from "../game.js";
import { persist, resumeRoute } from "../play.js";
import { boardFor, renderPodium, renderTable } from "../standings.js";
import { formatNumber } from "../score.js";
import { mountRoster } from "../roster.js";

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

  const ranked = boardFor(game);
  mountRoster(root.querySelector("#lobby-roster"), game, {
    onChange: () => {
      persist(game);
      navigate("lobby");
    },
    metaFor: (p) => {
      const row = ranked.find((r) => r.id === p.id);
      return row?.roundsParticipated ? `${formatNumber(row.points)} pts` : "not played yet";
    },
  });

  const board = root.querySelector("#lobby-board");
  if (game.rounds.length) {
    board.append(
      el("h2", { class: "section-label" }, "Leaderboard"),
      renderPodium(ranked),
      renderTable(ranked)
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
  const line = winners.length ? `🏆 ${winners.join(", ")}` : "No closest guess";
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
      ...round.participants.map((p) => {
        const bonus = p.exactBonus ? ` +${p.exactBonus} exact` : "";
        const pts = p.points != null ? ` · ${p.points} pts${bonus}` : "";
        return el("li", {}, `${p.displayName}: ${p.guess} (${p.distance} off)${pts}`);
      })
    )
  );
}
