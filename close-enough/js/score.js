/**
 * Pure scoring for Close Enough.
 *
 * Distance is |guess - actual|. Rank points use competition ranking
 * (ties share a place, the next place is skipped):
 *   1st: n, 2nd: n-1, 3rd: n-2, …
 * where n is the number of guesses that round.
 *
 * An exact guess also gets a bonus equal to the tenth-order (digit count
 * of the integer part) of the actual value: 9 → 1, 53 → 2, 627 → 3.
 *
 * Single participant: record distance and points, but award neither a
 * closest-win nor a furthest-loss badge. Missing / skipped players are
 * not passed in.
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
 * Bonus for an exact guess: digit count of the integer part of the actual
 * value (tenth-order). 0 and values under 1 still count as 1.
 */
export function tenthOrder(actualValue) {
  const n = Number(actualValue);
  if (!Number.isFinite(n)) return 1;
  const integer = Math.floor(Math.abs(n));
  if (integer === 0) return 1;
  return String(integer).length;
}

export function exactBonus(actualValue) {
  return tenthOrder(actualValue);
}

/**
 * @param {{ playerId: string, value: number }[]} guesses
 * @param {number} actualValue
 */
export function scoreRound(guesses, actualValue) {
  const n = (guesses || []).length;
  const bonus = exactBonus(actualValue);
  const entries = (guesses || []).map((g) => ({
    playerId: g.playerId,
    value: Number(g.value),
    distance: distance(g.value, actualValue),
    place: 0,
    rankPoints: 0,
    exactBonus: 0,
    points: 0,
    isExact: false,
    isWinner: false,
    isLoser: false,
  }));

  entries.sort((a, b) => a.distance - b.distance || a.playerId.localeCompare(b.playerId));

  if (entries.length === 0) {
    return { entries: [], winnerIds: [], loserIds: [], guessCount: 0, exactBonusValue: bonus };
  }

  let i = 0;
  while (i < entries.length) {
    let j = i;
    while (j + 1 < entries.length && entries[j + 1].distance === entries[i].distance) j += 1;
    const place = i + 1;
    const rankPoints = n - place + 1;
    for (let k = i; k <= j; k += 1) {
      const e = entries[k];
      e.place = place;
      e.rankPoints = rankPoints;
      e.isExact = e.distance === 0;
      e.exactBonus = e.isExact ? bonus : 0;
      e.points = e.rankPoints + e.exactBonus;
    }
    i = j + 1;
  }

  const winnerIds = [];
  const loserIds = [];

  // One participant: count stats but award neither a closest nor furthest badge.
  if (entries.length === 1) {
    return { entries, winnerIds, loserIds, guessCount: n, exactBonusValue: bonus };
  }

  const min = entries[0].distance;
  const max = entries[entries.length - 1].distance;
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

  return { entries, winnerIds, loserIds, guessCount: n, exactBonusValue: bonus };
}

export function playerStats(playerId, completedRounds) {
  let roundsParticipated = 0;
  let wins = 0;
  let losses = 0;
  let points = 0;
  let exactCorrect = 0;
  let cumulativeDistance = 0;

  for (const round of completedRounds || []) {
    const row = (round.participants || []).find((p) => p.playerId === playerId);
    if (!row) continue;
    roundsParticipated += 1;
    cumulativeDistance += Number(row.distance);
    points += Number(row.points) || 0;
    if (row.isExact || row.distance === 0) exactCorrect += 1;
    if (row.isWinner) wins += 1;
    if (row.isLoser) losses += 1;
  }

  const averageDistance = roundsParticipated === 0 ? null : cumulativeDistance / roundsParticipated;
  const averagePoints = roundsParticipated === 0 ? null : points / roundsParticipated;

  return {
    playerId,
    roundsParticipated,
    wins,
    losses,
    points,
    averagePoints,
    exactCorrect,
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
 * Rank by most points, then higher average, then more exacts, then
 * lower total difference. Players with zero rounds are unranked.
 */
export function rankPlayers(players, completedRounds) {
  const rows = statsForPlayers(players, completedRounds);
  const ranked = rows.filter((r) => r.roundsParticipated > 0);
  const unranked = rows.filter((r) => r.roundsParticipated === 0);

  ranked.sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.averagePoints !== b.averagePoints) return b.averagePoints - a.averagePoints;
    if (a.exactCorrect !== b.exactCorrect) return b.exactCorrect - a.exactCorrect;
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
