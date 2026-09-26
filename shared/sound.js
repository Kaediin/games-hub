import { getSettings } from "./store.js";

// Procedural Web Audio effects, in the style of codenames/js/sound.js.
// No audio files, so it works offline and loads instantly. Every call is a
// no-op when sound is off or Web Audio is unavailable.

let ctx = null;
let master = null;

function getCtx() {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

function unlock() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

function tone({ freq = 440, dur = 0.16, type = "sine", gain = 0.16, attack = 0.004, release = 0.06, sweepTo = null, when = 0 }) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + release + 0.05);
}

function noise({ dur = 0.08, gain = 0.16, filter = 1200, type = "lowpass", q = 0.8, when = 0 }) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const decay = 1 - i / data.length;
    data[i] = (Math.random() * 2 - 1) * decay * decay;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = filter;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

const PRESETS = {
  // UI taps: menu, toggles, swatches.
  tap() {
    tone({ freq: 880, dur: 0.03, type: "triangle", gain: 0.07, release: 0.03 });
  },
  // Tic-tac-toe mark: a chalky scratch plus a soft pluck. X and O differ in pitch.
  place({ player = 0 } = {}) {
    noise({ dur: 0.09, gain: 0.08, filter: 3200, type: "bandpass", q: 1.4 });
    tone({ freq: player === 0 ? 587.33 : 440, sweepTo: player === 0 ? 659.25 : 493.88, dur: 0.12, type: "triangle", gain: 0.13 });
  },
  // Connect 4 disc hitting its slot: a woody clack, lower as the stack grows.
  land({ row = 0 } = {}) {
    const base = 150 + row * 14;
    noise({ dur: 0.05, gain: 0.22, filter: 2100, type: "lowpass" });
    tone({ freq: base, sweepTo: base * 0.55, dur: 0.08, type: "sine", gain: 0.3 });
    tone({ freq: 1250 + row * 40, dur: 0.018, type: "triangle", gain: 0.06, release: 0.02 });
  },
  // The small second tap as the disc settles after its bounce.
  settle({ row = 0 } = {}) {
    noise({ dur: 0.03, gain: 0.07, filter: 1800 });
    tone({ freq: 190 + row * 14, sweepTo: 120, dur: 0.05, type: "sine", gain: 0.08 });
  },
  undo() {
    tone({ freq: 660, sweepTo: 392, dur: 0.12, type: "sine", gain: 0.12 });
    noise({ dur: 0.05, gain: 0.04, filter: 1400, when: 0.02 });
  },
  invalid() {
    tone({ freq: 170, dur: 0.07, type: "square", gain: 0.06 });
    tone({ freq: 150, dur: 0.07, type: "square", gain: 0.06, when: 0.09 });
  },
  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone({ freq: f, dur: 0.16, type: "triangle", gain: 0.16, when: i * 0.11 }));
    tone({ freq: 1567.98, dur: 0.5, type: "sine", gain: 0.06, when: 0.44 });
    tone({ freq: 2093, dur: 0.4, type: "sine", gain: 0.04, when: 0.52 });
  },
  draw() {
    tone({ freq: 523.25, dur: 0.18, type: "triangle", gain: 0.12 });
    tone({ freq: 440, dur: 0.28, type: "triangle", gain: 0.12, when: 0.16 });
  },
  // New round: pieces tumbling out of the board.
  clear() {
    for (let i = 0; i < 6; i++) {
      noise({ dur: 0.04, gain: 0.08 - i * 0.008, filter: 1600 - i * 120, when: i * 0.055 });
    }
    tone({ freq: 240, sweepTo: 120, dur: 0.2, type: "sine", gain: 0.08 });
  },
  start() {
    tone({ freq: 440, dur: 0.1, type: "triangle", gain: 0.12 });
    tone({ freq: 659.25, dur: 0.16, type: "triangle", gain: 0.12, when: 0.09 });
  },
};

export const sound = {
  init() {
    const onFirst = () => unlock();
    window.addEventListener("pointerdown", onFirst, { once: true, capture: true });
    window.addEventListener("keydown", onFirst, { once: true, capture: true });
  },
  enabled() {
    return getSettings().sound !== false;
  },
  play(name, opts) {
    if (!this.enabled()) return;
    unlock();
    const fn = PRESETS[name];
    if (!fn) return;
    try {
      fn(opts);
    } catch {
      /* ignore */
    }
  },
};
