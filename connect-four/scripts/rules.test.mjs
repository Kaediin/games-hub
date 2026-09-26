import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COLS,
  ROWS,
  createRound,
  play,
  undo,
  canUndo,
  replay,
  landingRow,
  findWin,
  describeMove,
  winLabel,
} from "../js/game.js";
import { createMatch, recordResult } from "../../shared/match.js";

function playAll(moves, starter = 0) {
  let round = createRound(starter);
  for (const col of moves) {
    const res = play(round, col);
    assert.equal(res.ok, true, `column ${col} should be legal (${res.reason})`);
    round = res.round;
  }
  return round;
}

// A legal 42-move game that fills the board with no four in a row.
const DRAW = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 4, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 5];

describe("new round", () => {
  it("starts empty with the starter to move", () => {
    const r = createRound(1);
    assert.equal(r.grid.length, COLS);
    assert.equal(r.grid.every((col) => col.length === 0), true);
    assert.equal(r.turn, 1);
    assert.equal(r.status, "playing");
  });

  it("stacks discs from the bottom and alternates turns", () => {
    const r = playAll([3, 3, 3]);
    assert.deepEqual(r.grid[3], [0, 1, 0]);
    assert.equal(landingRow(r, 3), 3);
    assert.deepEqual(r.placed[2], { col: 3, row: 2, player: 0 });
    assert.equal(r.turn, 1);
  });
});

describe("wins in every direction", () => {
  it("horizontal", () => {
    const r = playAll([0, 0, 1, 1, 2, 2, 3]);
    assert.equal(r.status, "won");
    assert.equal(r.winner, 0);
    assert.deepEqual(r.line, [[0, 0], [1, 0], [2, 0], [3, 0]]);
    assert.equal(winLabel(r), "four across");
  });

  it("horizontal for the second player", () => {
    const r = playAll([0, 1, 0, 2, 0, 3, 6, 4]);
    assert.equal(r.status, "won");
    assert.equal(r.winner, 1);
    assert.deepEqual(r.line, [[1, 0], [2, 0], [3, 0], [4, 0]]);
  });

  it("vertical", () => {
    const r = playAll([3, 4, 3, 4, 3, 4, 3]);
    assert.equal(r.status, "won");
    assert.equal(r.winner, 0);
    assert.deepEqual(r.line, [[3, 0], [3, 1], [3, 2], [3, 3]]);
    assert.equal(winLabel(r), "four stacked");
  });

  it("rising diagonal", () => {
    const r = playAll([0, 1, 1, 2, 3, 2, 2, 3, 6, 3, 3]);
    assert.equal(r.status, "won");
    assert.equal(r.winner, 0);
    assert.deepEqual(r.line, [[0, 0], [1, 1], [2, 2], [3, 3]]);
    assert.equal(winLabel(r), "four diagonal");
  });

  it("falling diagonal", () => {
    const r = playAll([6, 5, 5, 4, 3, 4, 4, 3, 0, 3, 3]);
    assert.equal(r.status, "won");
    assert.equal(r.winner, 0);
    assert.deepEqual(r.line, [[3, 3], [4, 2], [5, 1], [6, 0]]);
    assert.equal(winLabel(r), "four diagonal");
  });

  it("filling a gap highlights all five in the row", () => {
    const r = playAll([0, 0, 1, 1, 3, 3, 4, 4, 2]);
    assert.equal(r.status, "won");
    assert.equal(r.line.length, 5);
    assert.deepEqual(r.line.map(([c]) => c), [0, 1, 2, 3, 4]);
  });

  it("three in a row is not a win", () => {
    const r = playAll([0, 0, 1, 1, 2]);
    assert.equal(r.status, "playing");
    assert.equal(findWin(r.grid), null);
  });

  it("findWin agrees with the move-by-move check", () => {
    const r = playAll([3, 4, 3, 4, 3, 4, 3]);
    const scan = findWin(r.grid);
    assert.equal(scan.winner, 0);
    assert.deepEqual(scan.lines[0], r.line);
  });
});

describe("full columns", () => {
  it("rejects a seventh disc in a column", () => {
    const r = playAll([0, 0, 0, 0, 0, 0]);
    assert.equal(r.grid[0].length, ROWS);
    assert.equal(landingRow(r, 0), -1);
    assert.deepEqual(play(r, 0), { ok: false, reason: "full" });
    assert.equal(play(r, 1).ok, true);
  });

  it("rejects columns off the board", () => {
    const r = createRound();
    assert.equal(play(r, -1).reason, "invalid");
    assert.equal(play(r, 7).reason, "invalid");
    assert.equal(play(r, 2.5).reason, "invalid");
    assert.equal(landingRow(r, 9), -1);
  });
});

describe("draws", () => {
  it("a full board with no four in a row is a draw", () => {
    const r = playAll(DRAW);
    assert.equal(r.moves.length, COLS * ROWS);
    assert.equal(r.status, "draw");
    assert.equal(r.winner, null);
    assert.equal(r.turn, null);
    assert.equal(findWin(r.grid), null);
  });

  it("no moves after a draw", () => {
    assert.deepEqual(play(playAll(DRAW), 0), { ok: false, reason: "over" });
  });
});

describe("undo", () => {
  it("steps back as far as you like", () => {
    let r = playAll([3, 3, 4, 2]);
    r = undo(r).round;
    assert.deepEqual(r.moves, [3, 3, 4]);
    assert.deepEqual(r.grid[2], []);
    assert.equal(r.turn, 1);
    while (canUndo(r)) r = undo(r).round;
    assert.deepEqual(r.moves, []);
    assert.equal(r.turn, 0);
    assert.equal(undo(r).ok, false);
  });

  it("frees a full column again", () => {
    let r = playAll([0, 0, 0, 0, 0, 0]);
    r = undo(r).round;
    assert.equal(landingRow(r, 0), 5);
    assert.equal(play(r, 0).ok, true);
  });

  it("keeps the round's starter", () => {
    let r = playAll([3, 4], 1);
    r = undo(undo(r).round).round;
    assert.equal(r.starter, 1);
    assert.equal(r.turn, 1);
  });

  it("is off once the round is won or drawn", () => {
    const won = playAll([3, 4, 3, 4, 3, 4, 3]);
    assert.equal(canUndo(won), false);
    assert.equal(undo(won).ok, false);
    assert.equal(canUndo(playAll(DRAW)), false);
  });
});

describe("replay", () => {
  it("rebuilds a saved round", () => {
    const r = replay(1, [3, 3, 2]);
    assert.deepEqual(r.grid[3], [1, 0]);
    assert.deepEqual(r.grid[2], [1]);
    assert.equal(r.turn, 0);
  });

  it("returns null for impossible move lists", () => {
    assert.equal(replay(0, [0, 0, 0, 0, 0, 0, 0]), null);
    assert.equal(replay(0, [3, 4, 3, 4, 3, 4, 3, 4]), null);
    assert.equal(replay(0, [9]), null);
  });
});

describe("starter alternation across a match", () => {
  it("the first move alternates every scored round", () => {
    let match = createMatch();
    const openers = [];
    for (const moves of [[0, 0, 1, 1, 2, 2, 3], DRAW, [3, 4, 3, 4, 3, 4, 3]]) {
      const round = playAll(moves, match.starter);
      openers.push(round.placed[0].player);
      match = recordResult(match, round.status === "won" ? round.winner : null);
    }
    assert.deepEqual(openers, [0, 1, 0]);
    assert.deepEqual(match.wins, [2, 0]);
    assert.equal(match.draws, 1);
    assert.equal(match.starter, 1);
  });
});

describe("describeMove", () => {
  it("names columns from 1", () => {
    assert.equal(describeMove(0), "column 1");
    assert.equal(describeMove(6), "column 7");
  });
});
