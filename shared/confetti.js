import { shade } from "./players.js";

// Canvas confetti in the winner's colour: a burst from the winning line, then
// a slower rain from the top that is still falling when the result card lands.
// Skipped entirely when the player prefers reduced motion.

const FRAME = 1000 / 60;

export function burstConfetti({ color = "#e8b86d", x, y, count = 120, rain = 90 } = {}) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => {};

  const canvas = document.createElement("canvas");
  canvas.className = "duel-confetti";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const ox = x ?? w / 2;
  const oy = y ?? h / 2;
  const colors = [color, shade(color, 0.35), shade(color, -0.2), shade(color, 0.65), "#f3d27a", "#fff4dc"];
  const reach = Math.max(w, h);
  const gravity = reach * 0.00042;
  const terminal = reach * 0.0045;

  const piece = (i, props) => ({
    w: 6 + Math.random() * 7,
    h: 4 + Math.random() * 4,
    rot: Math.random() * Math.PI,
    vr: -0.22 + Math.random() * 0.44,
    wobble: Math.random() * Math.PI * 2,
    shape: i % 5 === 0 ? "dot" : "strip",
    color: colors[i % colors.length],
    delay: 0,
    ...props,
  });

  const pieces = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (0.35 + Math.random() * 0.75) * reach * 0.018;
    pieces.push(
      piece(i, {
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - reach * 0.006,
      }),
    );
  }
  for (let i = 0; i < rain; i++) {
    pieces.push(
      piece(i, {
        x: Math.random() * w,
        y: -16 - Math.random() * 40,
        vx: -0.6 + Math.random() * 1.2,
        vy: terminal * (0.35 + Math.random() * 0.4),
        delay: 120 + Math.random() * 1100,
      }),
    );
  }

  const start = performance.now();
  const life = 3600;
  let last = start;
  let raf = 0;

  function tick(now) {
    const t = now - start;
    const dt = Math.min(3, (now - last) / FRAME);
    last = now;
    const drag = Math.pow(0.985, dt);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = t > life - 600 ? Math.max(0, (life - t) / 600) : 1;
    for (const p of pieces) {
      if (t < p.delay) continue;
      p.vx *= drag;
      p.vy = Math.min(p.vy * drag + gravity * dt, terminal);
      p.wobble += 0.12 * dt;
      p.x += (p.vx + Math.sin(p.wobble) * 0.6) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > h + 20) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === "dot") {
        ctx.beginPath();
        ctx.arc(0, 0, p.h * 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.scale(1, Math.cos(p.wobble));
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
    if (t < life) raf = requestAnimationFrame(tick);
    else cleanup();
  }
  raf = requestAnimationFrame(tick);

  function cleanup() {
    cancelAnimationFrame(raf);
    canvas.remove();
  }
  return cleanup;
}
