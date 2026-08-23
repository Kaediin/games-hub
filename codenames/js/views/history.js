import { template, el, confirmAction } from "../ui.js";
import { state } from "../state.js";

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
    const winner = g.winner;
    const reason =
      g.winReason === "assassin" ? "by assassin" : "found all words";
    const teamNames = (team) =>
      (g.teams?.[team] || []).join(", ") || "—";
    const duration = g.startedAt && g.finishedAt ? fmtDuration(g.finishedAt - g.startedAt) : "";

    const meta = el(
      "div",
      {},
      el("div", { class: "meta" }, `${fmtDate(g.finishedAt)} · ${duration} · ${reason}`),
      el("div", {}, `Red: ${teamNames("red")}`),
      el("div", {}, `Blue: ${teamNames("blue")}`),
      el(
        "div",
        { class: "meta" },
        `Score (revealed) — Red ${g.finalScores?.red ?? 0}/${g.finalScores?.redTotal ?? "?"}, Blue ${g.finalScores?.blue ?? 0}/${g.finalScores?.blueTotal ?? "?"}`
      )
    );

    if (g.keyPayload) {
      meta.appendChild(
        el(
          "a",
          {
            class: "view-board-link",
            href: `#key=${g.keyPayload}`,
            onclick: () => {
              try {
                sessionStorage.setItem("codenames.fromHistory", "1");
              } catch {
                /* ignore */
              }
            },
          },
          "View board ↗"
        )
      );
    }

    const li = el(
      "li",
      {},
      el(
        "div",
        { class: `winner-badge ${winner}` },
        winner === "red" ? "Red wins" : "Blue wins"
      ),
      meta,
      el("div", {})
    );
    list.appendChild(li);
  });

  root.querySelector("#clear-history").addEventListener("click", () => {
    if (!confirmAction("Clear all saved game history?")) return;
    state.clearHistory();
    location.hash = "#history";
    location.reload();
  });
}
