import { TEAM_PALETTE } from "./state.js";
import { dealCard, normalize } from "./words/index.js";

export const FINISH = 35;
export const SPACE_COUNT = 36;

function cryptoRandomId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function parseCustomWords(text) {
  const seen = new Set();
  const out = [];
  for (const line of String(text || "").split(/\n/)) {
    const textWord = line.trim();
    if (!textWord) continue;
    const key = normalize(textWord);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(textWord);
  }
  return out;
}

export function createGame(draft) {
  const customWords = parseCustomWords(draft.customWordsText || "");
  const packs = (draft.packs || []).filter((p) => p !== "custom");
  const teams = draft.teams.map((t, i) => ({
    id: `t${i}`,
    name: (t.name || "").trim() || TEAM_PALETTE[i]?.label || `Team ${i + 1}`,
    color: t.color || TEAM_PALETTE[i % TEAM_PALETTE.length].id,
    players: (t.players || []).map((p) => String(p).trim()).filter(Boolean),
    position: 0,
    describerIndex: 0,
  }));
  return {
    id: cryptoRandomId(),
    createdAt: Date.now(),
    teams,
    currentTeamIndex: 0,
    packs,
    customWords,
    customStartCard: customWords.length && packs.length ? 1 + Math.floor(Math.random() * 2) : 0,
    peek: draft.peek !== false,
    timerSec: Number(draft.timerSec) || 30,
    usedWords: [],
    round: null,
    over: false,
    winner: null,
    lastMove: null,
    log: [],
  };
}

export function currentTeam(game) {
  return game.teams[game.currentTeamIndex];
}

export function describerName(team) {
  if (!team?.players?.length) return null;
  return team.players[team.describerIndex % team.players.length];
}

export function paletteFor(colorId) {
  return TEAM_PALETTE.find((c) => c.id === colorId) || TEAM_PALETTE[0];
}

export function dealRound(game) {
  const words = dealCard(game);
  game.round = {
    words: words.map((w) => ({ ...w, guessed: false })),
    phase: game.peek ? "peek" : "countdown",
    timer: null,
    countdownEndsAt: game.peek ? null : Date.now() + 3200,
    locked: false,
  };
  return game.round;
}

export function startPlaying(game) {
  if (!game.round) return;
  game.round.phase = "playing";
  game.round.countdownEndsAt = null;
  game.round.timer = {
    durationSec: game.timerSec,
    endsAt: Date.now() + game.timerSec * 1000,
    paused: false,
  };
}

export function remainingSecs(timer) {
  if (!timer) return 0;
  if (timer.paused) return Math.max(0, Math.floor(timer.remainingSec || 0));
  return Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
}

export function pauseRoundTimer(game) {
  const t = game?.round?.timer;
  if (!t || game.round.phase !== "playing" || t.paused) return false;
  t.remainingSec = remainingSecs(t);
  t.paused = true;
  return true;
}

export function resumeRoundTimer(game) {
  const t = game?.round?.timer;
  if (!t || game.round.phase !== "playing" || !t.paused) return false;
  t.endsAt = Date.now() + Math.max(0, t.remainingSec || 0) * 1000;
  t.paused = false;
  delete t.remainingSec;
  return true;
}

export function toggleGuess(game, idx) {
  if (!game.round) return false;
  if (game.round.phase !== "playing" && game.round.phase !== "done") return false;
  const w = game.round.words[idx];
  if (!w) return false;
  w.guessed = !w.guessed;
  return true;
}

export function scoredCount(round) {
  if (!round?.words) return 0;
  return round.words.filter((w) => w.guessed).length;
}

export function finishRound(game, { lock = false } = {}) {
  if (!game.round) return;
  game.round.phase = "done";
  game.round.timer = null;
  game.round.locked = !!lock;
}

export function applyMove(game) {
  if (!game.round) return { won: false };
  const n = scoredCount(game.round);
  const team = currentTeam(game);
  const from = team.position;
  const to = Math.min(FINISH, from + n);
  team.position = to;
  game.lastMove = { teamId: team.id, from, to, scored: n };
  game.round.words.forEach((w) => {
    const key = normalize(w.text);
    if (!game.usedWords.includes(key)) game.usedWords.push(key);
  });
  game.log.push({ at: Date.now(), teamId: team.id, scored: n, from, to });
  game.round = null;
  if (to >= FINISH) {
    game.over = true;
    game.winner = team.id;
    game.finishedAt = Date.now();
    return { won: true, team, scored: n };
  }
  if (team.players.length) {
    team.describerIndex = (team.describerIndex + 1) % team.players.length;
  }
  game.currentTeamIndex = (game.currentTeamIndex + 1) % game.teams.length;
  return { won: false, team, scored: n };
}

export function historyEntry(game) {
  const winner = game.teams.find((t) => t.id === game.winner);
  return {
    id: game.id,
    finishedAt: game.finishedAt || Date.now(),
    startedAt: game.createdAt,
    winner: game.winner,
    winnerName: winner?.name || "Unknown",
    winnerColor: winner?.color,
    teams: game.teams.map((t) => ({
      name: t.name,
      color: t.color,
      position: t.position,
      players: t.players,
    })),
  };
}
