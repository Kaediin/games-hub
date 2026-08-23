import { template, el } from "../ui.js";
import { decodeKeyPayload } from "../game.js";

const FOCUS_KEY = "codenames.keyFocus";
const MARKS_KEY = "codenames.keyMarks"; // { [boardHash]: number[] }

function loadFocus() {
  try {
    return localStorage.getItem(FOCUS_KEY) || "both";
  } catch {
    return "both";
  }
}
function saveFocus(v) {
  try {
    localStorage.setItem(FOCUS_KEY, v);
  } catch {
    /* ignore */
  }
}

function loadAllMarks() {
  try {
    return JSON.parse(localStorage.getItem(MARKS_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveAllMarks(obj) {
  try {
    localStorage.setItem(MARKS_KEY, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

// Compact 32-bit string hash of the board payload — stable id for the
// per-board marks bucket. (Phones with their own browser get their own
// marks, which is what we want.)
function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function renderKey(root, payload) {
  root.appendChild(template("tpl-key"));
  const board = root.querySelector("#key-board");
  const toggle = root.querySelector(".focus-toggle");

  // If user navigated here from the history view in this session,
  // offer a way back. Spymaster phones (opened via QR in a fresh tab)
  // won't see this since they have no in-app navigation history.
  if (sessionStorage.getItem("codenames.fromHistory") === "1") {
    root.querySelector(".key-view").prepend(
      el("a", { class: "back-link", href: "#history" }, "← Back to history")
    );
  }

  if (!payload) {
    board.appendChild(el("p", { class: "muted" }, "No key data found in this link."));
    toggle.classList.add("hidden");
    return;
  }
  let data;
  try {
    data = decodeKeyPayload(payload);
  } catch {
    board.appendChild(el("p", { class: "muted" }, "Could not read this key — link looks corrupted."));
    toggle.classList.add("hidden");
    return;
  }
  // Per-board marks (which tiles the spymaster has tapped) — keyed by a
  // stable hash of the payload so a refresh keeps the marks.
  const boardId = hashString(payload);
  const allMarks = loadAllMarks();
  const marks = new Set(allMarks[boardId] || []);
  function persistMarks() {
    const cur = loadAllMarks();
    cur[boardId] = [...marks];
    saveAllMarks(cur);
  }

  data.tiles.forEach((t, i) => {
    const tile = el(
      "button",
      {
        class: `tile ${t.color}` + (marks.has(i) ? " marked" : ""),
        type: "button",
        "aria-pressed": String(marks.has(i)),
        "aria-label": `${t.word} (${t.color})`,
        onclick: () => {
          if (marks.has(i)) marks.delete(i);
          else marks.add(i);
          tile.classList.toggle("marked");
          tile.setAttribute("aria-pressed", String(marks.has(i)));
          persistMarks();
        },
      },
      t.word
    );
    board.appendChild(tile);
  });

  // Show spymaster names on the team buttons; fall back to the colour
  // names when no spymaster name is available (e.g. older payloads).
  const redName = (data.spymasters?.red || "").trim() || "Red";
  const blueName = (data.spymasters?.blue || "").trim() || "Blue";
  const redBtn = toggle.querySelector('[data-focus="red"]');
  const blueBtn = toggle.querySelector('[data-focus="blue"]');
  redBtn.textContent = redName;
  redBtn.title = `Show only ${redName}'s (red) cards`;
  blueBtn.textContent = blueName;
  blueBtn.title = `Show only ${blueName}'s (blue) cards`;

  function applyFocus(value) {
    if (value === "both") delete board.dataset.focus;
    else board.dataset.focus = value;
    toggle.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.focus === value));
    });
    saveFocus(value);
  }

  toggle.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => applyFocus(b.dataset.focus));
  });

  applyFocus(loadFocus());
}
