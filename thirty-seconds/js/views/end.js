import { template, el } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";
import { paletteFor, FINISH } from "../game.js";
import { sound } from "../sound.js";

export function renderEnd(root) {
  const game = state.getGame();
  if (!game) {
    navigate("home");
    return;
  }
  if (!game.over) {
    navigate(game.round ? "round" : "board");
    return;
  }

  root.appendChild(template("tpl-end"));
  const winner = game.teams.find((t) => t.id === game.winner);
  const pal = paletteFor(winner?.color);
  root.querySelector("#end-title").textContent = `${winner?.name || "A team"} reaches the château`;
  root.querySelector("#end-title").style.color = pal.hex;
  root.querySelector("#end-detail").textContent = "First to the finish wins. Pour something nice.";

  const list = root.querySelector("#end-standings");
  const ranked = [...game.teams].sort((a, b) => b.position - a.position);
  ranked.forEach((t, i) => {
    const p = paletteFor(t.color);
    list.appendChild(
      el(
        "li",
        { class: "end-row", style: `--team:${p.hex}` },
        el("span", { class: "end-rank" }, String(i + 1)),
        el("span", { class: "pawn-mini", style: `background:${p.hex}` }),
        el("span", { class: "end-name" }, t.name),
        el("span", { class: "end-pos" }, t.id === game.winner ? "Finish" : `${t.position} / ${FINISH}`)
      )
    );
  });

  sound.play("win");

  root.querySelector('[data-action="new-game"]').addEventListener("click", () => {
    state.clearGame();
    navigate("setup");
  });
  root.querySelector('[data-action="home"]').addEventListener("click", () => {
    navigate("home");
  });
}
