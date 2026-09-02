import { template, el, confirmAction } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";
import { nextRound, endGame, historyEntry } from "../game.js";
import { persist, resumeRoute } from "../play.js";
import { boardFor, formatAvg, renderPodium, renderTable, unitSuffix } from "../standings.js";
import { formatNumber } from "../score.js";
import { burstConfetti } from "../confetti.js";
import { roundSummary } from "./lobby.js";

export function renderReveal(root) {
  const game = state.getGame();
  if (!game) {
    navigate("home");
    return;
  }
  const dest = resumeRoute(game);
  if (dest !== "reveal") {
    navigate(dest);
    return;
  }

  const round = game.rounds[game.rounds.length - 1];
  root.appendChild(template("tpl-reveal"));
  root.querySelector("#reveal-object").textContent = round.objectName;
  root.querySelector("#reveal-answer").textContent =
    `${formatNumber(round.actualValue)}${unitSuffix(round.unit)}`;

  const list = root.querySelector("#reveal-standings");
  round.participants.forEach((p, i) => {
    const marks = [];
    if (p.isWinner) marks.push("🏆");
    if (p.isLoser) marks.push("💀");
    const li = el(
      "li",
      { class: `reveal-row${p.isWinner ? " is-win" : ""}${p.isLoser ? " is-lose" : ""}` },
      el("span", { class: "reveal-rank" }, String(i + 1)),
      el("span", { class: "reveal-name" }, `${p.displayName} ${marks.join(" ")}`.trim()),
      el("span", { class: "reveal-guess" }, `guessed ${formatNumber(p.guess)}`),
      el("span", { class: "reveal-dist" }, `${p.displayName} was ${formatNumber(p.distance)} off`)
    );
    li.style.animationDelay = `${180 + i * 140}ms`;
    list.appendChild(li);
  });

  const ranked = boardFor(game);
  const podiumHost = root.querySelector("#reveal-podium");
  podiumHost.append(
    el("h2", { class: "section-label" }, "Who's actually good at this?"),
    renderPodium(ranked),
    renderTable(ranked)
  );

  const past = root.querySelector("#reveal-history");
  game.rounds.forEach((r) => past.appendChild(roundSummary(r)));

  let stopConfetti = () => {};
  if (round.winnerIds?.length) {
    stopConfetti = burstConfetti(document.body);
  }

  root.querySelector("#next-round").addEventListener("click", () => {
    const r = nextRound(game);
    if (!r.ok) return;
    persist(game);
    navigate("round");
  });
  root.querySelector("#back-lobby").addEventListener("click", () => {
    game.currentRound = null;
    persist(game);
    navigate("lobby");
  });
  root.querySelector("#end-game").addEventListener("click", () => {
    if (!confirmAction("End this game and lock in the podium?")) return;
    endGame(game);
    state.appendHistory(historyEntry(game));
    persist(game);
    navigate("end");
  });

  return () => stopConfetti();
}

export { formatAvg };
