import { template, el, confirmAction } from "../ui.js";
import { state } from "../state.js";
import { paletteFor } from "../game.js";

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fmtDuration(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "<1 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function renderHistory(root) {
  root.appendChild(template("tpl-history"));
  const list = root.querySelector("#history-list");
  const empty = root.querySelector("#history-empty");
  const items = state.getHistory();

  if (!items.length) {
    list.classList.add("hidden");
    empty.classList.remove("hidden");
  }

  items.forEach((g) => {
    const pal = paletteFor(g.winnerColor);
    const duration =
      g.startedAt && g.finishedAt ? fmtDuration(g.finishedAt - g.startedAt) : "";
    const teams = (g.teams || [])
      .map((t) => `${t.name} (${t.position ?? "—"})`)
      .join(" · ");

    list.appendChild(
      el(
        "li",
        {},
        el(
          "div",
          { class: "winner-badge", style: `--team:${pal.hex}` },
          `${g.winnerName || "Winner"} wins`
        ),
        el(
          "div",
          {},
          el("div", { class: "meta" }, `${fmtDate(g.finishedAt)} · ${duration}`),
          el("div", {}, teams || "—")
        )
      )
    );
  });

  root.querySelector("#clear-history").addEventListener("click", () => {
    if (!confirmAction("Clear all saved game history?")) return;
    state.clearHistory();
    location.hash = "#history";
    location.reload();
  });
}
