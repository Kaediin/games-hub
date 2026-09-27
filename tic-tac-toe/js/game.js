// Pure tic-tac-toe rules. No DOM, so it runs under `node --test`.
//
// A round is fully described by who started and the list of moves; the
// board, turn and result are derived from those. Cells are numbered 0–8,
// left to right, top to bottom. Player 0 plays X, player 1 plays O.

export const SIZE = 3;
export const CELLS = SIZE * SIZE;

export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function findWin(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [...line] };
    }
  }
  return null;
}

function derive(starter, moves) {
  const board = Array(CELLS).fill(null);
  let player = starter;
  let win = null;
  for (const cell of moves) {
    board[cell] = player;
    player = player === 0 ? 1 : 0;
    win = findWin(board);
    if (win) break;
  }
  const full = moves.length === CELLS;
  const status = win ? "won" : full ? "draw" : "playing";
  return {
    starter,
    moves: [...moves],
    board,
    turn: status === "playing" ? player : null,
    status,
    winner: win ? win.winner : null,
    line: win ? win.line : [],
  };
}

export function createRound(starter = 0) {
  return derive(starter === 1 ? 1 : 0, []);
}

export function play(round, cell) {
  if (round.status !== "playing") return { ok: false, reason: "over" };
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) return { ok: false, reason: "invalid" };
  if (round.board[cell] !== null) return { ok: false, reason: "taken" };
  return { ok: true, round: derive(round.starter, [...round.moves, cell]) };
}

export function canUndo(round) {
  return round.status === "playing" && round.moves.length > 0;
}

export function undo(round) {
  if (!canUndo(round)) return { ok: false, round };
  return { ok: true, round: derive(round.starter, round.moves.slice(0, -1)) };
}

// Rebuilds a saved round, or returns null if the saved moves are not a
// legal game (tampered storage, or a version mismatch).
export function replay(starter, moves) {
  let round = createRound(starter);
  for (const cell of moves) {
    const res = play(round, cell);
    if (!res.ok) return null;
    round = res.round;
  }
  return round;
}

export function describeMove(cell) {
  const rows = ["top", "middle", "bottom"];
  const cols = ["left", "centre", "right"];
  const r = Math.floor(cell / SIZE);
  const c = cell % SIZE;
  if (r === 1 && c === 1) return "centre";
  if (r === 1) return `middle ${cols[c]}`;
  if (c === 1) return `${rows[r]} centre`;
  return `${rows[r]} ${cols[c]}`;
}

export function winLabel(round) {
  const [a, b] = round.line;
  if (b - a === 1) return "three across";
  if (b - a === 3) return "three down";
  return "three diagonal";
}
