import { template, el } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";
import { boardFor, renderPodium, renderTable } from "../standings.js";
import { formatNumber } from "../score.js";
import { roundSummary } from "./lobby.js";

export function renderEnd(root) {
  const game = state.getGame();
  if (!game) {
    navigate("home");
    return;
  }
  if (!game.over) {
    navigate("lobby");
    return;
  }

  root.appendChild(template("tpl-end"));
  const ranked = boardFor(game);
  const lead = ranked.find((r) => r.rank === 1);
  root.querySelector("#end-title").textContent = lead
    ? `${lead.displayName} takes the night`
    : "That's a wrap";
  root.querySelector("#end-detail").textContent = lead
    ? `${formatNumber(lead.points)} points after ${game.rounds.length} round${game.rounds.length === 1 ? "" : "s"}.`
    : "No one submitted a guess.";

  const board = root.querySelector("#end-board");
  board.append(renderPodium(ranked), renderTable(ranked));

  const past = root.querySelector("#end-rounds");
  if (game.rounds.length) game.rounds.forEach((r) => past.appendChild(roundSummary(r)));
  else past.appendChild(el("p", { class: "muted" }, "No rounds recorded."));

  root.querySelector('[data-action="new-game"]').addEventListener("click", () => {
    state.clearGame();
    navigate("setup");
  });
  root.querySelector('[data-action="home"]').addEventListener("click", () => {
    navigate("home");
  });
}
