import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LINES,
  createRound,
  play,
  undo,
  canUndo,
  replay,
  findWin,
  describeMove,
  winLabel,
} from "../js/game.js";
import { createMatch, recordResult, sanitizeMatch } from "../../shared/match.js";

function playAll(moves, starter = 0) {
  let round = createRound(starter);
  for (const cell of moves) {
    const res = play(round, cell);
    assert.equal(res.ok, true, `move ${cell} should be legal`);
    round = res.round;
  }
  return round;
}

// Builds a move list where `winner` completes `line` and the loser's
// moves avoid every line, so the win lands on the last move.
function movesForWin(line, winner, starter) {
  const others = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((c) => !line.includes(c));
  const loserMoves = [];
  for (const cell of others) {
    const trial = [...loserMoves, cell];
    const blocksNothing = !LINES.some((l) => l.every((c) => trial.includes(c)));
    if (blocksNothing) loserMoves.push(cell);
    if (loserMoves.length === 3) break;
  }
  const moves = [];
  let turn = starter;
  let w = 0;
  let l = 0;
  while (w < 3) {
    if (turn === winner) moves.push(line[w++]);
    else moves.push(loserMoves[l++]);
    turn = turn === 0 ? 1 : 0;
  }
  return moves;
}

describe("new round", () => {
  it("starts empty with the starter to move", () => {
    const r0 = createRound(0);
    assert.equal(r0.board.every((c) => c === null), true);
    assert.equal(r0.turn, 0);
    assert.equal(r0.status, "playing");
    assert.equal(createRound(1).turn, 1);
  });

  it("alternates turns", () => {
    const r = playAll([4, 0], 1);
    assert.equal(r.board[4], 1);
    assert.equal(r.board[0], 0);
    assert.equal(r.turn, 1);
  });
});

describe("wins in every direction", () => {
  const names = ["top row", "middle row", "bottom row", "left column", "middle column", "right column", "diagonal", "anti-diagonal"];
  LINES.forEach((line, i) => {
    for (const winner of [0, 1]) {
      it(`${names[i]} for player ${winner + 1}`, () => {
        const moves = movesForWin(line, winner, winner);
        const round = playAll(moves, winner);
        assert.equal(round.status, "won");
        assert.equal(round.winner, winner);
        assert.deepEqual(round.line, line);
        assert.equal(round.turn, null);
      });
    }
  });

  it("labels the winning line", () => {
    assert.equal(winLabel(playAll(movesForWin([0, 1, 2], 0, 0))), "three across");
    assert.equal(winLabel(playAll(movesForWin([1, 4, 7], 0, 0))), "three down");
    assert.equal(winLabel(playAll(movesForWin([2, 4, 6], 0, 0))), "three diagonal");
  });

  it("the second player can win too", () => {
    const round = playAll([0, 4, 1, 2, 8, 6], 0);
    assert.equal(round.status, "won");
    assert.equal(round.winner, 1);
    assert.deepEqual(round.line, [2, 4, 6]);
  });

  it("findWin sees nothing on an empty or mixed board", () => {
    assert.equal(findWin(Array(9).fill(null)), null);
    assert.equal(findWin([0, 1, 0, 0, 1, 1, 1, 0, 0]), null);
  });
});

describe("draws", () => {
  it("a full board with no line is a draw", () => {
    // X O X / X O O / O X X
    const round = playAll([0, 1, 2, 4, 3, 5, 7, 6, 8], 0);
    assert.equal(round.status, "draw");
    assert.equal(round.winner, null);
    assert.equal(round.turn, null);
    assert.deepEqual(round.line, []);
  });

  it("a win on the ninth move is a win, not a draw", () => {
    // X O X / O X O / O X X — X completes 0-4-8 with the last cell.
    const round = playAll([4, 1, 2, 6, 7, 3, 0, 5, 8], 0);
    assert.equal(round.moves.length, 9);
    assert.equal(round.status, "won");
    assert.equal(round.winner, 0);
    assert.deepEqual(round.line, [0, 4, 8]);
  });
});

describe("illegal moves", () => {
  it("rejects a taken cell", () => {
    const r = playAll([4]);
    assert.deepEqual(play(r, 4), { ok: false, reason: "taken" });
  });

  it("rejects cells off the board", () => {
    const r = createRound();
    assert.equal(play(r, -1).ok, false);
    assert.equal(play(r, 9).ok, false);
    assert.equal(play(r, 1.5).ok, false);
  });

  it("rejects moves after the round is decided", () => {
    const r = playAll(movesForWin([0, 1, 2], 0, 0));
    assert.deepEqual(play(r, 8), { ok: false, reason: "over" });
  });
});

describe("undo", () => {
  it("steps back one move at a time, as far as you like", () => {
    let r = playAll([4, 0, 8, 2]);
    r = undo(r).round;
    assert.deepEqual(r.moves, [4, 0, 8]);
    assert.equal(r.board[2], null);
    assert.equal(r.turn, 1);
    r = undo(undo(undo(r).round).round).round;
    assert.deepEqual(r.moves, []);
    assert.equal(r.turn, 0);
    assert.equal(canUndo(r), false);
    assert.equal(undo(r).ok, false);
  });

  it("keeps the round's starter", () => {
    let r = playAll([4, 0], 1);
    r = undo(undo(r).round).round;
    assert.equal(r.turn, 1);
    assert.equal(r.starter, 1);
  });

  it("is off once the round is won or drawn", () => {
    const won = playAll(movesForWin([0, 4, 8], 1, 1), 1);
    assert.equal(canUndo(won), false);
    assert.equal(undo(won).ok, false);
    const drawn = playAll([0, 1, 2, 4, 3, 5, 7, 6, 8]);
    assert.equal(canUndo(drawn), false);
  });
});

describe("replay", () => {
  it("rebuilds a saved round", () => {
    const r = replay(1, [4, 0, 8]);
    assert.deepEqual(r.moves, [4, 0, 8]);
    assert.equal(r.turn, 0);
    assert.equal(r.board[4], 1);
  });

  it("returns null for an impossible move list", () => {
    assert.equal(replay(0, [4, 4]), null);
    assert.equal(replay(0, [0, 3, 1, 4, 2, 5]), null);
  });
});

describe("starter alternation across a match", () => {
  it("flips the starter after every scored round, win or draw", () => {
    let match = createMatch();
    assert.equal(match.starter, 0);
    const starters = [];
    for (const result of [0, null, 1, 1]) {
      starters.push(match.starter);
      assert.equal(createRound(match.starter).turn, match.starter);
      match = recordResult(match, result);
    }
    assert.deepEqual(starters, [0, 1, 0, 1]);
    assert.deepEqual(match.wins, [1, 2]);
    assert.equal(match.draws, 1);
    assert.equal(match.round, 5);
    assert.equal(match.starter, 0);
  });

  it("sanitizes a damaged saved match", () => {
    assert.deepEqual(sanitizeMatch({ wins: [2, "x"], draws: -1, round: 0, starter: 7 }), {
      wins: [2, 0],
      draws: 0,
      round: 1,
      starter: 0,
    });
    assert.deepEqual(sanitizeMatch(null), createMatch());
  });
});

describe("describeMove", () => {
  it("names cells for screen readers", () => {
    assert.equal(describeMove(0), "top left");
    assert.equal(describeMove(4), "centre");
    assert.equal(describeMove(5), "middle right");
    assert.equal(describeMove(7), "bottom centre");
  });
});
