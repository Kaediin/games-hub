import { template, el, toast } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";

export function renderSetup(root) {
  root.appendChild(template("tpl-setup"));

  const draft = state.getDraft();
  const list = root.querySelector("#player-list");
  const input = root.querySelector("#player-name-input");
  const form = root.querySelector("#add-player-form");
  const continueBtn = root.querySelector("#to-assign");

  function refresh() {
    list.innerHTML = "";
    draft.players.forEach((p) => {
      list.appendChild(
        el(
          "li",
          {},
          el("span", { class: "name" }, p),
          el(
            "button",
            {
              class: "remove",
              type: "button",
              onclick: () => {
                draft.players = draft.players.filter((x) => x !== p);
                // also drop from teams if assigned
                ["red", "blue", "none"].forEach((t) => {
                  draft.teams[t] = (draft.teams[t] || []).filter((x) => x !== p);
                });
                if (draft.spymasters.red === p) draft.spymasters.red = null;
                if (draft.spymasters.blue === p) draft.spymasters.blue = null;
                state.saveDraft(draft);
                refresh();
              },
            },
            "Remove"
          )
        )
      );
    });
    continueBtn.disabled = draft.players.length < 4;
    continueBtn.title =
      draft.players.length < 4 ? "Add at least 4 players" : "";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    if (draft.players.some((p) => p.toLowerCase() === name.toLowerCase())) {
      toast("That name is already in the list");
      return;
    }
    if (draft.players.length >= 20) {
      toast("Plenty of agents already");
      return;
    }
    draft.players.push(name);
    if (!draft.teams.none) draft.teams.none = [];
    draft.teams.none.push(name);
    state.saveDraft(draft);
    input.value = "";
    input.focus();
    refresh();
  });

  continueBtn.addEventListener("click", () => navigate("assign"));

  refresh();
  input.focus();
}
