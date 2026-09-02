import { nameKey, normalizeName, parseGuess, scoreRound } from "./score.js";

export const DEFAULT_UNIT = "grams";

function cryptoRandomId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function playerById(game, id) {
  return (game.players || []).find((p) => p.id === id) || null;
}

export function createGame(names) {
  const players = [];
  const seen = new Set();
  for (const raw of names || []) {
    const displayName = normalizeName(raw);
    if (!displayName) continue;
    const key = nameKey(displayName);
    if (seen.has(key)) continue;
    seen.add(key);
    players.push({
      id: cryptoRandomId(),
      displayName,
      joinedAt: Date.now(),
    });
  }
  return {
    id: cryptoRandomId(),
    createdAt: Date.now(),
    over: false,
    endedAt: null,
    players,
    currentRound: null,
    rounds: [],
    lastUnit: DEFAULT_UNIT,
  };
}

export function duplicateName(game, name, exceptId = null) {
  const key = nameKey(name);
  if (!key) return false;
  return game.players.some((p) => p.id !== exceptId && nameKey(p.displayName) === key);
}

function rosterLocked(game) {
  const status = game.currentRound?.status;
  return status === "guessing" || status === "actual";
}

export function addPlayer(game, name) {
  if (game.over) return { ok: false, error: "Game is over." };
  if (rosterLocked(game)) {
    return { ok: false, error: "Finish the round before adding someone." };
  }
  const displayName = normalizeName(name);
  if (!displayName) return { ok: false, error: "Enter a name." };
  if (duplicateName(game, displayName)) return { ok: false, error: "That name is already in this game." };
  const player = { id: cryptoRandomId(), displayName, joinedAt: Date.now() };
  game.players.push(player);
  return { ok: true, player };
}

export function removePlayer(game, playerId) {
  if (game.over) return { ok: false, error: "Game is over." };
  if (rosterLocked(game)) {
    return { ok: false, error: "Finish the round before removing someone." };
  }
  if (game.players.length <= 1) {
    return { ok: false, error: "You need at least one player." };
  }
  const idx = game.players.findIndex((p) => p.id === playerId);
  if (idx < 0) return { ok: false, error: "Player not found." };
  game.players.splice(idx, 1);
  return { ok: true };
}

export function startRound(game) {
  if (game.over) return { ok: false, error: "Game is over." };
  if (!game.players.length) return { ok: false, error: "Add at least one player." };
  if (game.currentRound && game.currentRound.status !== "revealed") {
    return { ok: false, error: "Finish the current round first." };
  }
  game.currentRound = {
    roundNumber: game.rounds.length + 1,
    objectName: "",
    unit: game.lastUnit || DEFAULT_UNIT,
    status: "naming",
    guesses: [],
    guessOrder: game.players.map((p) => p.id),
    currentGuesserId: null,
    coverOpen: false,
    actualValue: null,
    revealedAt: null,
  };
  return { ok: true };
}

export function setObject(game, objectName, unit) {
  const round = game.currentRound;
  if (!round || round.status !== "naming") {
    return { ok: false, error: "Name the object at the start of a round." };
  }
  const name = normalizeName(objectName);
  if (!name) return { ok: false, error: "Give the object a name." };
  const unitLabel = normalizeName(unit) || DEFAULT_UNIT;
  round.objectName = name;
  round.unit = unitLabel;
  game.lastUnit = unitLabel;
  round.status = "guessing";
  round.guessOrder = game.players.map((p) => p.id);
  round.currentGuesserId = null;
  round.coverOpen = false;
  return { ok: true };
}

function finishIfNonePending(round) {
  round.currentGuesserId = null;
  round.coverOpen = false;
  if (!round.guessOrder.length && round.guesses.length) {
    round.status = "actual";
  }
}

export function pickGuesser(game, playerId) {
  const round = game.currentRound;
  if (!round || round.status !== "guessing") {
    return { ok: false, error: "Not guessing." };
  }
  if (!round.guessOrder.includes(playerId)) {
    return { ok: false, error: "That player already went." };
  }
  round.currentGuesserId = playerId;
  round.coverOpen = false;
  return { ok: true };
}

export function clearGuesser(game) {
  const round = game.currentRound;
  if (!round || round.status !== "guessing") return { ok: false, error: "Not guessing." };
  round.currentGuesserId = null;
  round.coverOpen = false;
  return { ok: true };
}

export function openCover(game) {
  const round = game.currentRound;
  if (!round || round.status !== "guessing" || !round.currentGuesserId) {
    return { ok: false, error: "Pick who is guessing first." };
  }
  round.coverOpen = true;
  return { ok: true };
}

export function closeCover(game) {
  return clearGuesser(game);
}

export function submitGuess(game, rawValue) {
  const round = game.currentRound;
  if (!round) return { ok: false, error: "No active round." };
  if (round.status === "revealed") return { ok: false, error: "This round is already revealed." };
  if (round.status !== "guessing" || !round.coverOpen || !round.currentGuesserId) {
    return { ok: false, error: "Pick who is guessing first." };
  }
  const parsed = parseGuess(rawValue);
  if (!parsed.ok) {
    const msg =
      parsed.error === "negative"
        ? "Guess a number that's zero or more."
        : parsed.error === "empty"
          ? "Enter a guess."
          : "That isn't a valid number.";
    return { ok: false, error: msg };
  }
  const playerId = round.currentGuesserId;
  const existing = round.guesses.find((g) => g.playerId === playerId);
  if (existing) existing.value = parsed.value;
  else round.guesses.push({ playerId, value: parsed.value });
  round.guessOrder = round.guessOrder.filter((id) => id !== playerId);
  finishIfNonePending(round);
  return { ok: true };
}

export function skipPlayer(game, playerId) {
  const round = game.currentRound;
  if (!round || round.status !== "guessing") {
    return { ok: false, error: "Nobody to skip." };
  }
  if (!round.guessOrder.includes(playerId)) {
    return { ok: false, error: "That player already went." };
  }
  if (round.guessOrder.length === 1 && !round.guesses.length) {
    return { ok: false, error: "No guesses have been submitted yet." };
  }
  round.guesses = round.guesses.filter((g) => g.playerId !== playerId);
  round.guessOrder = round.guessOrder.filter((id) => id !== playerId);
  finishIfNonePending(round);
  return { ok: true };
}

export function skipCurrent(game) {
  const round = game.currentRound;
  if (!round?.currentGuesserId) return { ok: false, error: "Nobody to skip." };
  return skipPlayer(game, round.currentGuesserId);
}

export function skipRemaining(game) {
  const round = game.currentRound;
  if (!round || (round.status !== "guessing" && round.status !== "actual")) {
    return { ok: false, error: "Not in a guessing round." };
  }
  if (!round.guesses.length) {
    return { ok: false, error: "No guesses have been submitted yet." };
  }
  round.guessOrder = [];
  round.currentGuesserId = null;
  round.coverOpen = false;
  round.status = "actual";
  return { ok: true };
}

export function revealRound(game, rawActual) {
  const round = game.currentRound;
  if (!round) return { ok: false, error: "No active round." };
  if (round.status === "revealed") return { ok: false, error: "This round is already revealed." };
  if (round.status === "naming") return { ok: false, error: "Name the object first." };
  if (!round.guesses.length) {
    return { ok: false, error: "No guesses have been submitted yet." };
  }
  const parsed = parseGuess(rawActual);
  if (!parsed.ok) {
    const msg =
      parsed.error === "negative"
        ? "The actual value can't be negative."
        : parsed.error === "empty"
          ? "Enter the actual value."
          : "That isn't a valid number.";
    return { ok: false, error: msg };
  }

  const scored = scoreRound(round.guesses, parsed.value);
  const participants = scored.entries.map((e) => {
    const player = playerById(game, e.playerId);
    return {
      playerId: e.playerId,
      displayName: player?.displayName || "Player",
      guess: e.value,
      distance: e.distance,
      isWinner: e.isWinner,
      isLoser: e.isLoser,
    };
  });

  const completed = {
    roundNumber: round.roundNumber,
    objectName: round.objectName,
    unit: round.unit,
    actualValue: parsed.value,
    revealedAt: Date.now(),
    participants,
    winnerIds: scored.winnerIds,
    loserIds: scored.loserIds,
  };

  round.status = "revealed";
  round.actualValue = parsed.value;
  round.revealedAt = completed.revealedAt;
  round.guessOrder = [];
  round.currentGuesserId = null;
  round.coverOpen = false;
  game.rounds.push(completed);
  game.currentRound = { ...round, completed };
  return { ok: true, round: completed };
}

export function nextRound(game) {
  return startRound(game);
}

export function endGame(game) {
  if (game.over) return { ok: false, error: "Already ended." };
  if (game.currentRound && game.currentRound.status !== "revealed") {
    game.currentRound = null;
  }
  game.over = true;
  game.endedAt = Date.now();
  return { ok: true };
}

export function historyEntry(game) {
  return {
    id: game.id,
    startedAt: game.createdAt,
    finishedAt: game.endedAt || Date.now(),
    players: game.players.map((p) => ({ id: p.id, displayName: p.displayName })),
    rounds: game.rounds,
    lastUnit: game.lastUnit,
  };
}

export function guessedCount(round) {
  return round?.guesses?.length || 0;
}

export function expectedCount(game) {
  return game.players?.length || 0;
}
