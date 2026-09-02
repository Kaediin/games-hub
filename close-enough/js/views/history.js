import { template, el, confirmAction, fmtDate } from "../ui.js";
import { state } from "../state.js";
import { rankPlayers, formatNumber } from "../score.js";
import { formatAvg } from "../standings.js";
import { roundSummary } from "./lobby.js";

export function renderHistory(root) {
  root.appendChild(template("tpl-history"));
  const list = root.querySelector("#history-list");
  const empty = root.querySelector("#history-empty");
  const items = state.getHistory();

  if (!items.length) {
    list.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  items.forEach((g) => {
    const ranked = rankPlayers(g.players || [], g.rounds || []);
    const lead = ranked.find((r) => r.rank === 1);
    const details = el("div", { class: "history-rounds hidden" });
    (g.rounds || []).forEach((r) => details.appendChild(roundSummary(r)));

    const item = el(
      "li",
      { class: "history-item" },
      el(
        "button",
        {
          type: "button",
          class: "history-toggle",
          onclick: () => details.classList.toggle("hidden"),
        },
        el("div", { class: "winner-badge" }, lead ? `${lead.displayName} leads` : "No podium yet"),
        el(
          "div",
          {},
          el("div", { class: "meta" }, `${fmtDate(g.finishedAt)} · ${g.rounds?.length || 0} rounds`),
          el(
            "div",
            {},
            lead
              ? `${lead.displayName} · ${formatAvg(lead.averageDistance)} avg (${formatNumber(lead.cumulativeDistance)} total)`
              : (g.players || []).map((p) => p.displayName).join(" · ")
          )
        )
      ),
      details
    );
    list.appendChild(item);
  });

  root.querySelector("#clear-history").addEventListener("click", () => {
    if (!confirmAction("Clear all saved game history?")) return;
    state.clearHistory();
    location.hash = "#history";
    location.reload();
  });
}
