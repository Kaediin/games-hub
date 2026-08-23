import { template, el, toast } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";

export function renderEnd(root) {
  const game = state.getGame();
  if (!game || !game.over) {
    toast("No completed game to show");
    navigate("home");
    return;
  }
  root.appendChild(template("tpl-end"));
  const title = root.querySelector("#end-title");
  const detail = root.querySelector("#end-detail");
  const winner = game.winner;
  title.textContent = winner === "red" ? "Red team wins" : "Blue team wins";
  title.style.color = winner === "red" ? "var(--red)" : "var(--blue)";
  detail.textContent =
    game.winReason === "assassin"
      ? `${winner === "red" ? "Blue" : "Red"} hit the assassin.`
      : `All ${game.scores[winner]} agents found.`;
  root.querySelector("#end-red").textContent = `${game.revealedCounts.red} / ${game.scores.red}`;
  root.querySelector("#end-blue").textContent = `${game.revealedCounts.blue} / ${game.scores.blue}`;

  // Full board reveal — every tile shows its true color.
  // Tiles that were flipped during play appear at full opacity;
  // tiles that were never revealed are dimmed so you can tell them apart.
  const board = root.querySelector("#end-board");
  game.tiles.forEach((tile) => {
    const classes = ["tile", tile.color];
    if (!tile.revealed) classes.push("unrevealed");
    board.appendChild(
      el("div", {
        class: classes.join(" "),
        "aria-label": `${tile.word} (${tile.color}${tile.revealed ? ", revealed" : ""})`,
      }, tile.word)
    );
  });

  root.querySelector('[data-action="new-game"]').addEventListener("click", () => {
    state.clearGame();
    const draft = state.getDraft();
    navigate(draft.players.length >= 4 ? "assign" : "setup");
  });
  root.querySelector('[data-action="home"]').addEventListener("click", () => {
    state.clearGame();
    navigate("home");
  });
}
