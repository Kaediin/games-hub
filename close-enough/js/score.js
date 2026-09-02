/**
 * Pure scoring for Close Enough.
 *
 * Distance is |guess - actual| (GeoGuessr-style closeness, not right/wrong).
 *
 * Single participant: record their distance but award neither a win nor a loss.
 * With 2+ guesses, lowest distance(s) win and highest distance(s) lose; ties share.
 * If every guess is the same distance, everyone is both winner and loser.
 * Missing / skipped players are not passed in — they must not appear here at all.
 */

export function distance(guess, actualValue) {
  return Math.abs(Number(guess) - Number(actualValue));
}

export function parseGuess(raw) {
  if (raw == null) return { ok: false, error: "empty" };
  const s = String(raw).trim();
  if (s === "") return { ok: false, error: "empty" };
  if (/inf/i.test(s) || /^nan$/i.test(s)) return { ok: false, error: "invalid" };
  const n = Number(s);
  if (!Number.isFinite(n)) return { ok: false, error: "invalid" };
  if (n < 0) return { ok: false, error: "negative" };
  return { ok: true, value: n };
}

export function formatNumber(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const x = Number(n);
  if (Number.isInteger(x)) return String(x);
  const rounded = Math.round(x * 1000) / 1000;
  return String(rounded);
}

/**
 * @param {{ playerId: string, value: number }[]} guesses
 * @param {number} actualValue
 */
export function scoreRound(guesses, actualValue) {
  const entries = (guesses || []).map((g) => ({
    playerId: g.playerId,
    value: Number(g.value),
    distance: distance(g.value, actualValue),
    isWinner: false,
    isLoser: false,
  }));

  entries.sort((a, b) => a.distance - b.distance || a.playerId.localeCompare(b.playerId));

  if (entries.length === 0) {
    return { entries: [], winnerIds: [], loserIds: [] };
  }

  // One participant: count distance stats but award neither a win nor a loss.
  if (entries.length === 1) {
    return { entries, winnerIds: [], loserIds: [] };
  }

  const min = entries[0].distance;
  const max = entries[entries.length - 1].distance;
  const winnerIds = [];
  const loserIds = [];
  for (const e of entries) {
    if (e.distance === min) {
      e.isWinner = true;
      winnerIds.push(e.playerId);
    }
    if (e.distance === max) {
      e.isLoser = true;
      loserIds.push(e.playerId);
    }
  }

  return { entries, winnerIds, loserIds };
}

export function playerStats(playerId, completedRounds) {
  let roundsParticipated = 0;
  let wins = 0;
  let losses = 0;
  let cumulativeDistance = 0;

  for (const round of completedRounds || []) {
    const row = (round.participants || []).find((p) => p.playerId === playerId);
    if (!row) continue;
    roundsParticipated += 1;
    cumulativeDistance += Number(row.distance);
    if (row.isWinner) wins += 1;
    if (row.isLoser) losses += 1;
  }

  const averageDistance = roundsParticipated === 0 ? null : cumulativeDistance / roundsParticipated;

  return {
    playerId,
    roundsParticipated,
    wins,
    losses,
    cumulativeDistance,
    averageDistance,
  };
}

export function statsForPlayers(players, completedRounds) {
  return (players || []).map((p) => ({
    ...p,
    ...playerStats(p.id, completedRounds),
  }));
}

/**
 * Rank by lowest average distance, then lower total distance, then more rounds.
 * Players with zero rounds are unranked.
 */
export function rankPlayers(players, completedRounds) {
  const rows = statsForPlayers(players, completedRounds);
  const ranked = rows.filter((r) => r.roundsParticipated > 0);
  const unranked = rows.filter((r) => r.roundsParticipated === 0);

  ranked.sort((a, b) => {
    if (a.averageDistance !== b.averageDistance) return a.averageDistance - b.averageDistance;
    if (a.cumulativeDistance !== b.cumulativeDistance) return a.cumulativeDistance - b.cumulativeDistance;
    if (b.roundsParticipated !== a.roundsParticipated) return b.roundsParticipated - a.roundsParticipated;
    return String(a.displayName || a.playerId).localeCompare(String(b.displayName || b.playerId));
  });

  return ranked.map((r, i) => ({ ...r, rank: i + 1 })).concat(unranked.map((r) => ({ ...r, rank: null })));
}

export function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function nameKey(name) {
  return normalizeName(name).toLowerCase();
}
