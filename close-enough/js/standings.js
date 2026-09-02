import { el } from "./ui.js";
import { formatNumber, rankPlayers } from "./score.js";

export function formatAvg(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatNumber(Math.round(n * 10) / 10);
}

export function unitSuffix(unit) {
  const u = String(unit || "").trim();
  return u ? ` ${u}` : "";
}

export function renderPodium(ranked) {
  const top = ranked.filter((r) => r.rank).slice(0, 3);
  const slots = [top[1], top[0], top[2]];
  const wrap = el("div", { class: "podium", "aria-label": "Overall podium" });
  const labels = ["2", "1", "3"];
  slots.forEach((row, i) => {
    const place = labels[i];
    wrap.appendChild(
      el(
        "div",
        { class: `podium-col podium-${place}${row ? "" : " is-empty"}` },
        el("div", { class: "podium-name" }, row ? row.displayName : "—"),
        el(
          "div",
          { class: "podium-avg" },
          row ? `${formatAvg(row.averageDistance)} avg` : ""
        ),
        el("div", { class: "podium-block" }, el("span", { class: "podium-place" }, place))
      )
    );
  });
  return wrap;
}

export function renderTable(ranked, { compact = false } = {}) {
  const table = el("table", { class: `board-table${compact ? " is-compact" : ""}` });
  const head = el(
    "thead",
    {},
    el(
      "tr",
      {},
      el("th", {}, "Player"),
      compact ? null : el("th", {}, "Wins"),
      compact ? null : el("th", {}, "Losses"),
      el("th", {}, "Avg"),
      compact ? null : el("th", {}, "Total"),
      el("th", {}, "Rounds")
    )
  );
  const body = el("tbody");
  ranked.forEach((r) => {
    body.appendChild(
      el(
        "tr",
        { class: r.rank === 1 ? "is-lead" : "" },
        el("td", { class: "td-name" }, r.rank ? `${r.rank}. ${r.displayName}` : `— ${r.displayName}`),
        compact ? null : el("td", {}, String(r.wins)),
        compact ? null : el("td", {}, String(r.losses)),
        el("td", {}, formatAvg(r.averageDistance)),
        compact ? null : el("td", {}, formatNumber(r.cumulativeDistance)),
        el("td", {}, String(r.roundsParticipated))
      )
    );
  });
  table.append(head, body);
  return table;
}

export function boardFor(game) {
  return rankPlayers(game.players, game.rounds);
}
