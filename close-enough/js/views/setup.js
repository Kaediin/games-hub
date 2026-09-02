import { template, el, toast } from "../ui.js";
import { state, defaultDraft } from "../state.js";
import { navigate } from "../router.js";
import { createGame } from "../game.js";
import { normalizeName, nameKey } from "../score.js";
import { persist } from "../play.js";

export function renderSetup(root) {
  root.appendChild(template("tpl-setup"));
  const draft = state.getDraft();
  draft.names = (draft.names || []).map(normalizeName).filter(Boolean);
  state.saveDraft(draft);

  const listEl = root.querySelector("#player-list");
  const input = root.querySelector("#player-name");

  function redraw() {
    listEl.innerHTML = "";
    if (!draft.names.length) {
      listEl.appendChild(el("p", { class: "muted" }, "Add a few names to get started."));
      return;
    }
    draft.names.forEach((name, idx) => {
      listEl.appendChild(
        el(
          "li",
          { class: "player-chip" },
          el("span", {}, name),
          el(
            "button",
            {
              type: "button",
              class: "chip-remove",
              "aria-label": `Remove ${name}`,
              onclick: () => {
                draft.names.splice(idx, 1);
                state.saveDraft(draft);
                redraw();
              },
            },
            "Remove"
          )
        )
      );
    });
  }

  function addName() {
    const name = normalizeName(input.value);
    if (!name) {
      toast("Enter a display name.");
      return;
    }
    if (draft.names.some((n) => nameKey(n) === nameKey(name))) {
      toast("That name is already on the list.");
      return;
    }
    draft.names.push(name);
    input.value = "";
    state.saveDraft(draft);
    redraw();
    input.focus();
  }

  redraw();
  root.querySelector("#add-player").addEventListener("click", addName);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addName();
    }
  });

  root.querySelector("#reset-setup").addEventListener("click", () => {
    const next = defaultDraft();
    next.names = [];
    Object.assign(draft, next);
    state.saveDraft(draft);
    redraw();
  });

  root.querySelector("#start-game").addEventListener("click", () => {
    if (!draft.names.length) {
      toast("Add at least one player.");
      return;
    }
    persist(createGame(draft.names));
    navigate("lobby");
  });
}
