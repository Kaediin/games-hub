import { WORD_LIST } from "./words.js";
import { shuffle } from "./ui.js";

export const TILE_COLORS = ["red", "blue", "neutral", "assassin"];

export function generateGame({ teams, spymasters, excludeWords }) {
  const startingTeam = Math.random() < 0.5 ? "red" : "blue";
  const otherTeam = startingTeam === "red" ? "blue" : "red";
  const pool = excludeWords?.size
    ? WORD_LIST.filter((w) => !excludeWords.has(w))
    : WORD_LIST;
  const words = shuffle(pool).slice(0, 25);
  // Build colour list: 9 starting team, 8 other, 7 neutral, 1 assassin.
  const colours = [
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(otherTeam),
    ...Array(7).fill("neutral"),
    "assassin",
  ];
  const colourOrder = shuffle(colours);
  const tiles = words.map((word, i) => ({
    word,
    color: colourOrder[i],
    revealed: false,
  }));
  return {
    id: cryptoRandomId(),
    createdAt: Date.now(),
    teams,
    spymasters,
    tiles,
    startingTeam,
    currentTeam: startingTeam,
    scores: {
      red: tiles.filter((t) => t.color === "red").length,
      blue: tiles.filter((t) => t.color === "blue").length,
    },
    revealedCounts: { red: 0, blue: 0 },
    timer: null, // { endsAt, durationSec, paused, remainingSec }
    over: false,
    winner: null,
    winReason: null, // "found-all" | "assassin"
    log: [], // [{ at, team, action, ... }]
  };
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function revealTile(game, idx) {
  const tile = game.tiles[idx];
  if (!tile || tile.revealed || game.over) return { changed: false };
  tile.revealed = true;
  const turnTeam = game.currentTeam;
  let endTurn = false;
  let outcome = "wrong"; // for sound categorisation: team|wrong|neutral|assassin
  if (tile.color === "assassin") {
    game.over = true;
    game.winner = turnTeam === "red" ? "blue" : "red";
    game.winReason = "assassin";
    outcome = "assassin";
  } else if (tile.color === "neutral") {
    endTurn = true;
    outcome = "neutral";
  } else if (tile.color === turnTeam) {
    game.revealedCounts[turnTeam]++;
    outcome = "team";
    if (game.revealedCounts[turnTeam] >= game.scores[turnTeam]) {
      game.over = true;
      game.winner = turnTeam;
      game.winReason = "found-all";
    }
  } else {
    // other team
    game.revealedCounts[tile.color]++;
    endTurn = true;
    outcome = "wrong";
    if (game.revealedCounts[tile.color] >= game.scores[tile.color]) {
      game.over = true;
      game.winner = tile.color;
      game.winReason = "found-all";
    }
  }
  game.log.push({
    at: Date.now(),
    team: turnTeam,
    action: "reveal",
    word: tile.word,
    color: tile.color,
    outcome,
  });
  if (game.over) {
    game.timer = null;
  } else if (endTurn) {
    switchTurn(game);
  }
  return { changed: true, outcome, endedTurn: endTurn, gameOver: game.over };
}

export function switchTurn(game) {
  game.currentTeam = game.currentTeam === "red" ? "blue" : "red";
  game.timer = null; // timer is per turn
  game.log.push({ at: Date.now(), team: game.currentTeam, action: "turn-start" });
}

export function endTurnManually(game) {
  if (game.over) return;
  game.log.push({ at: Date.now(), team: game.currentTeam, action: "end-turn-manual" });
  switchTurn(game);
}

// ----- Encoding for the spymaster QR -----
// Encodes the 25 words, their colours, and the spymaster names into a
// compact base64 string so the phone view can label tabs by name.
// Format: JSON { s: "r"|"b", t: [["word", "r"|"b"|"n"|"a"], ...],
//                m: { r: "Alice", b: "Bob" } } -> base64url.
// `m` is optional for backwards-compat with payloads written before
// spymaster names were included.
export function encodeKeyPayload(game) {
  const map = { red: "r", blue: "b", neutral: "n", assassin: "a" };
  const arr = game.tiles.map((t) => [t.word, map[t.color]]);
  const payload = {
    s: game.startingTeam[0],
    t: arr,
    m: { r: game.spymasters?.red || "", b: game.spymasters?.blue || "" },
  };
  return base64UrlEncode(JSON.stringify(payload));
}

export function decodeKeyPayload(payload) {
  const json = base64UrlDecode(payload);
  const { s, t, m } = JSON.parse(json);
  const inverse = { r: "red", b: "blue", n: "neutral", a: "assassin" };
  return {
    startingTeam: s === "r" ? "red" : "blue",
    tiles: t.map(([word, c]) => ({ word, color: inverse[c] })),
    spymasters: { red: m?.r || "", blue: m?.b || "" },
  };
}

function base64UrlEncode(str) {
  // Use TextEncoder to handle any unicode chars in player-named words.
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
