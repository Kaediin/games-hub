import { getSettings, saveSettings } from "./store.js";
import { PALETTE, NAME_MAX, loadPlayers, savePlayers, displayName, colorHex, shade, alpha } from "./players.js";
import { createMatch, recordResult, loadMatch, saveMatch } from "./match.js";
import { sound } from "./sound.js";
import { haptic, hapticsSupported } from "./haptics.js";
import { burstConfetti } from "./confetti.js";
import { initTheme, setTheme } from "./theme.js";
import { loadSession, saveSession, keepAwake } from "./session.js";

// The shared two-player shell: setup screen, player panels, menu, result
// sheet, tabletop mode, scoring and persistence. A game supplies its pure
// rules module, a piece icon and a board; everything else lives here so
// both games look and behave the same.
//
// game = {
//   id, title, tagline, howTo,
//   rules: { createRound(starter), replay(starter, moves), play(round, move),
//            undo(round), describeMove(move) },
//   piece(seat) -> SVG markup for a player's piece,
//   seatNote(seat) -> short label shown on the setup card,
//   moveSound, mountBoard(host, api) -> { render(round, opts) -> Promise, winOrigin() },
// }

const ICONS = {
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  home: '<path d="M3.5 11.2 12 4l8.5 7.2"/><path d="M5.8 9.6v9.9h12.4V9.6"/><path d="M10 19.5v-5.2h4v5.2"/>',
  restart: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>',
  users:
    '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path d="M15.6 4.8a3.4 3.4 0 0 1 0 6.4"/><path d="M18.2 14.3a6.2 6.2 0 0 1 3 5.7"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.34-5.66"/><path d="M4 4v5h5"/><path d="M12 8.5v4l2.5 1.5"/>',
  sound: '<path d="M11 5 6.5 9H3.5v6h3L11 19z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6"/><path d="M18.4 6.2a8.5 8.5 0 0 1 0 11.6"/>',
  haptics: '<rect x="7.5" y="3" width="9" height="18" rx="2.4"/><path d="M3.5 9v6M20.5 9v6"/>',
  tabletop:
    '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 6.2v3.6M10.4 7.8 12 6.2l1.6 1.6"/><path d="M12 17.8v-3.6M10.4 16.2l1.6 1.6 1.6-1.6"/>',
  theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
  chevron: '<path d="m6 9.5 6 6 6-6"/>',
  forward: '<path d="m9.5 6 6 6-6 6"/>',
  back: '<path d="m14.5 6-6 6 6 6"/>',
  check: '<path d="m5.5 12.5 4 4 9-9"/>',
};

function icon(name) {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
}

const DEFS = `
  <svg class="duel-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      ${[0, 1]
        .map(
          (s) => `
        <radialGradient id="duel-disc-${s}" cx="0.36" cy="0.3" r="0.78">
          <stop offset="0" style="stop-color: var(--p${s}-hi)"/>
          <stop offset="0.5" style="stop-color: var(--p${s})"/>
          <stop offset="1" style="stop-color: var(--p${s}-lo)"/>
        </radialGradient>
        <linearGradient id="duel-ridge-${s}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color: var(--p${s}-lo)"/>
          <stop offset="1" style="stop-color: var(--p${s}-hi)"/>
        </linearGradient>
        <linearGradient id="duel-stroke-${s}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style="stop-color: var(--p${s}-hi)"/>
          <stop offset="0.45" style="stop-color: var(--p${s})"/>
          <stop offset="1" style="stop-color: var(--p${s}-lo)"/>
        </linearGradient>`,
        )
        .join("")}
    </defs>
  </svg>`;

function shellMarkup(game) {
  const swatches = (seat) =>
    PALETTE.map(
      (c) => `
      <button type="button" class="swatch" role="radio" data-seat="${seat}" data-color="${c.id}"
        style="--swatch: ${c.hex}; --swatch-hi: ${shade(c.hex, 0.45)}; --swatch-lo: ${shade(c.hex, -0.3)}"
        aria-label="${c.name}">
        <span class="swatch-dot">${icon("check")}</span>
      </button>`,
    ).join("");

  const card = (seat) => `
    <section class="player-card" data-seat="${seat}" aria-labelledby="card-title-${seat}">
      <div class="player-card-head">
        <span class="player-card-piece">${game.piece(seat)}</span>
        <div class="player-card-heading">
          <h2 class="player-card-title" id="card-title-${seat}">Player ${seat + 1}</h2>
          <p class="player-card-note">${game.seatNote(seat)}</p>
        </div>
      </div>
      <label class="name-field">
        <span class="visually-hidden">Player ${seat + 1} name</span>
        <input class="name-input" data-seat="${seat}" type="text" maxlength="${NAME_MAX}"
          placeholder="Player ${seat + 1}" autocomplete="off" autocapitalize="words"
          spellcheck="false" enterkeyhint="${seat === 0 ? "next" : "go"}" />
      </label>
      <div class="swatches" role="radiogroup" aria-label="Player ${seat + 1} colour">${swatches(seat)}</div>
    </section>`;

  const panel = (seat) => `
    <section class="panel" data-seat="${seat}">
      <button class="icon-btn panel-tool" type="button" data-action="menu" data-from="${seat}" aria-label="Menu">${icon("menu")}</button>
      <span class="panel-piece">${game.piece(seat)}</span>
      <div class="panel-id">
        <span class="panel-name"></span>
        <span class="panel-status"><i class="panel-dot" aria-hidden="true"></i><span class="panel-status-text">Your move</span></span>
      </div>
      <div class="panel-score" aria-label="Wins">
        <span class="panel-score-num">0</span>
        <span class="panel-score-label">wins</span>
      </div>
      <button class="icon-btn panel-tool" type="button" data-action="undo" aria-label="Undo">${icon("undo")}</button>
    </section>`;

  const resultCard = (seat) => `
    <div class="result-card" data-seat="${seat}" role="group" aria-label="Round result">
      <button class="result-head" type="button" data-action="toggle-result" aria-expanded="true">
        <span class="result-badge"></span>
        <span class="result-titles">
          <span class="result-kicker"></span>
          <span class="result-title"></span>
        </span>
        <span class="result-chevron">${icon("chevron")}</span>
      </button>
      <div class="result-body">
        <div class="result-score"></div>
        <div class="result-actions">
          <button class="btn btn-ghost" type="button" data-action="new-match">New match</button>
          <button class="btn btn-primary" type="button" data-action="next-round">Next round</button>
        </div>
      </div>
    </div>`;

  const toggle = (setting, label, iconName, note = "") => `
    <button class="menu-row" type="button" role="switch" data-setting="${setting}" aria-checked="false">
      <span class="menu-row-icon">${icon(iconName)}</span>
      <span class="menu-row-text"><span class="menu-row-label">${label}</span>${note ? `<span class="menu-row-note">${note}</span>` : ""}</span>
      <span class="switch" aria-hidden="true"><span class="switch-knob"></span></span>
    </button>`;

  return `
    ${DEFS}
    <section class="screen screen-setup" data-view="setup" aria-label="${game.title} setup">
      <header class="setup-top">
        <a class="back-link" href="../">${icon("back")}<span>Playground</span></a>
        <button class="icon-btn" type="button" data-action="menu" data-from="0" aria-label="Menu">${icon("menu")}</button>
      </header>
      <div class="setup-body">
        <div class="setup-hero">
          <p class="eyebrow">2 players · 1 device</p>
          <h1 class="setup-title">${game.title}</h1>
          <p class="setup-tagline">${game.tagline}</p>
        </div>
        <div class="setup-cards">
          ${card(0)}
          <span class="versus" aria-hidden="true">vs</span>
          ${card(1)}
        </div>
        <button class="btn btn-primary btn-start" type="button" data-action="start">Start match</button>
        <p class="setup-howto">${game.howTo}</p>
      </div>
    </section>

    <section class="screen screen-play" data-view="play" aria-label="${game.title}">
      <div class="bar">
        <div class="bar-start">
          <button class="icon-btn" type="button" data-action="menu" data-from="0" aria-label="Menu">${icon("menu")}</button>
        </div>
        <div class="bar-title">
          <span class="bar-game">${game.title}</span>
          <span class="bar-round"></span>
        </div>
        <div class="bar-end">
          <button class="btn btn-chip" type="button" data-action="undo">${icon("undo")}<span>Undo</span></button>
        </div>
      </div>
      ${panel(1)}
      <main class="stage">
        <div class="board-wrap"></div>
      </main>
      ${panel(0)}
    </section>

    <div class="result-layer" data-state="hidden">
      ${resultCard(0)}
      ${resultCard(1)}
    </div>

    <div class="sheet-layer" data-facing="0" inert>
      <div class="scrim" data-action="close-menu"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="menu-title">
        <div class="sheet-grip" aria-hidden="true"></div>
        <header class="sheet-head">
          <h2 id="menu-title">${game.title}</h2>
          <button class="icon-btn" type="button" data-action="close-menu" aria-label="Close menu">${icon("close")}</button>
        </header>
        <div class="sheet-grid">
          <div class="menu-actions play-only">
            <button class="menu-tile" type="button" data-action="new-round">${icon("restart")}<span>New round</span></button>
            <button class="menu-tile" type="button" data-action="players">${icon("users")}<span>Players</span></button>
            <button class="menu-tile" type="button" data-action="reset-match">${icon("reset")}<span class="menu-tile-label">Reset match</span></button>
          </div>
          <div class="menu-settings">
            ${toggle("sound", "Sound", "sound")}
            ${hapticsSupported ? toggle("haptics", "Haptics", "haptics") : ""}
            ${toggle("tabletop", "Tabletop mode", "tabletop", "Lay it flat between you")}
            <div class="menu-row menu-row-theme">
              <span class="menu-row-icon">${icon("theme")}</span>
              <span class="menu-row-text"><span class="menu-row-label" id="theme-label">Theme</span></span>
              <div class="segmented" role="radiogroup" aria-labelledby="theme-label">
                <button type="button" role="radio" data-theme-mode="system">Auto</button>
                <button type="button" role="radio" data-theme-mode="light">Light</button>
                <button type="button" role="radio" data-theme-mode="dark">Dark</button>
              </div>
            </div>
          </div>
          <a class="menu-row menu-home" href="../">
            <span class="menu-row-icon">${icon("home")}</span>
            <span class="menu-row-text"><span class="menu-row-label">Back to hub</span></span>
            <span class="menu-row-go">${icon("forward")}</span>
          </a>
        </div>
      </div>
    </div>

    <div class="visually-hidden" aria-live="polite" data-live></div>
  `;
}

export function startDuel(game) {
  const root = document.getElementById("app");
  const html = document.documentElement;
  root.innerHTML = shellMarkup(game);

  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => [...root.querySelectorAll(sel)];
  const els = {
    setup: $(".screen-setup"),
    play: $(".screen-play"),
    stage: $(".stage"),
    boardWrap: $(".board-wrap"),
    barRound: $(".bar-round"),
    panels: [$('.panel[data-seat="0"]'), $('.panel[data-seat="1"]')],
    inputs: [$('.name-input[data-seat="0"]'), $('.name-input[data-seat="1"]')],
    start: $(".btn-start"),
    resultLayer: $(".result-layer"),
    resultCards: $$(".result-card"),
    sheetLayer: $(".sheet-layer"),
    sheet: $(".sheet"),
    resetLabel: $(".menu-tile-label"),
    live: $("[data-live]"),
  };

  const { rules } = game;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sideLayout = window.matchMedia("(min-aspect-ratio: 5/4)");

  let players = loadPlayers();
  let match = loadMatch(game.id);
  const session = loadSession(game.id);
  let round = (session && rules.replay(session.starter, session.moves)) || rules.createRound(match.starter);
  let screen = session?.screen === "play" ? "play" : "setup";
  let setupMode = match.round > 1 || round.moves.length ? "edit" : "start";
  let shownWins = [...match.wins];
  let epoch = 0;
  let timers = [];
  let resetArmed = 0;
  let lastFocus = null;

  const name = (seat) => displayName(players, seat);
  const roundNumber = () => (round.status === "playing" ? match.round : match.round - 1);

  function announce(msg) {
    els.live.textContent = "";
    requestAnimationFrame(() => {
      els.live.textContent = msg;
    });
  }

  function later(fn, ms) {
    const id = setTimeout(fn, ms);
    timers.push(id);
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
    epoch += 1;
  }

  function persist() {
    saveSession(game.id, { screen, starter: round.starter, moves: round.moves });
  }

  // ---------- colours, names, panels ----------

  function applyColors() {
    const style = html.style;
    players.forEach((p, i) => {
      const hex = colorHex(p.color);
      style.setProperty(`--p${i}`, hex);
      style.setProperty(`--p${i}-hi`, shade(hex, 0.5));
      style.setProperty(`--p${i}-lo`, shade(hex, -0.32));
      style.setProperty(`--p${i}-deep`, shade(hex, -0.55));
      style.setProperty(`--p${i}-glow`, alpha(hex, 0.5));
      style.setProperty(`--p${i}-soft`, alpha(hex, 0.16));
    });
  }

  function renderNames() {
    els.panels.forEach((panel, seat) => {
      panel.querySelector(".panel-name").textContent = name(seat);
      panel.setAttribute("aria-label", name(seat));
    });
  }

  function renderScores(bumpSeat = null) {
    els.panels.forEach((panel, seat) => {
      const num = panel.querySelector(".panel-score-num");
      num.textContent = String(shownWins[seat]);
      if (seat === bumpSeat) {
        num.classList.remove("is-bump");
        void num.offsetWidth;
        num.classList.add("is-bump");
      }
    });
  }

  function renderTurn() {
    const playing = round.status === "playing";
    els.panels.forEach((panel, seat) => {
      const isTurn = playing && round.turn === seat;
      const isWinner = round.status === "won" && round.winner === seat;
      panel.classList.toggle("is-turn", isTurn);
      panel.classList.toggle("is-winner", isWinner);
      panel.classList.toggle("is-idle", !isTurn && !isWinner);
      const status = panel.querySelector(".panel-status-text");
      status.textContent = isWinner ? "Winner" : round.status === "draw" ? "Draw" : "Your move";
      panel.classList.toggle("has-status", isTurn || isWinner || round.status === "draw");
    });
    const canUndo = playing && round.moves.length > 0;
    $$('[data-action="undo"]').forEach((b) => {
      b.disabled = !canUndo;
    });
    const n = roundNumber();
    els.barRound.textContent = match.draws
      ? `Round ${n} · ${match.draws} ${match.draws === 1 ? "draw" : "draws"}`
      : `Round ${n}`;
    els.play.dataset.status = round.status;
  }

  function renderPlay() {
    renderNames();
    renderScores();
    renderTurn();
  }

  // ---------- setup screen ----------

  function renderSetup() {
    els.inputs.forEach((input, seat) => {
      if (document.activeElement !== input) input.value = players[seat].name;
    });
    $$(".swatch").forEach((sw) => {
      const seat = Number(sw.dataset.seat);
      const other = seat === 0 ? 1 : 0;
      const selected = players[seat].color === sw.dataset.color;
      const taken = players[other].color === sw.dataset.color;
      const colorName = PALETTE.find((c) => c.id === sw.dataset.color).name;
      sw.setAttribute("aria-checked", String(selected));
      sw.classList.toggle("is-taken", taken);
      sw.setAttribute("aria-disabled", String(taken));
      sw.tabIndex = selected ? 0 : -1;
      sw.setAttribute("aria-label", taken ? `${colorName}, taken by ${name(other)}` : colorName);
      sw.dataset.takenBy = taken ? String(other + 1) : "";
    });
    els.start.textContent = setupMode === "edit" ? "Back to game" : "Start match";
  }

  function pickColor(seat, colorId) {
    const other = seat === 0 ? 1 : 0;
    if (players[other].color === colorId) {
      sound.play("invalid");
      haptic("invalid");
      const sw = $(`.swatch[data-seat="${seat}"][data-color="${colorId}"]`);
      sw?.classList.remove("is-shake");
      void sw?.offsetWidth;
      sw?.classList.add("is-shake");
      return;
    }
    if (players[seat].color === colorId) return;
    players[seat] = { ...players[seat], color: colorId };
    players = savePlayers(players);
    applyColors();
    renderSetup();
    sound.play("tap");
    haptic("tap");
  }

  function startFromSetup() {
    players = savePlayers(
      players.map((p, i) => ({ ...p, name: els.inputs[i].value.trim().slice(0, NAME_MAX) })),
    );
    if (setupMode === "start") {
      clearTimers();
      match = createMatch();
      saveMatch(game.id, match);
      shownWins = [...match.wins];
      round = rules.createRound(match.starter);
      board.render(round, { animate: false });
      hideResult();
    }
    setupMode = "edit";
    showScreen("play");
    sound.play("start");
    haptic("tap");
    announce(`${name(round.turn ?? 0)} starts.`);
  }

  // ---------- screens ----------

  function showScreen(next) {
    screen = next;
    root.dataset.screen = next;
    els.setup.inert = next !== "setup";
    els.play.inert = next !== "play";
    keepAwake(next === "play");
    if (next === "setup") {
      renderSetup();
      hideResult(true);
    } else {
      renderPlay();
      if (round.status !== "playing") showResult("open");
    }
    persist();
  }

  // ---------- moves ----------

  function play(move) {
    if (screen !== "play" || round.status !== "playing") return false;
    const res = rules.play(round, move);
    if (!res.ok) {
      sound.play("invalid");
      haptic("invalid");
      return false;
    }
    const mover = round.turn;
    round = res.round;
    if (round.status !== "playing") {
      match = recordResult(match, round.status === "won" ? round.winner : null);
      saveMatch(game.id, match);
    }
    persist();
    renderTurn();
    const landed = board.render(round, { animate: !reduceMotion.matches });
    if (round.status === "playing") {
      announce(`${name(mover)}: ${rules.describeMove(move)}. ${name(round.turn)} to move.`);
    } else {
      const token = epoch;
      Promise.resolve(landed).then(() => {
        if (token === epoch) celebrate();
      });
    }
    return true;
  }

  function celebrate() {
    const token = epoch;
    shownWins = [...match.wins];
    if (round.status === "won") {
      const hex = colorHex(players[round.winner].color);
      const origin = board.winOrigin?.() || {};
      burstConfetti({ color: hex, x: origin.x, y: origin.y });
      sound.play("win");
      haptic("win");
      renderScores(round.winner);
      announce(`${name(round.winner)} wins round ${roundNumber()}.`);
    } else {
      sound.play("draw");
      haptic("draw");
      renderScores();
      announce(`Round ${roundNumber()} is a draw.`);
    }
    renderTurn();
    later(
      () => {
        if (token === epoch) showResult("open");
      },
      round.status === "won" ? 1150 : 650,
    );
  }

  function undo() {
    if (screen !== "play" || round.status !== "playing" || !round.moves.length) return;
    const res = rules.undo(round);
    if (!res.ok) return;
    round = res.round;
    persist();
    board.render(round, { animate: !reduceMotion.matches });
    renderTurn();
    sound.play("undo");
    haptic("undo");
    announce(`Move undone. ${name(round.turn)} to move.`);
  }

  function newRound() {
    const hadPieces = round.moves.length > 0;
    const starter = round.status === "playing" ? round.starter : match.starter;
    clearTimers();
    hideResult();
    shownWins = [...match.wins];
    round = rules.createRound(starter);
    persist();
    board.render(round, { animate: !reduceMotion.matches });
    renderPlay();
    if (hadPieces) sound.play("clear");
    haptic("tap");
    announce(`Round ${roundNumber()}. ${name(round.turn)} starts.`);
  }

  function resetMatch() {
    clearTimers();
    hideResult();
    const hadPieces = round.moves.length > 0;
    match = createMatch();
    saveMatch(game.id, match);
    shownWins = [...match.wins];
    round = rules.createRound(match.starter);
    persist();
    board.render(round, { animate: !reduceMotion.matches });
    renderPlay();
    if (hadPieces) sound.play("clear");
    announce(`Match reset. ${name(round.turn)} starts.`);
  }

  function newMatch() {
    clearTimers();
    match = createMatch();
    saveMatch(game.id, match);
    shownWins = [...match.wins];
    round = rules.createRound(match.starter);
    board.render(round, { animate: false });
    setupMode = "start";
    hideResult(true);
    showScreen("setup");
    sound.play("tap");
  }

  // ---------- result sheet ----------

  function scoreRow(viewer) {
    const seats = viewer === 0 ? [0, 1] : [1, 0];
    const side = (seat) => `
      <span class="rs" style="--sc: var(--p${seat})">
        <i class="rs-dot" aria-hidden="true"></i>
        <span class="rs-name">${escapeHtml(name(seat))}</span>
        <b class="rs-num">${match.wins[seat]}</b>
      </span>`;
    const draws = match.draws ? `<span class="rs-draws">${match.draws} ${match.draws === 1 ? "draw" : "draws"}</span>` : "";
    return `${side(seats[0])}<span class="rs-sep" aria-hidden="true"></span>${side(seats[1])}${draws}`;
  }

  function fillResult() {
    const tabletop = getSettings().tabletop;
    const won = round.status === "won";
    const w = round.winner;
    els.resultCards.forEach((card) => {
      const viewer = Number(card.dataset.seat);
      let title;
      if (!won) title = "It’s a draw";
      else if (tabletop) title = w === viewer ? "You win!" : `${name(w)} wins`;
      else title = `${name(w)} wins!`;
      card.style.setProperty("--wc", won ? `var(--p${w})` : "var(--amber)");
      card.style.setProperty("--wc-glow", won ? `var(--p${w}-glow)` : "rgba(232, 184, 109, 0.45)");
      card.querySelector(".result-title").textContent = title;
      card.querySelector(".result-kicker").textContent = won
        ? `Round ${roundNumber()} · ${rules.winLabel?.(round) ?? "winner"}`
        : `Round ${roundNumber()} · board full`;
      card.querySelector(".result-badge").innerHTML = won
        ? game.piece(w)
        : `<span class="result-badge-pair">${game.piece(0)}${game.piece(1)}</span>`;
      card.querySelector(".result-score").innerHTML = scoreRow(viewer);
    });
  }

  // The stage's size never depends on its own padding, so padding it by the
  // card overlap is enough to keep the whole board (and winning line) clear.
  function cardEdge(seat, state) {
    const card = els.resultCards[seat];
    const cs = getComputedStyle(card);
    const peek = cs.getPropertyValue("--peek").trim();
    const visible = state === "peek" && peek.endsWith("px") ? parseFloat(peek) : card.offsetHeight;
    return seat === 0 ? window.innerHeight - parseFloat(cs.bottom) - visible : parseFloat(cs.top) + visible;
  }

  // In tabletop landscape the cards sit beside the board, one per side column,
  // narrowing the board only when a column is too slim for a card.
  function fitSideCards(stage) {
    const [c0, c1] = els.resultCards.map((card) => getComputedStyle(card));
    const ar = parseFloat(getComputedStyle(els.stage).getPropertyValue("--board-ar")) || 1;
    const boardW = Math.min(stage.width, stage.height * ar);
    const insetL = parseFloat(c0.left) || 10;
    const insetR = parseFloat(c1.right) || 10;
    const gap = (window.innerWidth - boardW) / 2 - Math.max(insetL, insetR) - 12;
    const width = Math.min(320, Math.max(220, gap));
    const left = Math.max(0, insetL + width + 12 - stage.left);
    const right = Math.max(0, stage.right - (window.innerWidth - insetR - width - 12));
    const cap = stage.width * 0.3;
    return { width, left: Math.min(left, cap), right: Math.min(right, cap) };
  }

  function fitResult() {
    const state = els.resultLayer.dataset.state;
    const tabletop = !!getSettings().tabletop;
    const pad = { top: 0, bottom: 0, left: 0, right: 0 };
    let cardWidth = 0;
    if (state !== "hidden" && screen === "play") {
      const stage = els.stage.getBoundingClientRect();
      if (tabletop && sideLayout.matches) {
        const fit = fitSideCards(stage);
        cardWidth = fit.width;
        pad.left = fit.left;
        pad.right = fit.right;
      } else {
        const room = stage.height * 0.7;
        pad.bottom = Math.max(0, stage.bottom - (cardEdge(0, state) - 10));
        if (tabletop) pad.top = Math.max(0, cardEdge(1, state) + 10 - stage.top);
        if (pad.top + pad.bottom > room) {
          const scale = room / (pad.top + pad.bottom);
          pad.top *= scale;
          pad.bottom *= scale;
        }
      }
    }
    for (const side of Object.keys(pad)) {
      els.stage.style.setProperty(`--result-${side}`, `${Math.round(pad[side])}px`);
    }
    if (cardWidth) els.resultLayer.style.setProperty("--card-w", `${Math.floor(cardWidth)}px`);
    else els.resultLayer.style.removeProperty("--card-w");
  }

  function showResult(state) {
    if (state !== "hidden") fillResult();
    els.resultLayer.dataset.state = state;
    root.dataset.result = state;
    fitResult();
    els.resultLayer.inert = state === "hidden";
    els.resultCards.forEach((card) => {
      card.querySelector(".result-head").setAttribute("aria-expanded", String(state === "open"));
    });
    if (state === "open" && screen === "play") {
      const seat = getSettings().tabletop ? (round.winner ?? 0) : 0;
      const btn = els.resultCards[seat]?.querySelector('[data-action="next-round"]');
      if (btn && document.activeElement?.closest(".board-wrap")) btn.focus({ preventScroll: true });
    }
  }

  function hideResult(instant = false) {
    if (instant) {
      els.resultLayer.classList.add("no-anim");
      requestAnimationFrame(() => requestAnimationFrame(() => els.resultLayer.classList.remove("no-anim")));
    }
    showResult("hidden");
  }

  // ---------- menu ----------

  function renderMenu() {
    const settings = getSettings();
    $$(".menu-row[data-setting]").forEach((row) => {
      row.setAttribute("aria-checked", String(!!settings[row.dataset.setting]));
    });
    $$("[data-theme-mode]").forEach((b) => {
      b.setAttribute("aria-checked", String(settings.theme === b.dataset.themeMode));
    });
    disarmReset();
  }

  function openMenu(from = 0) {
    lastFocus = document.activeElement;
    renderMenu();
    const tabletop = getSettings().tabletop && screen === "play";
    els.sheetLayer.dataset.facing = tabletop && from === 1 ? "1" : "0";
    els.sheetLayer.inert = false;
    els.sheetLayer.classList.add("is-open");
    els.setup.inert = true;
    els.play.inert = true;
    els.resultLayer.inert = true;
    sound.play("tap");
    haptic("tap");
    requestAnimationFrame(() => els.sheet.querySelector(".sheet-head .icon-btn").focus({ preventScroll: true }));
  }

  function closeMenu() {
    if (!els.sheetLayer.classList.contains("is-open")) return;
    els.sheetLayer.classList.remove("is-open");
    els.sheetLayer.inert = true;
    els.setup.inert = screen !== "setup";
    els.play.inert = screen !== "play";
    els.resultLayer.inert = els.resultLayer.dataset.state === "hidden";
    disarmReset();
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  function disarmReset() {
    clearTimeout(resetArmed);
    resetArmed = 0;
    els.resetLabel.textContent = "Reset match";
    els.resetLabel.parentElement.classList.remove("is-armed");
  }

  function armOrReset() {
    if (resetArmed) {
      disarmReset();
      closeMenu();
      resetMatch();
      return;
    }
    els.resetLabel.textContent = "Tap to confirm";
    els.resetLabel.parentElement.classList.add("is-armed");
    haptic("tap");
    resetArmed = setTimeout(disarmReset, 3200);
  }

  function applyTabletop() {
    const on = !!getSettings().tabletop;
    html.dataset.tabletop = on ? "on" : "off";
    board.layout?.();
    if (els.resultLayer.dataset.state !== "hidden") fillResult();
    fitResult();
  }

  function toggleSetting(key) {
    const next = !getSettings()[key];
    saveSettings({ [key]: next });
    renderMenu();
    if (key === "tabletop") applyTabletop();
    if (key === "sound" && next) sound.play("tap");
    else if (key === "haptics" && next) haptic("tap");
    else sound.play("tap");
  }

  // ---------- events ----------

  root.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action], [data-setting], [data-theme-mode], .swatch");
    if (!target || target.disabled) return;

    if (target.classList.contains("swatch")) {
      pickColor(Number(target.dataset.seat), target.dataset.color);
      return;
    }
    if (target.dataset.setting) {
      toggleSetting(target.dataset.setting);
      return;
    }
    if (target.dataset.themeMode) {
      setTheme(target.dataset.themeMode);
      renderMenu();
      sound.play("tap");
      return;
    }

    switch (target.dataset.action) {
      case "menu":
        openMenu(Number(target.dataset.from || 0));
        break;
      case "close-menu":
        closeMenu();
        break;
      case "undo":
        undo();
        break;
      case "start":
        startFromSetup();
        break;
      case "new-round":
        closeMenu();
        newRound();
        break;
      case "players":
        closeMenu();
        setupMode = "edit";
        showScreen("setup");
        break;
      case "reset-match":
        armOrReset();
        break;
      case "next-round":
        newRound();
        break;
      case "new-match":
        newMatch();
        break;
      case "toggle-result":
        showResult(els.resultLayer.dataset.state === "open" ? "peek" : "open");
        sound.play("tap");
        break;
    }
  });

  els.inputs.forEach((input, seat) => {
    input.addEventListener("input", () => {
      players[seat] = { ...players[seat], name: input.value.slice(0, NAME_MAX) };
      players = savePlayers(players);
      renderNames();
      renderSetup();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (seat === 0) els.inputs[1].focus();
      else {
        input.blur();
        startFromSetup();
      }
    });
  });

  root.addEventListener("keydown", (e) => {
    const sw = e.target.closest?.(".swatch");
    if (!sw || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const group = [...sw.parentElement.children];
    const dir = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
    let i = group.indexOf(sw);
    for (let step = 0; step < group.length; step++) {
      i = (i + dir + group.length) % group.length;
      if (!group[i].classList.contains("is-taken")) break;
    }
    group[i].focus();
    pickColor(Number(sw.dataset.seat), group[i].dataset.color);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMenu();
      return;
    }
    const menuOpen = els.sheetLayer.classList.contains("is-open");
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && screen === "play" && !menuOpen) {
      e.preventDefault();
      undo();
    }
  });

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitResult, 120);
  });

  // iOS ignores user-scalable=no; stop pinch-zoom from knocking the board around.
  document.addEventListener("gesturestart", (e) => {
    if (screen === "play") e.preventDefault();
  });

  // ---------- boot ----------

  initTheme();
  sound.init();
  applyColors();

  const board = game.mountBoard(els.boardWrap, {
    play,
    round: () => round,
    sound,
    haptic,
    reducedMotion: () => reduceMotion.matches,
    sideways: () => !!getSettings().tabletop,
    colors: () => players.map((p) => colorHex(p.color)),
    name,
  });

  applyTabletop();
  board.render(round, { animate: false });
  renderSetup();
  showScreen(screen);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-ready")));
  document.fonts?.ready.then(fitResult);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
