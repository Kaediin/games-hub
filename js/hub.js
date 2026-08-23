import { games } from "./games.js";

const grid = document.getElementById("game-grid");
const toastEl = document.getElementById("toast");
let toastTimer = 0;

function artFor(game) {
  if (game.id === "codenames") return codenamesArt();
  if (game.id === "thirty-seconds") return thirtyArt();
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
