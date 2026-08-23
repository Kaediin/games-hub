import { state } from "./state.js";

// Lightweight sound manager. Uses Web Audio API to generate short tones
// procedurally — no external assets needed (works offline, no licensing
// questions). Stays a no-op when muted or if AudioContext isn't available.

let ctx = null;
let unlocked = false;

function getCtx() {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

function unlock() {
  if (unlocked) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  unlocked = true;
}

function isMuted() {
  return !!state.getSettings().muted;
}

function tone({ freq = 440, dur = 0.18, type = "sine", gain = 0.18, attack = 0.005, release = 0.06, sweepTo = null, when = 0 }) {
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
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + release + 0.05);
}

// Short noise burst (filtered) for "thunk" / buzz textures.
function noise({ dur = 0.15, gain = 0.18, filter = 800, when = 0 }) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = filter;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(lp).connect(g).connect(c.destination);
  src.start(t0);
}

const PRESETS = {
  // Reveal own team's word — bright friendly chirp.
  revealTeam() {
    tone({ freq: 520, sweepTo: 780, dur: 0.12, type: "triangle", gain: 0.18 });
    noise({ dur: 0.07, gain: 0.06, filter: 1500 });
  },
  // Reveal neutral — soft thud.
  revealNeutral() {
    tone({ freq: 280, sweepTo: 180, dur: 0.18, type: "sine", gain: 0.18 });
    noise({ dur: 0.1, gain: 0.05, filter: 600 });
  },
  // Reveal other team's word — low buzz.
  revealOther() {
    tone({ freq: 220, sweepTo: 140, dur: 0.22, type: "sawtooth", gain: 0.14 });
  },
  // Assassin — dramatic descending sting.
  assassin() {
    const c = getCtx();
    if (!c) return;
    tone({ freq: 440, sweepTo: 110, dur: 0.6, type: "sawtooth", gain: 0.22 });
    tone({ freq: 220, sweepTo: 55, dur: 0.9, type: "square", gain: 0.16, when: 0.05 });
    noise({ dur: 0.5, gain: 0.08, filter: 400, when: 0.0 });
  },
  // Win — triumphant arpeggio.
  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone({ freq: f, dur: 0.15, type: "triangle", gain: 0.18, when: i * 0.12 }));
  },
  // Loss — sour minor chord.
  loss() {
    [392.0, 466.16, 311.13].forEach((f, i) =>
      tone({ freq: f, dur: 0.5, type: "sine", gain: 0.14, when: i * 0.05 })
    );
  },
  // Turn-end — soft chime.
  endTurn() {
    tone({ freq: 660, dur: 0.12, type: "triangle", gain: 0.15 });
    tone({ freq: 880, dur: 0.18, type: "triangle", gain: 0.12, when: 0.08 });
  },
  // Timer tick (last 5s).
  tick() {
    tone({ freq: 1100, dur: 0.04, type: "square", gain: 0.1 });
  },
  // Timer expired.
  timeUp() {
    tone({ freq: 880, sweepTo: 220, dur: 0.4, type: "sawtooth", gain: 0.2 });
  },
};

export const sound = {
  init() {
    const onFirst = () => {
      unlock();
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
    window.addEventListener("pointerdown", onFirst, { once: true });
    window.addEventListener("keydown", onFirst, { once: true });
    this.refreshButton();
    document.getElementById("btn-sound")?.addEventListener("click", () => {
      const muted = !state.getSettings().muted;
      state.saveSettings({ muted });
      this.refreshButton();
      if (!muted) {
        unlock();
        PRESETS.endTurn();
      }
    });
  },
  refreshButton() {
    const btn = document.getElementById("btn-sound");
    if (!btn) return;
    const muted = isMuted();
    btn.setAttribute("aria-pressed", String(muted));
    btn.title = muted ? "Sound: off" : "Sound: on";
    btn.querySelector(".ico-sound-on").classList.toggle("hidden", muted);
    btn.querySelector(".ico-sound-off").classList.toggle("hidden", !muted);
  },
  play(name) {
    if (isMuted()) return;
    unlock();
    const fn = PRESETS[name];
    if (fn) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
  },
};
