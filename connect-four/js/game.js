// Pure Connect 4 rules. No DOM, so it runs under `node --test`.
//
// A round is fully described by who started and the list of columns
// played; the grid, turn and result are derived from those. The grid is
// stored as columns, each a stack from the bottom up, so grid[col][row]
// with row 0 at the bottom.

export const COLS = 7;
export const ROWS = 6;
export const CONNECT = 4;

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

function at(grid, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return grid[col][row] ?? null;
}

// Every line of four or more through (col, row), as arrays of [col, row].
export function linesThrough(grid, col, row) {
  const player = at(grid, col, row);
  if (player === null) return [];
  const lines = [];
  for (const [dc, dr] of DIRECTIONS) {
    const cells = [[col, row]];
    for (const sign of [1, -1]) {
      let c = col + dc * sign;
      let r = row + dr * sign;
      while (at(grid, c, r) === player) {
        cells.push([c, r]);
        c += dc * sign;
        r += dr * sign;
      }
    }
    if (cells.length >= CONNECT) {
      cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      lines.push(cells);
    }
  }
  return lines;
}

// Scans the whole grid. Used to validate saved rounds and in tests.
export function findWin(grid) {
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < grid[col].length; row++) {
      const lines = linesThrough(grid, col, row);
      if (lines.length) return { winner: grid[col][row], lines };
    }
  }
  return null;
}

function derive(starter, moves) {
  const grid = Array.from({ length: COLS }, () => []);
  const placed = [];
  let player = starter;
  let lines = [];
  for (const col of moves) {
    const row = grid[col].length;
    grid[col].push(player);
    placed.push({ col, row, player });
    lines = linesThrough(grid, col, row);
    player = player === 0 ? 1 : 0;
    if (lines.length) break;
  }
  const won = lines.length > 0;
  const full = moves.length === COLS * ROWS;
  const status = won ? "won" : full ? "draw" : "playing";
  const line = [];
  for (const cells of lines) {
    for (const cell of cells) {
      if (!line.some(([c, r]) => c === cell[0] && r === cell[1])) line.push(cell);
    }
  }
  return {
    starter,
    moves: [...moves],
    grid,
    placed,
    turn: status === "playing" ? player : null,
    status,
    winner: won ? placed[placed.length - 1].player : null,
    lines,
    line,
  };
}

export function createRound(starter = 0) {
  return derive(starter === 1 ? 1 : 0, []);
}

export function landingRow(round, col) {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return -1;
  const height = round.grid[col].length;
  return height < ROWS ? height : -1;
}

export function play(round, col) {
  if (round.status !== "playing") return { ok: false, reason: "over" };
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return { ok: false, reason: "invalid" };
  if (landingRow(round, col) === -1) return { ok: false, reason: "full" };
  return { ok: true, round: derive(round.starter, [...round.moves, col]) };
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
  for (const col of moves) {
    const res = play(round, col);
    if (!res.ok) return null;
    round = res.round;
  }
  return round;
}

export function describeMove(col) {
  return `column ${col + 1}`;
}

export function winLabel(round) {
  const cells = round.lines[0];
  if (!cells) return "four in a row";
  const [[c1, r1], [c2, r2]] = cells;
  if (r1 === r2) return "four across";
  if (c1 === c2) return "four stacked";
  return "four diagonal";
}
