import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  distance,
  parseGuess,
  scoreRound,
  playerStats,
  rankPlayers,
  formatNumber,
} from "../js/score.js";
import {
  createGame,
  addPlayer,
  startRound,
  setObject,
  openCover,
  submitGuess,
  skipCurrent,
  skipRemaining,
  revealRound,
  nextRound,
} from "../js/game.js";

function playGuess(game, value) {
  assert.equal(openCover(game).ok, true);
  const r = submitGuess(game, value);
  assert.equal(r.ok, true, r.error);
}

describe("distance", () => {
  it("is absolute difference", () => {
    assert.equal(distance(450, 438), 12);
    assert.equal(distance(440, 438), 2);
    assert.equal(distance(400, 438), 38);
    assert.equal(distance(438, 438), 0);
  });
});

describe("parseGuess", () => {
  it("accepts integers and decimals", () => {
    assert.deepEqual(parseGuess("438"), { ok: true, value: 438 });
    assert.deepEqual(parseGuess(" 12.5 "), { ok: true, value: 12.5 });
    assert.deepEqual(parseGuess("0"), { ok: true, value: 0 });
  });
  it("rejects empty, non-numeric, Infinity, NaN, negatives", () => {
    assert.equal(parseGuess("").ok, false);
    assert.equal(parseGuess("  ").ok, false);
    assert.equal(parseGuess("abc").ok, false);
    assert.equal(parseGuess("Infinity").ok, false);
    assert.equal(parseGuess("NaN").ok, false);
    assert.equal(parseGuess("-1").ok, false);
  });
});

describe("scoreRound", () => {
  it("picks closest winner and furthest loser (acceptance scenario)", () => {
    const { entries, winnerIds, loserIds } = scoreRound(
      [
        { playerId: "alice", value: 450 },
        { playerId: "bob", value: 440 },
        { playerId: "charlie", value: 500 },
      ],
      438
    );
    assert.equal(entries.find((e) => e.playerId === "alice").distance, 12);
    assert.equal(entries.find((e) => e.playerId === "bob").distance, 2);
    assert.equal(entries.find((e) => e.playerId === "charlie").distance, 62);
    assert.deepEqual(winnerIds, ["bob"]);
    assert.deepEqual(loserIds, ["charlie"]);
  });

  it("shares wins and losses on ties", () => {
    const { winnerIds, loserIds } = scoreRound(
      [
        { playerId: "a", value: 10 },
        { playerId: "b", value: 10 },
        { playerId: "c", value: 20 },
        { playerId: "d", value: 20 },
      ],
      10
    );
    assert.deepEqual(winnerIds.sort(), ["a", "b"]);
    assert.deepEqual(loserIds.sort(), ["c", "d"]);
  });

  it("omits missing guesses — they are simply not passed in", () => {
    const { entries } = scoreRound(
      [
        { playerId: "alice", value: 450 },
        { playerId: "bob", value: 440 },
      ],
      438
    );
    assert.equal(entries.some((e) => e.playerId === "david"), false);
    assert.equal(entries.length, 2);
  });

  it("single participant: distance only, no win or loss", () => {
    const { entries, winnerIds, loserIds } = scoreRound([{ playerId: "solo", value: 100 }], 90);
    assert.equal(entries[0].distance, 10);
    assert.equal(entries[0].isWinner, false);
    assert.equal(entries[0].isLoser, false);
    assert.deepEqual(winnerIds, []);
    assert.deepEqual(loserIds, []);
  });
});

describe("averages and late joiners", () => {
  const round1 = {
    participants: [
      { playerId: "alice", distance: 12, isWinner: false, isLoser: false },
      { playerId: "bob", distance: 2, isWinner: true, isLoser: false },
      { playerId: "charlie", distance: 62, isWinner: false, isLoser: true },
    ],
  };
  const round2 = {
    participants: [
      { playerId: "alice", distance: 8, isWinner: true, isLoser: false },
      { playerId: "bob", distance: 20, isWinner: false, isLoser: true },
      { playerId: "david", distance: 4, isWinner: false, isLoser: false },
    ],
  };

  it("does not count skipped rounds in averages", () => {
    const david = playerStats("david", [round1, round2]);
    assert.equal(david.roundsParticipated, 1);
    assert.equal(david.averageDistance, 4);
    assert.equal(david.wins, 0);
    const alice = playerStats("alice", [round1, round2]);
    assert.equal(alice.roundsParticipated, 2);
    assert.equal(alice.averageDistance, 10);
    assert.equal(alice.cumulativeDistance, 20);
  });

  it("late joiners only accumulate rounds they guessed", () => {
    const david = playerStats("david", [round1, round2]);
    assert.equal(david.roundsParticipated, 1);
    assert.equal(david.cumulativeDistance, 4);
  });

  it("ranks by lowest average, then total, then more rounds", () => {
    const players = [
      { id: "alice", displayName: "Alice" },
      { id: "bob", displayName: "Bob" },
      { id: "charlie", displayName: "Charlie" },
      { id: "david", displayName: "David" },
      { id: "erin", displayName: "Erin" },
    ];
    const ranked = rankPlayers(players, [round1, round2]);
    assert.equal(ranked[0].displayName, "David");
    assert.equal(ranked[1].displayName, "Alice");
    assert.equal(ranked[2].displayName, "Bob");
    const erin = ranked.find((r) => r.displayName === "Erin");
    assert.equal(erin.rank, null);
    assert.equal(erin.averageDistance, null);
  });
});

describe("game mutations", () => {
  function setupFour() {
    const game = createGame(["Alice", "Bob", "Charlie", "David"]);
    assert.equal(startRound(game).ok, true);
    assert.equal(setObject(game, "TV Remote", "grams").ok, true);
    return game;
  }

  it("acceptance: David omitted, Bob wins, Charlie loses", () => {
    const game = setupFour();
    playGuess(game, 450); // Alice
    playGuess(game, 440); // Bob
    playGuess(game, 500); // Charlie
    assert.equal(skipCurrent(game).ok, true); // David
    const revealed = revealRound(game, 438);
    assert.equal(revealed.ok, true);
    const round = revealed.round;
    assert.equal(round.participants.length, 3);
    assert.ok(!round.participants.some((p) => p.displayName === "David"));
    assert.deepEqual(round.winnerIds.map((id) => game.players.find((p) => p.id === id).displayName), [
      "Bob",
    ]);
    assert.equal(round.participants.find((p) => p.displayName === "Charlie").isLoser, true);
  });

  it("rejects guess mutation after reveal", () => {
    const game = setupFour();
    playGuess(game, 1);
    playGuess(game, 2);
    skipRemaining(game);
    assert.equal(revealRound(game, 1).ok, true);
    const again = submitGuess(game, 99);
    assert.equal(again.ok, false);
    const twice = revealRound(game, 2);
    assert.equal(twice.ok, false);
  });

  it("cannot reveal with zero guesses", () => {
    const game = setupFour();
    const r = revealRound(game, 438);
    assert.equal(r.ok, false);
    assert.match(r.error, /No guesses have been submitted yet/);
  });

  it("late joiner misses round 1 and plays round 2", () => {
    const game = createGame(["Alice", "Bob"]);
    startRound(game);
    setObject(game, "Mug", "grams");
    playGuess(game, 10);
    playGuess(game, 12);
    revealRound(game, 11);
    addPlayer(game, "David");
    nextRound(game);
    setObject(game, "Spoon", "grams");
    playGuess(game, 5);
    playGuess(game, 9);
    playGuess(game, 6);
    revealRound(game, 6);
    const david = playerStats(game.players.find((p) => p.displayName === "David").id, game.rounds);
    assert.equal(david.roundsParticipated, 1);
    assert.equal(david.averageDistance, 0);
  });

  it("cannot skip the last remaining player when nobody has guessed", () => {
    const game = createGame(["Alice", "Bob"]);
    startRound(game);
    setObject(game, "Mug", "grams");
    assert.equal(skipCurrent(game).ok, true);
    const last = skipCurrent(game);
    assert.equal(last.ok, false);
    assert.match(last.error, /No guesses have been submitted yet/);
  });

  it("duplicate names are rejected case-insensitively", () => {
    const game = createGame(["Alice"]);
    const r = addPlayer(game, "alice");
    assert.equal(r.ok, false);
  });
});

describe("formatNumber", () => {
  it("trims floats", () => {
    assert.equal(formatNumber(12), "12");
    assert.equal(formatNumber(12.5), "12.5");
  });
});
