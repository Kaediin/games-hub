import { read, write } from "./store.js";

// A match is the running score between the two players for one game.
// `starter` is who opens the round currently being played; it flips every
// time a round is scored, win or draw, so the first move alternates.

export function createMatch() {
  return { wins: [0, 0], draws: 0, round: 1, starter: 0 };
}

export function recordResult(match, winner) {
  const wins = [...match.wins];
  let draws = match.draws;
  if (winner === 0 || winner === 1) wins[winner] += 1;
  else draws += 1;
  return {
    wins,
    draws,
    round: match.round + 1,
    starter: match.starter === 0 ? 1 : 0,
  };
}

function count(n) {
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export function sanitizeMatch(raw) {
  if (!raw || typeof raw !== "object") return createMatch();
  const wins = Array.isArray(raw.wins) ? raw.wins : [];
  return {
    wins: [count(wins[0]), count(wins[1])],
    draws: count(raw.draws),
    round: Math.max(1, count(raw.round)),
    starter: raw.starter === 1 ? 1 : 0,
  };
}

export function loadMatch(gameId) {
  return sanitizeMatch(read(`${gameId}.match`, null));
}

export function saveMatch(gameId, match) {
  write(`${gameId}.match`, match);
}
