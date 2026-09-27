import { games } from "./games.js";

const grid = document.getElementById("game-grid");
const toastEl = document.getElementById("toast");
let toastTimer = 0;

function artFor(game) {
  if (game.id === "codenames") return codenamesArt();
  if (game.id === "thirty-seconds") return thirtyArt();
  if (game.id === "close-enough") return closeArt();
  if (game.id === "connect-four") return connectFourArt();
  if (game.id === "tic-tac-toe") return ticTacToeArt();
  return fallbackArt(game.accent);
}

function codenamesArt() {
  const cells = [
    "#c45c4a",
    "#d8b787",
    "#4a82c4",
    "#c45c4a",
    "#d8b787",
    "#4a82c4",
    "#1a1a1a",
    "#c45c4a",
    "#d8b787",
    "#4a82c4",
    "#d8b787",
    "#c45c4a",
    "#4a82c4",
    "#d8b787",
    "#c45c4a",
    "#4a82c4",
    "#d8b787",
    "#c45c4a",
    "#4a82c4",
    "#d8b787",
    "#c45c4a",
    "#d8b787",
    "#4a82c4",
    "#d8b787",
    "#c45c4a",
  ];
  const gap = 5;
  const size = 28;
  const cols = 5;
  const startX = 18;
  const startY = 16;
  const squares = cells
    .map((fill, i) => {
      const x = startX + (i % cols) * (size + gap);
      const y = startY + Math.floor(i / cols) * (size + gap);
      return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="5" fill="${fill}"/>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 200 125" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="200" height="125" fill="#3a2a1c"/>
      <rect x="8" y="8" width="184" height="109" rx="10" fill="#24180f"/>
      ${squares}
    </svg>
  `;
}

function thirtyArt() {
  return `
    <svg viewBox="0 0 200 125" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="200" height="125" fill="#1c2a24"/>
      <path d="M22 96 C 40 40, 80 30, 100 58 S 160 110, 182 48" fill="none" stroke="#c9a36a" stroke-width="8" stroke-linecap="round"/>
      <circle cx="22" cy="96" r="7" fill="#e8b86d"/>
      <circle cx="78" cy="42" r="6" fill="#4a8b7a"/>
      <circle cx="128" cy="78" r="6" fill="#4a8b7a"/>
      <circle cx="182" cy="48" r="7" fill="#e8b86d"/>
      <circle cx="100" cy="62" r="26" fill="#14201b" stroke="#e8b86d" stroke-width="3"/>
      <text x="100" y="72" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-size="22" font-weight="700" fill="#f3ead8">30</text>
    </svg>
  `;
}

function closeArt() {
  return `
    <svg viewBox="0 0 200 125" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="200" height="125" fill="#1a2421"/>
      <rect x="8" y="8" width="184" height="109" rx="10" fill="#121c1a"/>
      <circle cx="100" cy="64" r="46" fill="none" stroke="#e4572e" stroke-width="7"/>
      <circle cx="100" cy="64" r="30" fill="none" stroke="#e0b14a" stroke-width="7"/>
      <circle cx="100" cy="64" r="14" fill="#1d9a7a"/>
      <circle cx="118" cy="48" r="5" fill="#f3ead8"/>
    </svg>
  `;
}

function connectFourArt() {
  const red = "#e0464e";
  const yellow = "#f4c534";
  // Columns bottom-up; red has just landed a rising diagonal.
  const stacks = [[], [yellow], [red, yellow], [yellow, red], [red, yellow, red], [yellow, red, yellow, red], []];
  const win = ["2,0", "3,1", "4,2", "5,3"];
  const cell = 15;
  const x0 = 55;
  const y0 = 25;
  const holes = [];
  const discs = [];
  const rings = [];
  for (let c = 0; c < 7; c++) {
    for (let r = 0; r < 6; r++) {
      const cx = x0 + c * cell;
      const cy = y0 + (5 - r) * cell;
      const fill = stacks[c][r];
      if (fill) {
        discs.push(`<circle cx="${cx}" cy="${cy}" r="5.9" fill="${fill}"/><circle cx="${cx - 1.6}" cy="${cy - 1.9}" r="1.7" fill="#fff" opacity="0.45"/>`);
      } else {
        holes.push(`<circle cx="${cx}" cy="${cy}" r="5.6" fill="#140d08"/>`);
      }
      if (win.includes(`${c},${r}`)) {
        rings.push(
          `<circle cx="${cx}" cy="${cy}" r="6.8" fill="none" stroke="${red}" stroke-opacity="0.45" stroke-width="3.4"/>` +
            `<circle cx="${cx}" cy="${cy}" r="6.6" fill="none" stroke="#fff2d2" stroke-width="1.5"/>`,
        );
      }
    }
  }

  return `
    <svg viewBox="0 0 200 125" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="c4-art-wood" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stop-color="#80573a"/>
          <stop offset="1" stop-color="#3f2715"/>
        </linearGradient>
      </defs>
      <rect width="200" height="125" fill="#2a1f14"/>
      <rect x="8" y="8" width="184" height="109" rx="10" fill="#1c140d"/>
      <ellipse cx="100" cy="115" rx="62" ry="4.5" fill="#000" opacity="0.35"/>
      <rect x="41.5" y="11.5" width="117" height="102" rx="9" fill="url(#c4-art-wood)"/>
      <rect x="41.5" y="11.5" width="117" height="102" rx="9" fill="none" stroke="#f0c98f" stroke-opacity="0.18"/>
      ${holes.join("")}
      ${discs.join("")}
      ${rings.join("")}
    </svg>
  `;
}

function ticTacToeArt() {
  const x = "#e0464e";
  const o = "#5b93e6";
  const size = 100;
  const left = 50;
  const top = 12.5;
  const third = size / 3;
  const center = (i) => [left + third * (i % 3) + third / 2, top + third * Math.floor(i / 3) + third / 2];
  const cross = (i) => {
    const [cx, cy] = center(i);
    const d = 9;
    return `<path d="M${cx - d} ${cy - d}L${cx + d} ${cy + d}M${cx + d} ${cy - d}L${cx - d} ${cy + d}" stroke="${x}" stroke-width="5.5" stroke-linecap="round"/>`;
  };
  const ring = (i) => {
    const [cx, cy] = center(i);
    return `<circle cx="${cx}" cy="${cy}" r="9.5" fill="none" stroke="${o}" stroke-width="5.5"/>`;
  };
  const [sx, sy] = center(0);
  const [ex, ey] = center(8);
  const grid = [1, 2]
    .map((k) => {
      const gx = left + third * k;
      const gy = top + third * k;
      return `<path d="M${gx} ${top + 7}V${top + size - 7}M${left + 7} ${gy}H${left + size - 7}" stroke="#241408" stroke-opacity="0.75" stroke-width="3" stroke-linecap="round"/>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 200 125" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="ttt-art-wood" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stop-color="#86603f"/>
          <stop offset="1" stop-color="#432a17"/>
        </linearGradient>
      </defs>
      <rect width="200" height="125" fill="#1d1a24"/>
      <rect x="8" y="8" width="184" height="109" rx="10" fill="#15131b"/>
      <rect x="${left}" y="${top}" width="${size}" height="${size}" rx="11" fill="url(#ttt-art-wood)"/>
      <rect x="${left}" y="${top}" width="${size}" height="${size}" rx="11" fill="none" stroke="#f0c98f" stroke-opacity="0.18"/>
      ${grid}
      ${cross(0)}${cross(4)}${cross(8)}${ring(2)}${ring(3)}
      <path d="M${sx - 10} ${sy - 10}L${ex + 10} ${ey + 10}" stroke="${x}" stroke-opacity="0.4" stroke-width="9" stroke-linecap="round"/>
      <path d="M${sx - 10} ${sy - 10}L${ex + 10} ${ey + 10}" stroke="#fff2d2" stroke-width="4" stroke-linecap="round"/>
    </svg>
  `;
}

function fallbackArt(accent) {
  return `
    <svg viewBox="0 0 200 125" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="200" height="125" fill="#24180f"/>
      <circle cx="100" cy="62" r="28" fill="${accent}"/>
    </svg>
  `;
}

function showToast(message) {
  toastEl.hidden = false;
  toastEl.textContent = message;
  requestAnimationFrame(() => toastEl.classList.add("is-on"));
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.classList.remove("is-on");
    toastTimer = window.setTimeout(() => {
      toastEl.hidden = true;
      toastEl.textContent = "";
    }, 220);
  }, 3200);
}

function renderTile(game) {
  const isSoon = game.status === "soon";
  const tag = isSoon ? "button" : "a";
  const el = document.createElement(tag);
  el.className = `tile${isSoon ? " is-soon" : ""}`;
  el.style.setProperty("--accent", game.accent);

  if (isSoon) {
    el.type = "button";
    el.setAttribute("aria-label", `${game.title}, coming soon`);
    el.addEventListener("click", () => {
      showToast(game.soonNote || `${game.title} is coming soon.`);
    });
  } else {
    el.href = game.href;
    el.setAttribute("aria-label", `Play ${game.title}`);
  }

  el.innerHTML = `
    <div class="tile-art">
      ${artFor(game)}
      ${isSoon ? `<span class="badge">Soon</span>` : ""}
    </div>
    <div class="tile-body">
      <h3 class="tile-title">${game.title}</h3>
      <p class="tile-blurb">${game.blurb}</p>
      <div class="tile-meta">
        <span class="players">${game.players} players</span>
        <span class="play">${isSoon ? "Soon" : "Play"}</span>
      </div>
    </div>
  `;

  return el;
}

for (const game of games) {
  grid.appendChild(renderTile(game));
}
