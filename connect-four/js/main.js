import { startDuel } from "../../shared/duel.js";
import * as rules from "./game.js";

const { COLS, ROWS } = rules;
const CELL = 100;
const PAD = 22;
const W = COLS * CELL + PAD * 2;
const H = ROWS * CELL + PAD * 2;
const HOLE = 38;
const DISC = 43;
const SVG_NS = "http://www.w3.org/2000/svg";

const cx = (col) => PAD + CELL / 2 + col * CELL;
const cy = (row) => PAD + CELL / 2 + (ROWS - 1 - row) * CELL;

function discMarkup(seat) {
  return `
    <circle r="${DISC}" fill="url(#duel-disc-${seat})"/>
    <circle r="30" fill="none" stroke="url(#duel-ridge-${seat})" stroke-width="4.5"/>
    <circle r="25" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1.5"/>
    <ellipse cx="-13" cy="-17" rx="15" ry="8" fill="rgba(255,255,255,0.32)" transform="rotate(-32)"/>`;
}

function piece(seat) {
  return `
    <svg class="c4-piece" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
      <circle r="47" fill="url(#duel-disc-${seat})" stroke="rgba(0,0,0,0.22)" stroke-width="2"/>
      <circle r="32" fill="none" stroke="url(#duel-ridge-${seat})" stroke-width="5"/>
      <circle r="27" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.6"/>
      <ellipse cx="-14" cy="-19" rx="16" ry="8.5" fill="rgba(255,255,255,0.34)" transform="rotate(-32)"/>
    </svg>`;
}

// The board face is a wood panel with 42 holes cut out by a CSS mask, so
// discs slide down behind it and show through the holes.
function faceMask() {
  const r = 34;
  let d = `M${r} 0H${W - r}A${r} ${r} 0 0 1 ${W} ${r}V${H - r}A${r} ${r} 0 0 1 ${W - r} ${H}H${r}A${r} ${r} 0 0 1 0 ${H - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const x = cx(col);
      const y = cy(row);
      d += `M${x - HOLE} ${y}a${HOLE} ${HOLE} 0 1 0 ${HOLE * 2} 0a${HOLE} ${HOLE} 0 1 0 ${-HOLE * 2} 0Z`;
    }
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' preserveAspectRatio='none'><path fill-rule='evenodd' d='${d}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function mountBoard(host, api) {
  host.classList.add("c4");

  const holes = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) holes.push([cx(col), cy(row)]);
  }
  const cols = Array.from(
    { length: COLS },
    (_, c) => `<button class="c4-col" type="button" data-col="${c}" aria-label="Column ${c + 1}"></button>`,
  ).join("");

  host.innerHTML = `
    <div class="c4-rot">
      <div class="c4-body"></div>
      <div class="c4-well"></div>
      <svg class="c4-pieces" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
        <g class="c4-ghost"></g>
        <g class="c4-discs"></g>
      </svg>
      <div class="c4-face wood"></div>
      <svg class="c4-rims" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="c4-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style="stop-color: var(--rim-dark)"/>
            <stop offset="0.55" style="stop-color: var(--rim-mid)"/>
            <stop offset="1" style="stop-color: var(--rim-light)"/>
          </linearGradient>
          <linearGradient id="c4-lip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#000" stop-opacity="0.5"/>
            <stop offset="0.45" stop-color="#000" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="c4-edge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style="stop-color: var(--edge-light)"/>
            <stop offset="0.5" stop-color="#000" stop-opacity="0"/>
            <stop offset="1" stop-color="#000" stop-opacity="0.35"/>
          </linearGradient>
          <radialGradient id="c4-glint" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
            <stop offset="1" stop-color="#fff" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect class="c4-colglow" x="0" y="12" width="${CELL - 8}" height="${H - 24}" rx="${(CELL - 8) / 2}"/>
        ${holes
          .map(
            ([x, y]) => `
          <circle cx="${x}" cy="${y}" r="${HOLE - 3}" fill="none" stroke="url(#c4-lip)" stroke-width="6"/>
          <circle cx="${x}" cy="${y}" r="${HOLE + 1.5}" fill="none" stroke="url(#c4-rim)" stroke-width="4"/>`,
          )
          .join("")}
        <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="33" fill="none" stroke="url(#c4-edge)" stroke-width="3"/>
      </svg>
      <svg class="c4-wins" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false"></svg>
      <div class="c4-hit" role="group" aria-label="Columns">${cols}</div>
    </div>`;

  const face = host.querySelector(".c4-face");
  const mask = faceMask();
  face.style.webkitMaskImage = mask;
  face.style.maskImage = mask;

  const discsLayer = host.querySelector(".c4-discs");
  const ghostLayer = host.querySelector(".c4-ghost");
  const winsLayer = host.querySelector(".c4-wins");
  const colGlow = host.querySelector(".c4-colglow");
  const hit = host.querySelector(".c4-hit");
  const colButtons = [...hit.querySelectorAll(".c4-col")];

  let shown = [];
  let ghostCol = null;
  let pressing = false;
  let suppressClickUntil = 0;
  let winToken = 0;

  function makeDisc({ col, row, player }) {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "disc");
    g.setAttribute("transform", `translate(${cx(col)} ${cy(row)})`);
    const body = document.createElementNS(SVG_NS, "g");
    body.setAttribute("class", "disc-body");
    body.innerHTML = discMarkup(player);
    g.appendChild(body);
    discsLayer.appendChild(g);
    return g;
  }

  function dropIn(el, { row }) {
    const body = el.firstChild;
    const fall = cy(row) + CELL * 0.6;
    const fallMs = 170 * Math.sqrt(fall / CELL);
    const total = fallMs + 300;
    const at = (ms) => ms / total;
    const anim = body.animate(
      [
        { transform: `translateY(${-fall}px)`, easing: "cubic-bezier(0.5, 0, 0.95, 0.55)" },
        { transform: "translateY(0px)", offset: at(fallMs), easing: "cubic-bezier(0.2, 0.7, 0.4, 1)" },
        { transform: `translateY(${-CELL * 0.16}px)`, offset: at(fallMs + 95), easing: "cubic-bezier(0.6, 0, 0.8, 0.4)" },
        { transform: "translateY(0px)", offset: at(fallMs + 185), easing: "cubic-bezier(0.2, 0.7, 0.4, 1)" },
        { transform: `translateY(${-CELL * 0.045}px)`, offset: at(fallMs + 240), easing: "ease-in" },
        { transform: "translateY(0px)" },
      ],
      { duration: total, fill: "backwards" },
    );
    const landTimer = setTimeout(() => {
      api.sound.play("land", { row });
      api.haptic("land");
    }, fallMs);
    const settleTimer = setTimeout(() => api.sound.play("settle", { row }), fallMs + 185);
    anim.addEventListener("cancel", () => {
      clearTimeout(landTimer);
      clearTimeout(settleTimer);
    });
    return new Promise((resolve) => {
      anim.onfinish = resolve;
      anim.oncancel = resolve;
    });
  }

  function liftOut(el, row, animate) {
    if (!animate) {
      el.remove();
      return;
    }
    el.firstChild.getAnimations?.().forEach((a) => a.cancel());
    const rise = cy(row) + CELL * 0.6;
    const anim = el.firstChild.animate(
      [{ transform: "translateY(0px)" }, { transform: `translateY(${-rise}px)` }],
      { duration: 260, easing: "cubic-bezier(0.5, 0, 0.75, 0)", fill: "forwards" },
    );
    anim.onfinish = () => el.remove();
  }

  function fallOut(el, col, row, animate) {
    if (!animate) {
      el.remove();
      return;
    }
    el.firstChild.getAnimations?.().forEach((a) => a.cancel());
    el.classList.remove("is-win");
    const drop = (row + 1) * CELL + PAD + DISC;
    const anim = el.firstChild.animate(
      [{ transform: "translateY(0px)" }, { transform: `translateY(${drop}px)` }],
      {
        duration: 280 + 70 * Math.sqrt(row + 1),
        delay: 60 + Math.abs(col - 3) * 22,
        easing: "cubic-bezier(0.55, 0, 1, 0.6)",
        fill: "both",
      },
    );
    anim.onfinish = () => el.remove();
  }

  function setGhost(col) {
    ghostCol = col;
    const round = api.round();
    const row = col == null ? -1 : rules.landingRow(round, col);
    const show = col != null && round.status === "playing" && row !== -1;
    host.classList.toggle("has-ghost", show);
    if (col != null) colGlow.setAttribute("x", String(PAD + col * CELL + 4));
    colGlow.classList.toggle("is-on", col != null && round.status === "playing");
    if (!show) {
      ghostLayer.innerHTML = "";
      return;
    }
    ghostLayer.setAttribute("transform", `translate(${cx(col)} ${cy(row)})`);
    ghostLayer.innerHTML = discMarkup(round.turn);
  }

  function flashFull(col) {
    colGlow.setAttribute("x", String(PAD + col * CELL + 4));
    colGlow.classList.remove("is-denied");
    void colGlow.getBoundingClientRect();
    colGlow.classList.add("is-denied");
    setTimeout(() => colGlow.classList.remove("is-denied"), 420);
  }

  function tryPlay(col) {
    const round = api.round();
    if (round.status === "playing" && rules.landingRow(round, col) === -1) flashFull(col);
    return api.play(col);
  }

  function showWin(round) {
    winsLayer.innerHTML = round.line
      .map(
        ([col, row], i) => `
        <g class="win-cell" style="--i: ${i}" transform="translate(${cx(col)} ${cy(row)})">
          <circle class="win-glint" r="${HOLE - 2}" fill="url(#c4-glint)"/>
          <circle class="win-ring" r="${HOLE + 1}"/>
        </g>`,
      )
      .join("");
    winsLayer.style.setProperty("--wc", `var(--p${round.winner})`);
    winsLayer.style.setProperty("--wc-glow", `var(--p${round.winner}-glow)`);
    host.classList.add("is-won");
  }

  function render(round, { animate = false } = {}) {
    const moves = round.moves;
    let keep = 0;
    while (keep < shown.length && keep < moves.length && shown[keep].col === moves[keep]) keep++;
    const removed = shown.slice(keep);
    shown = shown.slice(0, keep);
    const clearing = moves.length === 0 && removed.length > 0;
    removed.forEach((d) => (clearing ? fallOut(d.el, d.col, d.row, animate) : liftOut(d.el, d.row, animate)));

    let landed = Promise.resolve();
    for (let i = keep; i < moves.length; i++) {
      const p = round.placed[i];
      const el = makeDisc(p);
      if (animate && i === moves.length - 1 && removed.length === 0) landed = dropIn(el, p);
      shown.push({ ...p, el });
    }

    winToken += 1;
    const token = winToken;
    winsLayer.innerHTML = "";
    host.classList.remove("is-won");
    host.classList.toggle("is-over", round.status !== "playing");
    host.classList.toggle("is-draw", round.status === "draw");
    shown.forEach((d) => {
      const inLine = round.line.some(([c, r]) => c === d.col && r === d.row);
      d.el.classList.toggle("is-win", inLine);
    });

    colButtons.forEach((b, col) => {
      const free = rules.landingRow(round, col) === -1 ? 0 : ROWS - round.grid[col].length;
      b.setAttribute("aria-disabled", String(round.status !== "playing" || free === 0));
      b.setAttribute("aria-label", `Column ${col + 1}, ${free ? `${free} free` : "full"}`);
    });

    const hoverCol = ghostCol;
    setGhost(round.status === "playing" ? hoverCol : null);

    if (round.status === "won") {
      return landed.then(() => {
        if (token === winToken) showWin(round);
        return new Promise((resolve) => setTimeout(resolve, animate ? 180 : 0));
      });
    }
    return landed;
  }

  // ---------- input ----------

  function colAt(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const btn = el?.closest?.(".c4-col");
    return btn && hit.contains(btn) ? Number(btn.dataset.col) : null;
  }

  hit.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    pressing = true;
    setGhost(colAt(e));
  });

  hit.addEventListener("pointermove", (e) => {
    if (!pressing && e.pointerType !== "mouse") return;
    const col = colAt(e);
    if (col !== ghostCol) setGhost(col);
  });

  hit.addEventListener("pointerup", (e) => {
    if (!pressing) return;
    pressing = false;
    suppressClickUntil = performance.now() + 500;
    const col = colAt(e);
    if (col != null) tryPlay(col);
    setGhost(e.pointerType === "mouse" ? col : null);
  });

  hit.addEventListener("pointercancel", () => {
    pressing = false;
    setGhost(null);
  });

  hit.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse" && !pressing) setGhost(null);
  });

  hit.addEventListener("click", (e) => {
    if (performance.now() < suppressClickUntil) return;
    const btn = e.target.closest(".c4-col");
    if (btn) tryPlay(Number(btn.dataset.col));
  });

  hit.addEventListener("focusin", (e) => {
    const btn = e.target.closest(".c4-col");
    if (btn && btn.matches(":focus-visible")) setGhost(Number(btn.dataset.col));
  });

  hit.addEventListener("focusout", () => {
    if (!pressing) setGhost(null);
  });

  hit.addEventListener("keydown", (e) => {
    const btn = e.target.closest(".c4-col");
    if (!btn) return;
    const col = Number(btn.dataset.col);
    let next = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = (col + COLS - 1) % COLS;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = (col + 1) % COLS;
    if (next == null) return;
    e.preventDefault();
    colButtons[next].focus();
    setGhost(next);
  });

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !/^[1-7]$/.test(e.key)) return;
    if (e.target.closest?.("input, textarea")) return;
    const col = Number(e.key) - 1;
    if (tryPlay(col)) colButtons[col].focus({ preventScroll: true });
  });

  return {
    render,
    winOrigin() {
      const cells = winsLayer.querySelectorAll(".win-cell");
      if (!cells.length) return null;
      const a = cells[0].getBoundingClientRect();
      const b = cells[cells.length - 1].getBoundingClientRect();
      return { x: (a.left + a.right + b.left + b.right) / 4, y: (a.top + a.bottom + b.top + b.bottom) / 4 };
    },
    layout() {
      setGhost(null);
    },
  };
}

startDuel({
  id: "connect-four",
  title: "Connect 4",
  tagline: "Drop a disc. Block the stack. Four wins it.",
  howTo:
    "Tap a column to drop your disc. Line up four across, down or diagonally to win the round. The first move alternates every round, and undo works until the round is decided.",
  rules,
  piece,
  seatNote: (seat) => (seat === 0 ? "Opens round 1" : "Opens round 2"),
  mountBoard,
});
