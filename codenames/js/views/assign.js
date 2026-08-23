import { template, el, shuffle, toast } from "../ui.js";
import { state } from "../state.js";
import { navigate } from "../router.js";
import { generateGame } from "../game.js";

export function renderAssign(root) {
  root.appendChild(template("tpl-assign"));

  const draft = state.getDraft();
  draft.teams = { red: [], blue: [], none: [], ...(draft.teams || {}) };
  draft.spymasters = { red: null, blue: null, ...(draft.spymasters || {}) };

  // Reconcile against the canonical players list.
  const valid = new Set(draft.players);
  ["red", "blue", "none"].forEach((t) => {
    draft.teams[t] = (draft.teams[t] || []).filter((p) => valid.has(p));
  });
  if (!valid.has(draft.spymasters.red)) draft.spymasters.red = null;
  if (!valid.has(draft.spymasters.blue)) draft.spymasters.blue = null;
  const placed = new Set([...draft.teams.red, ...draft.teams.blue, ...draft.teams.none]);
  draft.players.forEach((p) => {
    if (!placed.has(p)) draft.teams.none.push(p);
  });
  state.saveDraft(draft);

  const startBtn = root.querySelector("#start-game");
  const summary = root.querySelector("#assign-summary");
  const roster = root.querySelector("#assign-roster");

  function teamOf(player) {
    if (draft.teams.red.includes(player)) return "red";
    if (draft.teams.blue.includes(player)) return "blue";
    return "none";
  }

  function setTeam(player, team) {
    ["red", "blue", "none"].forEach((t) => {
      draft.teams[t] = draft.teams[t].filter((p) => p !== player);
    });
    draft.teams[team].push(player);
    if (team !== "red" && draft.spymasters.red === player) draft.spymasters.red = null;
    if (team !== "blue" && draft.spymasters.blue === player) draft.spymasters.blue = null;
    state.saveDraft(draft);
    refresh();
  }

  function toggleSpy(player) {
    const team = teamOf(player);
    if (team === "none") return;
    draft.spymasters[team] = draft.spymasters[team] === player ? null : player;
    state.saveDraft(draft);
    refresh();
  }

  function isValid() {
    if (draft.teams.none.length > 0)
      return { ok: false, reason: "Assign every player to a team" };
    if (draft.teams.red.length < 2 || draft.teams.blue.length < 2)
      return { ok: false, reason: "Each team needs at least 2 players" };
    if (!draft.spymasters.red || !draft.spymasters.blue)
      return { ok: false, reason: "Pick a spymaster for each team (★)" };
    return { ok: true };
  }

  function refresh() {
    // Summary pills.
    summary.innerHTML = "";
    ["red", "blue"].forEach((team) => {
      const players = draft.teams[team];
      const spy = draft.spymasters[team];
      const ok = players.length >= 2 && !!spy;
      summary.appendChild(
        el(
          "div",
          { class: `pill ${team} ${ok ? "ok" : ""}` },
          el("span", { class: "label" }, team === "red" ? "Red" : "Blue"),
          el("span", { class: "count" }, `${players.length} player${players.length === 1 ? "" : "s"}`),
          el("span", { class: "spy" }, spy ? `★ ${spy}` : "no spymaster")
        )
      );
    });

    // Roster rows.
    roster.innerHTML = "";
    draft.players.forEach((p) => {
      const team = teamOf(p);
      const isSpy = team !== "none" && draft.spymasters[team] === p;
      const picker = el(
        "div",
        { class: "team-picker", role: "group", "aria-label": `${p} team` },
        el(
          "button",
          {
            type: "button",
            "data-team": "red",
            "aria-pressed": String(team === "red"),
            onclick: () => setTeam(p, "red"),
            title: "Assign to Red",
          },
          "Red"
        ),
        el(
          "button",
          {
            type: "button",
            "data-team": "blue",
            "aria-pressed": String(team === "blue"),
            onclick: () => setTeam(p, "blue"),
            title: "Assign to Blue",
          },
          "Blue"
        ),
        el(
          "button",
          {
            type: "button",
            "data-team": "none",
            "aria-pressed": String(team === "none"),
            onclick: () => setTeam(p, "none"),
            title: "Unassign",
          },
          "—"
        )
      );
      const star = el(
        "button",
        {
          class: "spy-toggle",
          type: "button",
          "aria-pressed": String(isSpy),
          disabled: team === "none" ? true : false,
          title: team === "none" ? "Assign a team first" : isSpy ? "Demote spymaster" : "Mark as spymaster",
          onclick: () => toggleSpy(p),
        },
        isSpy ? "★" : "☆"
      );
      const row = el(
        "div",
        { class: "roster-row", "data-team": team },
        el("span", { class: "player-name" }, p),
        picker,
        star
      );
      roster.appendChild(row);
    });

    const valid = isValid();
    startBtn.disabled = !valid.ok;
    startBtn.title = valid.reason || "";
  }

  root.querySelector("#randomize-teams").addEventListener("click", () => {
    const all = shuffle(draft.players);
    const half = Math.floor(all.length / 2);
    draft.teams.red = all.slice(0, half);
    draft.teams.blue = all.slice(half);
    draft.teams.none = [];
    draft.spymasters.red = draft.teams.red[Math.floor(Math.random() * draft.teams.red.length)] || null;
    draft.spymasters.blue = draft.teams.blue[Math.floor(Math.random() * draft.teams.blue.length)] || null;
    state.saveDraft(draft);
    refresh();
  });

  root.querySelector("#clear-teams").addEventListener("click", () => {
    draft.teams.red = [];
    draft.teams.blue = [];
    draft.teams.none = draft.players.slice();
    draft.spymasters = { red: null, blue: null };
    state.saveDraft(draft);
    refresh();
  });

  startBtn.addEventListener("click", () => {
    const valid = isValid();
    if (!valid.ok) {
      toast(valid.reason);
      return;
    }
    const game = generateGame({
      teams: { red: draft.teams.red, blue: draft.teams.blue },
      spymasters: { red: draft.spymasters.red, blue: draft.spymasters.blue },
      excludeWords: new Set(state.getLastWords()),
    });
    state.saveGame(game);
    navigate("qr");
  });

  refresh();
}
