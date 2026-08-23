import { FINISH, SPACE_COUNT } from "./game.js";

const COLS = 9;
const ROWS = 4;
export const VIEW_W = 1000;
export const VIEW_H = 560;

// Same 36 spaces, same snake order (0 -> FINISH) as before — only the pixel
// placement changes, so a gentle hand-drawn meander replaces the rigid grid.
export function spaceCoords() {
  const padX = 78;
  const padY = 100;
  const w = VIEW_W - padX * 2;
  const h = VIEW_H - padY * 2;
  const colW = w / COLS;
  const rowH = h / ROWS;
  const coords = [];
  for (let i = 0; i < SPACE_COUNT; i++) {
    const rowFromBottom = Math.floor(i / COLS);
    const colInRow = i % COLS;
    const col = rowFromBottom % 2 === 0 ? colInRow : COLS - 1 - colInRow;
    const baseX = padX + (col + 0.5) * colW;
    const baseY = VIEW_H - padY - (rowFromBottom + 0.5) * rowH;

    // Each row bows gently like a real vineyard lane, and every space gets
    // a touch of hand-drawn jitter so the trail doesn't look like a grid.
    const t = COLS > 1 ? col / (COLS - 1) : 0.5;
    const rowSign = rowFromBottom % 2 === 0 ? 1 : -1;
    const bow = Math.sin(t * Math.PI) * rowSign * (rowH * 0.22);
    const jitterX = Math.sin(i * 1.3) * (colW * 0.1);
    const jitterY = Math.cos(i * 0.9) * (rowH * 0.07);

    coords.push({
      x: baseX + jitterX,
      y: baseY + bow + jitterY,
      isStart: i === 0,
      isFinish: i === FINISH,
    });
  }
  return coords;
}

// Smooth Catmull-Rom -> cubic-Bezier curve through every space centre, so the
// dirt trail winds naturally while still passing through each exact point.
export function pathD(coords) {
  if (coords.length < 2) return "";
  const d = [`M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`];
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] || coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(
      `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    );
  }
  return d.join(" ");
}
