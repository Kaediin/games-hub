// Centralised app state — current game, history, settings.
// Everything is persisted in localStorage. No backend.

const KEYS = {
  game: "codenames.currentGame",
  history: "codenames.history",
  settings: "codenames.settings",
  draft: "codenames.draft", // in-progress player list / team assignments
  lastWords: "codenames.lastWords", // words from previous game (avoid repeats)
};

const DEFAULT_SETTINGS = { theme: "system", muted: false };

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
  // ----- Settings -----
  getSettings() {
    return { ...DEFAULT_SETTINGS, ...safeRead(KEYS.settings, {}) };
  },
  saveSettings(patch) {
    const next = { ...this.getSettings(), ...patch };
    safeWrite(KEYS.settings, next);
    return next;
  },

  // ----- Current game -----
  getGame() {
    return safeRead(KEYS.game, null);
  },
  saveGame(game) {
    safeWrite(KEYS.game, game);
  },
  clearGame() {
    const game = this.getGame();
    if (game?.tiles) {
      safeWrite(KEYS.lastWords, game.tiles.map((t) => t.word));
    }
    safeWrite(KEYS.game, null);
  },
  getLastWords() {
    return safeRead(KEYS.lastWords, []);
  },

  // ----- Draft (setup/assign in-progress) -----
  getDraft() {
    return safeRead(KEYS.draft, { players: [], teams: { red: [], blue: [], none: [] }, spymasters: { red: null, blue: null } });
  },
  saveDraft(draft) {
    safeWrite(KEYS.draft, draft);
  },
  clearDraft() {
    safeWrite(KEYS.draft, null);
  },

  // ----- History -----
  getHistory() {
    return safeRead(KEYS.history, []);
  },
  appendHistory(entry) {
    const list = this.getHistory();
    list.unshift(entry);
    safeWrite(KEYS.history, list.slice(0, 100)); // cap
  },
  clearHistory() {
    safeWrite(KEYS.history, []);
  },

  // ----- Reset all -----
  resetAll() {
    [KEYS.game, KEYS.history, KEYS.settings, KEYS.draft, KEYS.lastWords].forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
  },
};
