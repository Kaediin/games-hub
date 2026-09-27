import { startDuel } from "../../shared/duel.js";
import * as rules from "./game.js";

const X_STROKES = ["M30 30 L70 70", "M70 30 L30 70"];
const O_STROKE = "M50 24 A26 26 0 1 1 49.99 24";
const MARK_MS = 380;

function layers(d, seat) {
  return `
    <path class="ly-shadow" d="${d}" pathLength="1" transform="translate(0 3.5)"/>
    <path class="ly-body" d="${d}" pathLength="1" stroke="url(#duel-stroke-${seat})"/>
    <path class="ly-shine" d="${d}" pathLength="1" transform="translate(-1.6 -2.2)"/>`;
}

function markMarkup(seat) {
  if (seat === 0) {
    return X_STROKES.map((d, i) => `<g class="st st-x${i}">${layers(d, 0)}</g>`).join("");
  }
  return `<g class="st st-o">${layers(O_STROKE, 1)}</g>`;
}

function piece(seat) {
  return `<svg class="ttt-piece" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${markMarkup(seat)}</svg>`;
}

function groove(d) {
  return `<path class="gv-dark" d="${d}" pathLength="1"/><path class="gv-light" d="${d}" pathLength="1" transform="translate(1.6 1.8)"/>`;
}

function center(cell) {
  return [50 + (cell % 3) * 100, 50 + Math.floor(cell / 3) * 100];
}

function strikePath(line) {
  const [x1, y1] = center(line[0]);
  const [x2, y2] = center(line[2]);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const ext = 34;
  return `M${x1 - ux * ext} ${y1 - uy * ext} L${x2 + ux * ext} ${y2 + uy * ext}`;
}

function mountBoard(host, api) {
  host.classList.add("ttt");
  const cellMarkup = Array.from(
    { length: 9 },
    (_, i) => `
      <button class="ttt-cell" type="button" data-cell="${i}">
        <svg class="ttt-ghost" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <g class="gh gh-0">${X_STROKES.map((d) => `<path d="${d}"/>`).join("")}</g>
          <g class="gh gh-1"><path d="${O_STROKE}"/></g>
        </svg>
      </button>`,
  ).join("");

  host.innerHTML = `
    <div class="ttt-board wood">
      <div class="ttt-inner">
        <svg class="ttt-grid" viewBox="0 0 300 300" aria-hidden="true" focusable="false">
          ${groove("M100 12 V288")}${groove("M200 12 V288")}${groove("M12 100 H288")}${groove("M12 200 H288")}
        </svg>
        <div class="ttt-cells" role="group" aria-label="Board">${cellMarkup}</div>
        <svg class="ttt-strike" viewBox="0 0 300 300" aria-hidden="true" focusable="false">
          <path class="sk-shadow" pathLength="1" transform="translate(0 4)"/>
          <path class="sk-line" pathLength="1"/>
          <path class="sk-core" pathLength="1"/>
        </svg>
      </div>
    </div>`;

  const cells = [...host.querySelectorAll(".ttt-cell")];
  const strike = host.querySelector(".ttt-strike");
  const shown = Array(9).fill(null);

  function addMark(cell, seat, drawing) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", `ttt-mark${drawing ? " is-drawing" : ""}`);
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = markMarkup(seat);
    cell.appendChild(svg);
  }

  function removeMark(cell, animate, delay = 0) {
    const svg = cell.querySelector(".ttt-mark:not(.is-leaving)");
    if (!svg) return;
    if (!animate) {
      svg.remove();
      return;
    }
    svg.style.animationDelay = `${delay}ms`;
    svg.classList.add("is-leaving");
    setTimeout(() => svg.remove(), 260 + delay);
  }

  function setStrike(round, animate, drawing) {
    if (round.status !== "won") {
      if (strike.classList.contains("is-on")) {
        strike.classList.remove("is-on", "is-drawing");
        if (animate) {
          strike.classList.add("is-leaving");
          setTimeout(() => strike.classList.remove("is-leaving"), 260);
        }
      }
      return;
    }
    const d = strikePath(round.line);
    strike.querySelectorAll("path").forEach((p) => p.setAttribute("d", d));
    strike.style.setProperty("--wc", `var(--p${round.winner})`);
    strike.style.setProperty("--wc-glow", `var(--p${round.winner}-glow)`);
    strike.classList.remove("is-leaving");
    strike.classList.toggle("is-drawing", drawing);
    strike.classList.add("is-on");
  }

  function render(round, { animate = false } = {}) {
    const last = round.moves[round.moves.length - 1];
    const clearing = round.moves.length === 0;
    let order = 0;
    let placed = null;

    cells.forEach((cell, i) => {
      const want = round.board[i];
      if (shown[i] !== want) {
        if (shown[i] !== null) removeMark(cell, animate, clearing ? order++ * 35 : 0);
        if (want !== null) {
          const drawing = animate && i === last;
          addMark(cell, want, drawing);
          if (drawing) placed = want;
        }
        shown[i] = want;
      }
      const inLine = round.status === "won" && round.line.includes(i);
      cell.classList.toggle("is-filled", want !== null);
      cell.classList.toggle("is-win", inLine);
      cell.setAttribute("aria-disabled", String(want !== null || round.status !== "playing"));
      cell.setAttribute(
        "aria-label",
        `${rules.describeMove(i)}, ${want === null ? "empty" : want === 0 ? "X" : "O"}${inLine ? ", winning line" : ""}`,
      );
    });

    if (placed !== null) {
      api.sound.play("place", { player: placed });
      api.haptic("tap");
    }

    host.dataset.turn = round.turn ?? "";
    host.style.setProperty("--win-delay", placed !== null ? `${MARK_MS}ms` : "0ms");
    host.classList.toggle("is-over", round.status !== "playing");
    host.classList.toggle("is-draw", round.status === "draw");
    setStrike(round, animate, animate && placed !== null);

    if (round.status === "playing" || !animate) return Promise.resolve();
    const wait = round.status === "won" ? MARK_MS + 300 : MARK_MS;
    return new Promise((resolve) => setTimeout(resolve, wait));
  }

  host.addEventListener("click", (e) => {
    const cell = e.target.closest(".ttt-cell");
    if (!cell) return;
    api.play(Number(cell.dataset.cell));
  });

  host.addEventListener("keydown", (e) => {
    const cell = e.target.closest(".ttt-cell");
    if (!cell) return;
    const i = Number(cell.dataset.cell);
    let r = Math.floor(i / 3);
    let c = i % 3;
    if (e.key === "ArrowUp") r = (r + 2) % 3;
    else if (e.key === "ArrowDown") r = (r + 1) % 3;
    else if (e.key === "ArrowLeft") c = (c + 2) % 3;
    else if (e.key === "ArrowRight") c = (c + 1) % 3;
    else return;
    e.preventDefault();
    cells[r * 3 + c].focus();
  });

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !/^[1-9]$/.test(e.key)) return;
    if (e.target.closest?.("input, textarea")) return;
    if (api.play(Number(e.key) - 1)) cells[Number(e.key) - 1].focus({ preventScroll: true });
  });

  return {
    render,
    winOrigin() {
      const round = api.round();
      if (round.status !== "won") return null;
      const rect = cells[round.line[1]].getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },
  };
}

startDuel({
  id: "tic-tac-toe",
  title: "Tic-tac-toe",
  tagline: "Three in a row takes the round.",
  howTo:
    "Take turns placing your mark. First to line up three across, down or diagonally wins the round. The first move alternates every round, and undo works until the round is decided.",
  rules,
  piece,
  seatNote: (seat) => (seat === 0 ? "Plays X" : "Plays O"),
  mountBoard,
});
