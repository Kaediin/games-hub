import { el, toast, confirmAction } from "./ui.js";
import { addPlayer, removePlayer } from "./game.js";

/**
 * Add / remove players from any in-progress screen.
 * `onChange` should persist and re-render the current view.
 */
export function mountRoster(host, game, { onChange, metaFor = null, title = "Players" } = {}) {
  if (!host) return;

  function redraw() {
    host.replaceChildren();
    host.appendChild(el("h2", { class: "section-label" }, title));

    const list = el("ul", { class: "player-list roster-list" });
    const canRemove = game.players.length > 1;
    game.players.forEach((p) => {
      const meta = metaFor ? metaFor(p) : "";
      const actions = [];
      if (meta) actions.push(el("span", { class: "player-meta" }, meta));
      if (canRemove) {
        actions.push(
          el(
            "button",
            {
              type: "button",
              class: "chip-remove",
              "aria-label": `Remove ${p.displayName}`,
              onclick: () => {
                const inRound =
                  game.currentRound &&
                  game.currentRound.status !== "revealed" &&
                  (game.currentRound.guesses.some((g) => g.playerId === p.id) ||
                    game.currentRound.guessOrder.includes(p.id) ||
                    game.currentRound.currentGuesserId === p.id);
                const msg = inRound
                  ? `Remove ${p.displayName}? They drop out of this round (their guess won't count). Past rounds stay in history.`
                  : `Remove ${p.displayName}? They won't play the next round. Past rounds stay in history.`;
                if (!confirmAction(msg)) return;
                const r = removePlayer(game, p.id);
                if (!r.ok) {
                  toast(r.error);
                  return;
                }
                onChange();
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
    host.appendChild(list);

    const input = el("input", {
      class: "text-input",
      type: "text",
      maxlength: "24",
      autocomplete: "off",
      autocapitalize: "words",
      placeholder: "Another name",
      id: "roster-name",
    });
    input.setAttribute("aria-label", "Add a player");

    const addBtn = el("button", { type: "button", class: "btn btn-secondary" }, "Add");
    const add = () => {
      const r = addPlayer(game, input.value);
      if (!r.ok) {
        toast(r.error);
        return;
      }
      input.value = "";
      onChange();
    };
    addBtn.addEventListener("click", add);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        add();
      }
    });

    host.appendChild(
      el(
        "div",
        { class: "add-row late-join" },
        el("label", { class: "field-label", for: "roster-name" }, "Add a player"),
        input,
        addBtn
      )
    );
  }

  redraw();
}
