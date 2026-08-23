import { template, el, toast } from "../ui.js";
import { state, TEAM_PALETTE, PACK_META, TIMER_PRESETS, defaultDraft } from "../state.js";
import { navigate } from "../router.js";
import { createGame, parseCustomWords } from "../game.js";
import { unusedCount } from "../words/index.js";

export function renderSetup(root) {
  root.appendChild(template("tpl-setup"));
  const draft = state.getDraft();

  const teamsEl = root.querySelector("#teams-editor");
  const packsEl = root.querySelector("#pack-list");
  const customTa = root.querySelector("#custom-words");
  const peekToggle = root.querySelector("#opt-peek");
  const timerRow = root.querySelector("#timer-presets");
  const startBtn = root.querySelector("#start-game");
  const addTeamBtn = root.querySelector("#add-team");

  peekToggle.checked = draft.peek !== false;
  customTa.value = draft.customWordsText || "";

  function usedColors() {
    return new Set(draft.teams.map((t) => t.color));
  }

  function nextColor() {
    const used = usedColors();
    return TEAM_PALETTE.find((c) => !used.has(c.id))?.id || TEAM_PALETTE[0].id;
  }

  function persist() {
    draft.peek = peekToggle.checked;
    draft.customWordsText = customTa.value;
    state.saveDraft(draft);
    refresh();
  }

  function refresh() {
    teamsEl.innerHTML = "";
    draft.teams.forEach((team, idx) => {
      teamsEl.appendChild(renderTeamCard(team, idx));
    });
    addTeamBtn.disabled = draft.teams.length >= 4;
    addTeamBtn.classList.toggle("hidden", draft.teams.length >= 4);

    packsEl.innerHTML = "";
    PACK_META.filter((p) => p.id !== "custom").forEach((pack) => {
      const on = draft.packs.includes(pack.id);
      packsEl.appendChild(
        el(
          "label",
          { class: `pack-chip${on ? " on" : ""}` },
          el("input", {
            type: "checkbox",
            checked: on,
            onchange: () => {
              if (on) draft.packs = draft.packs.filter((id) => id !== pack.id);
              else draft.packs = [...draft.packs, pack.id];
              persist();
            },
          }),
          el("span", { class: "pack-name" }, pack.label),
          el("span", { class: "pack-hint" }, pack.hint)
        )
      );
    });

    timerRow.innerHTML = "";
    TIMER_PRESETS.forEach((sec) => {
      const on = Number(draft.timerSec) === sec;
      timerRow.appendChild(
        el(
          "button",
          {
            type: "button",
            class: `chip-btn${on ? " on" : ""}`,
            onclick: () => {
              draft.timerSec = sec;
              persist();
            },
          },
          `${sec}s`
        )
      );
    });

    const customCount = parseCustomWords(draft.customWordsText).length;
    const probe = {
      packs: draft.packs,
      customWords: parseCustomWords(draft.customWordsText),
      usedWords: [],
    };
    let pool = 0;
    try {
      pool = unusedCount(probe);
    } catch {
      pool = 0;
    }
    const packOk = draft.packs.length > 0 || customCount > 0;
    const teamsOk = draft.teams.length >= 2 && draft.teams.every((t) => t.name.trim());
    startBtn.disabled = !(packOk && teamsOk && pool >= 5);
    root.querySelector("#pool-hint").textContent = packOk
      ? `${pool} words in the mix${customCount ? ` (including ${customCount} custom)` : ""}.`
      : "Select at least one pack, or paste custom words.";
  }

  function renderTeamCard(team, idx) {
    const pal = TEAM_PALETTE.find((c) => c.id === team.color) || TEAM_PALETTE[0];
    const colors = el("div", { class: "color-row" });
    TEAM_PALETTE.forEach((c) => {
      const taken = draft.teams.some((t, i) => i !== idx && t.color === c.id);
      colors.appendChild(
        el("button", {
          type: "button",
          class: `color-dot${team.color === c.id ? " selected" : ""}`,
          style: `--dot:${c.hex}`,
          title: c.label,
          disabled: taken,
          "aria-label": c.label,
          onclick: () => {
            team.color = c.id;
            if (!team.name.trim() || TEAM_PALETTE.some((p) => p.label === team.name)) {
              team.name = c.label;
            }
            persist();
          },
        })
      );
    });

    const players = el("ul", { class: "mini-players" });
    (team.players || []).forEach((p, pi) => {
      players.appendChild(
        el(
          "li",
          {},
          el("span", {}, p),
          el(
            "button",
            {
              type: "button",
              class: "remove",
              onclick: () => {
                team.players.splice(pi, 1);
                persist();
              },
            },
            "Remove"
          )
        )
      );
    });

    const form = el(
      "form",
      { class: "mini-form" },
      el("input", {
        type: "text",
        maxlength: "20",
        autocomplete: "off",
        placeholder: "Player name (optional)",
      }),
      el("button", { type: "submit", class: "btn btn-ghost" }, "Add")
    );
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      const name = input.value.trim();
      if (!name) return;
      if ((team.players || []).some((x) => x.toLowerCase() === name.toLowerCase())) {
        toast("That name is already on this team");
        return;
      }
      team.players = team.players || [];
      team.players.push(name);
      input.value = "";
      persist();
    });

    const card = el(
      "article",
      { class: "team-card", style: `--team:${pal.hex}` },
      el(
        "header",
        { class: "team-card-head" },
        el("input", {
          class: "team-name-input",
          type: "text",
          maxlength: "18",
          value: team.name,
          "aria-label": "Team name",
          oninput: (e) => {
            team.name = e.target.value;
            state.saveDraft(draft);
          },
          onchange: persist,
        }),
        draft.teams.length > 2
          ? el(
              "button",
              {
                type: "button",
                class: "remove",
                onclick: () => {
                  draft.teams.splice(idx, 1);
                  persist();
                },
              },
              "Remove team"
            )
          : null
      ),
      colors,
      el("p", { class: "muted tiny" }, "Players — used to rotate who describes"),
      players,
      form
    );
    return card;
  }

  addTeamBtn.addEventListener("click", () => {
    if (draft.teams.length >= 4) return;
    const color = nextColor();
    const pal = TEAM_PALETTE.find((c) => c.id === color);
    draft.teams.push({ name: pal.label, color, players: [] });
    persist();
  });

  peekToggle.addEventListener("change", persist);
  customTa.addEventListener("change", persist);
  customTa.addEventListener("blur", persist);

  root.querySelector("#reset-setup").addEventListener("click", () => {
    const fresh = defaultDraft();
    Object.assign(draft, fresh);
    draft.teams = fresh.teams;
    peekToggle.checked = true;
    customTa.value = "";
    persist();
  });

  startBtn.addEventListener("click", () => {
    persist();
    if (startBtn.disabled) return;
    try {
      const game = createGame(draft);
      state.saveGame(game);
      navigate("board");
    } catch (err) {
      toast(err.message || "Could not start the game");
    }
  });

  refresh();
}
