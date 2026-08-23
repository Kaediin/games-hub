// Centralised app state — current game, history, settings, setup draft.
// Everything is persisted in localStorage. No backend.

const KEYS = {
  game: "thirtyseconds.currentGame",
  history: "thirtyseconds.history",
  settings: "thirtyseconds.settings",
  draft: "thirtyseconds.draft",
};

export const TEAM_PALETTE = [
  { id: "burgundy", label: "Burgundy", hex: "#7b2d3b", ink: "#f7efe4" },
  { id: "gold", label: "Gold", hex: "#c9a227", ink: "#2a1f14" },
  { id: "forest", label: "Forest", hex: "#2f5d3a", ink: "#f7efe4" },
  { id: "cream", label: "Cream", hex: "#e8d5a3", ink: "#2a1f14" },
];

export const PACK_META = [
  { id: "nl_general", label: "Nederlands algemeen", hint: "People, places, TV, everyday things" },
  { id: "en_general", label: "English general", hint: "People, places, objects, mixed trivia" },
  { id: "movies", label: "Films & series", hint: "NL + EN titles mixed" },
  { id: "music", label: "Music", hint: "Artists, songs, genres" },
  { id: "sports", label: "Sports", hint: "Athletes, clubs, events" },
  { id: "dutch_culture", label: "Hollandse cultuur", hint: "Traditions, cities, politics, TV" },
  { id: "custom", label: "Custom", hint: "Your own words" },
];

export const TIMER_PRESETS = [20, 30, 45, 60];

const DEFAULT_SETTINGS = { theme: "system", muted: false };

export function defaultDraft() {
  return {
    teams: [
      { name: "Burgundy", color: "burgundy", players: [] },
      { name: "Gold", color: "gold", players: [] },
    ],
    packs: ["nl_general", "en_general", "movies", "music", "sports", "dutch_culture"],
    peek: true,
    timerSec: 30,
    customWordsText: "",
  };
}

function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Quota or private mode — silently ignore.
  }
}

export const state = {
  getSettings() {
    return { ...DEFAULT_SETTINGS, ...safeRead(KEYS.settings, {}) };
  },
  saveSettings(patch) {
    const next = { ...this.getSettings(), ...patch };
    safeWrite(KEYS.settings, next);
    return next;
  },

  getGame() {
    return safeRead(KEYS.game, null);
  },
  saveGame(game) {
    if (game && typeof game === "object") game.savedAt = Date.now();
    safeWrite(KEYS.game, game);
  },
  clearGame() {
    safeWrite(KEYS.game, null);
  },

  getDraft() {
    const stored = safeRead(KEYS.draft, null);
    if (!stored) return defaultDraft();
    const base = defaultDraft();
    return {
      ...base,
      ...stored,
      teams: Array.isArray(stored.teams) && stored.teams.length >= 2 ? stored.teams : base.teams,
      packs: Array.isArray(stored.packs) ? stored.packs : base.packs,
    };
  },
  saveDraft(draft) {
    safeWrite(KEYS.draft, draft);
  },

  getHistory() {
    return safeRead(KEYS.history, []);
  },
  appendHistory(entry) {
    const list = this.getHistory();
    list.unshift(entry);
    safeWrite(KEYS.history, list.slice(0, 100));
  },
  clearHistory() {
    safeWrite(KEYS.history, []);
  },

  resetAll() {
    [KEYS.game, KEYS.history, KEYS.settings, KEYS.draft].forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
  },
};
