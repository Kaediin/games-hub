const KEYS = {
  game: "closeenough.currentGame",
  history: "closeenough.history",
  settings: "closeenough.settings",
  draft: "closeenough.draft",
};

const DEFAULT_SETTINGS = { theme: "system" };

export function defaultDraft() {
  return { names: ["", "", ""] };
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
    /* quota or private mode */
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
    if (!stored || !Array.isArray(stored.names)) return defaultDraft();
    return { names: stored.names.length ? stored.names : ["", "", ""] };
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
