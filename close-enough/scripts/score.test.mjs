import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  distance,
  parseGuess,
  scoreRound,
  playerStats,
  rankPlayers,
  formatNumber,
  tenthOrder,
} from "../js/score.js";
import {
  createGame,
  addPlayer,
  removePlayer,
  startRound,
  setObject,
  pickGuesser,
  openCover,
  submitGuess,
  skipPlayer,
  skipRemaining,
  revealRound,
  nextRound,
} from "../js/game.js";

function playGuess(game, value, playerName = null) {
  const round = game.currentRound;
  const id = playerName
    ? game.players.find((p) => p.displayName === playerName)?.id
    : round.guessOrder[0];
  assert.ok(id, "player to guess");
  assert.equal(pickGuesser(game, id).ok, true);
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

  it("awards n, n-1, n-2 rank points", () => {
    const { entries } = scoreRound(
      [
        { playerId: "alice", value: 450 },
        { playerId: "bob", value: 440 },
        { playerId: "charlie", value: 500 },
      ],
      438
    );
    assert.equal(entries.find((e) => e.playerId === "bob").points, 3);
    assert.equal(entries.find((e) => e.playerId === "alice").points, 2);
    assert.equal(entries.find((e) => e.playerId === "charlie").points, 1);
  });

  it("tied players share a place and the next place is skipped", () => {
    const { entries } = scoreRound(
      [
        { playerId: "alice", value: 12 },
        { playerId: "bob", value: 8 },
        { playerId: "charlie", value: 20 },
        { playerId: "dana", value: 30 },
      ],
      10
    );
    // n=4, Alice & Bob both 2 off (best), Charlie 10, Dana 20
    assert.equal(entries.find((e) => e.playerId === "alice").points, 4);
    assert.equal(entries.find((e) => e.playerId === "bob").points, 4);
    assert.equal(entries.find((e) => e.playerId === "charlie").points, 2);
    assert.equal(entries.find((e) => e.playerId === "dana").points, 1);
  });

  it("adds a tenth-order bonus on an exact guess", () => {
    const { entries } = scoreRound(
      [
        { playerId: "alice", value: 53 },
        { playerId: "bob", value: 50 },
      ],
      53
    );
    const alice = entries.find((e) => e.playerId === "alice");
    assert.equal(alice.isExact, true);
    assert.equal(alice.rankPoints, 2);
    assert.equal(alice.exactBonus, 2);
    assert.equal(alice.points, 4);
    assert.equal(entries.find((e) => e.playerId === "bob").points, 1);
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

  it("single participant: distance and points, no win or loss badge", () => {
    const { entries, winnerIds, loserIds } = scoreRound([{ playerId: "solo", value: 100 }], 90);
    assert.equal(entries[0].distance, 10);
    assert.equal(entries[0].points, 1);
    assert.equal(entries[0].isWinner, false);
    assert.equal(entries[0].isLoser, false);
    assert.deepEqual(winnerIds, []);
    assert.deepEqual(loserIds, []);
  });
});

describe("tenthOrder", () => {
  it("is the digit count of the integer part", () => {
    assert.equal(tenthOrder(9), 1);
    assert.equal(tenthOrder(53), 2);
    assert.equal(tenthOrder(627), 3);
    assert.equal(tenthOrder(3444), 4);
  });
  it("uses the integer part for decimals and treats 0 as 1", () => {
    assert.equal(tenthOrder(9.5), 1);
    assert.equal(tenthOrder(53.2), 2);
    assert.equal(tenthOrder(0), 1);
    assert.equal(tenthOrder(0.4), 1);
  });
});

describe("averages and late joiners", () => {
  const round1 = {
    participants: [
      { playerId: "alice", distance: 12, points: 2, isExact: false, isWinner: false, isLoser: false },
      { playerId: "bob", distance: 2, points: 3, isExact: false, isWinner: true, isLoser: false },
      { playerId: "charlie", distance: 62, points: 1, isExact: false, isWinner: false, isLoser: true },
    ],
  };
  const round2 = {
    participants: [
      { playerId: "alice", distance: 8, points: 2, isExact: false, isWinner: true, isLoser: false },
      { playerId: "bob", distance: 20, points: 1, isExact: false, isWinner: false, isLoser: true },
      { playerId: "david", distance: 4, points: 3, isExact: false, isWinner: false, isLoser: false },
    ],
  };

  it("does not count skipped rounds in averages", () => {
    const david = playerStats("david", [round1, round2]);
    assert.equal(david.roundsParticipated, 1);
    assert.equal(david.averageDistance, 4);
    assert.equal(david.points, 3);
    assert.equal(david.averagePoints, 3);
    assert.equal(david.wins, 0);
    const alice = playerStats("alice", [round1, round2]);
    assert.equal(alice.roundsParticipated, 2);
    assert.equal(alice.averageDistance, 10);
    assert.equal(alice.cumulativeDistance, 20);
    assert.equal(alice.points, 4);
    assert.equal(alice.averagePoints, 2);
  });

  it("late joiners only accumulate rounds they guessed", () => {
    const david = playerStats("david", [round1, round2]);
    assert.equal(david.roundsParticipated, 1);
    assert.equal(david.cumulativeDistance, 4);
    assert.equal(david.points, 3);
  });

  it("ranks by points, then average, then exacts, then lower total difference", () => {
    const players = [
      { id: "alice", displayName: "Alice" },
      { id: "bob", displayName: "Bob" },
      { id: "charlie", displayName: "Charlie" },
      { id: "david", displayName: "David" },
      { id: "erin", displayName: "Erin" },
    ];
    const ranked = rankPlayers(players, [round1, round2]);
    assert.equal(ranked[0].displayName, "Alice");
    assert.equal(ranked[1].displayName, "Bob");
    assert.equal(ranked[2].displayName, "David");
    assert.equal(ranked[3].displayName, "Charlie");
    const erin = ranked.find((r) => r.displayName === "Erin");
    assert.equal(erin.rank, null);
    assert.equal(erin.averagePoints, null);
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
    playGuess(game, 450, "Alice");
    playGuess(game, 440, "Bob");
    playGuess(game, 500, "Charlie");
    const david = game.players.find((p) => p.displayName === "David");
    assert.equal(skipPlayer(game, david.id).ok, true);
    const revealed = revealRound(game, 438);
    assert.equal(revealed.ok, true);
    const round = revealed.round;
    assert.equal(round.participants.length, 3);
    assert.ok(!round.participants.some((p) => p.displayName === "David"));
    assert.deepEqual(round.winnerIds.map((id) => game.players.find((p) => p.id === id).displayName), [
      "Bob",
    ]);
    assert.equal(round.participants.find((p) => p.displayName === "Charlie").isLoser, true);
    assert.equal(round.participants.find((p) => p.displayName === "Bob").points, 3);
    assert.equal(round.participants.find((p) => p.displayName === "Alice").points, 2);
    assert.equal(round.participants.find((p) => p.displayName === "Charlie").points, 1);
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
    assert.equal(david.exactCorrect, 1);
    assert.ok(david.points > 0);
  });

  it("lets any pending player guess next, not list order", () => {
    const game = setupFour();
    playGuess(game, 500, "Charlie");
    playGuess(game, 440, "Bob");
    assert.equal(game.currentRound.guesses[0].playerId, game.players.find((p) => p.displayName === "Charlie").id);
    assert.equal(game.currentRound.guessOrder.includes(game.players.find((p) => p.displayName === "Alice").id), true);
  });

  it("cannot skip the last remaining player when nobody has guessed", () => {
    const game = createGame(["Alice", "Bob"]);
    startRound(game);
    setObject(game, "Mug", "grams");
    const alice = game.players.find((p) => p.displayName === "Alice");
    const bob = game.players.find((p) => p.displayName === "Bob");
    assert.equal(skipPlayer(game, alice.id).ok, true);
    const last = skipPlayer(game, bob.id);
    assert.equal(last.ok, false);
    assert.match(last.error, /No guesses have been submitted yet/);
  });

  it("can add and remove players after a round", () => {
    const game = createGame(["Alice", "Bob"]);
    startRound(game);
    setObject(game, "Mug", "grams");
    playGuess(game, 10, "Alice");
    playGuess(game, 12, "Bob");
    revealRound(game, 11);
    assert.equal(addPlayer(game, "David").ok, true);
    const bob = game.players.find((p) => p.displayName === "Bob");
    assert.equal(removePlayer(game, bob.id).ok, true);
    assert.equal(game.players.map((p) => p.displayName).join(","), "Alice,David");
    assert.equal(removePlayer(game, game.players[0].id).ok, true);
    assert.equal(removePlayer(game, game.players[0].id).ok, false);
  });

  it("can add a player while guesses are open so they can guess this round", () => {
    const game = createGame(["Alice", "Bob"]);
    startRound(game);
    setObject(game, "Mug", "grams");
    playGuess(game, 10, "Alice");
    assert.equal(addPlayer(game, "David").ok, true);
    const david = game.players.find((p) => p.displayName === "David");
    assert.ok(game.currentRound.guessOrder.includes(david.id));
    playGuess(game, 11, "David");
    playGuess(game, 12, "Bob");
    const revealed = revealRound(game, 11);
    assert.equal(revealed.ok, true);
    assert.ok(revealed.round.participants.some((p) => p.displayName === "David"));
  });

  it("discards a removed player's guess from the current round", () => {
    const game = createGame(["Alice", "Bob", "Charlie"]);
    startRound(game);
    setObject(game, "Mug", "grams");
    playGuess(game, 10, "Alice");
    const alice = game.players.find((p) => p.displayName === "Alice");
    assert.equal(removePlayer(game, alice.id).ok, true);
    assert.equal(game.currentRound.guesses.some((g) => g.playerId === alice.id), false);
    playGuess(game, 12, "Bob");
    playGuess(game, 9, "Charlie");
    const revealed = revealRound(game, 11);
    assert.equal(revealed.round.participants.length, 2);
    assert.ok(!revealed.round.participants.some((p) => p.displayName === "Alice"));
  });

  it("reopens guessing when a player is added after everyone has guessed", () => {
    const game = createGame(["Alice", "Bob"]);
    startRound(game);
    setObject(game, "Mug", "grams");
    playGuess(game, 10, "Alice");
    playGuess(game, 12, "Bob");
    assert.equal(game.currentRound.status, "actual");
    assert.equal(addPlayer(game, "David").ok, true);
    assert.equal(game.currentRound.status, "guessing");
    playGuess(game, 11, "David");
    assert.equal(revealRound(game, 11).ok, true);
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
