import { shuffle } from "../ui.js";
import { WORDS as NL_GENERAL } from "./nl_general.js";
import { WORDS as EN_GENERAL } from "./en_general.js";
import { WORDS as MOVIES } from "./movies.js";
import { WORDS as MUSIC } from "./music.js";
import { WORDS as SPORTS } from "./sports.js";
import { WORDS as DUTCH_CULTURE } from "./dutch_culture.js";

export const PACKS = {
  nl_general: NL_GENERAL,
  en_general: EN_GENERAL,
  movies: MOVIES,
  music: MUSIC,
  sports: SPORTS,
  dutch_culture: DUTCH_CULTURE,
};

export function normalize(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function customEntries(customWords) {
  return (customWords || []).map((text) => ({
    text,
    lang: "mix",
    pack: "custom",
  }));
}

export function buildPool(game) {
  const lists = [];
  for (const id of game.packs || []) {
    if (PACKS[id]) lists.push(PACKS[id]);
  }
  lists.push(customEntries(game.customWords));
  return lists.flat();
}

export function unusedCount(game) {
  const used = new Set((game.usedWords || []).map(normalize));
  return buildPool(game).filter((w) => !used.has(normalize(w.text))).length;
}

const TRACK_FINISH = 35;

function pickFromPacks(game, used, n, pickedKeys) {
  const byPack = new Map();
  for (const id of game.packs || []) {
    const list = PACKS[id];
    if (!list) continue;
    for (const w of list) {
      const key = normalize(w.text);
      if (!key || used.has(key) || pickedKeys.has(key)) continue;
      if (!byPack.has(w.pack)) byPack.set(w.pack, []);
      byPack.get(w.pack).push(w);
    }
  }
  for (const list of byPack.values()) {
    const shuffled = shuffle(list);
    list.length = 0;
    list.push(...shuffled);
  }

  const packOrder = shuffle([...byPack.keys()]);
  const picked = [];
  let guard = 0;
  while (picked.length < n && guard < 400) {
    guard += 1;
    let progressed = false;
    for (const id of packOrder) {
      if (picked.length >= n) break;
      const list = byPack.get(id);
      while (list.length) {
        const w = list.pop();
        const key = normalize(w.text);
        if (pickedKeys.has(key)) continue;
        picked.push(w);
        pickedKeys.add(key);
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }
  return picked;
}

function customSlotsThisCard(game, unusedCustomCount) {
  if (unusedCustomCount <= 0) return 0;
  const hasPacks = (game.packs || []).some((id) => PACKS[id]);
  if (!hasPacks) return Math.min(5, unusedCustomCount);
  const cardsSoFar = Math.floor((game.usedWords || []).length / 5);
  const startAt = game.customStartCard ?? 1;
  if (cardsSoFar < startAt) return 0;
  const lead = Math.max(0, ...(game.teams || []).map((t) => t.position || 0));
  const roundsLeftGuess = Math.max(2, Math.ceil((TRACK_FINISH - lead) / 3));
  return Math.min(4, Math.max(1, Math.ceil(unusedCustomCount / roundsLeftGuess)));
}

export function dealCard(game, n = 5) {
  const used = new Set((game.usedWords || []).map(normalize));
  const pickedKeys = new Set();
  const unusedCustom = shuffle(
    customEntries(game.customWords).filter((w) => {
      const key = normalize(w.text);
      return key && !used.has(key);
    })
  );
  const customSlots = Math.min(n, customSlotsThisCard(game, unusedCustom.length));
  const packSlots = n - customSlots;
  const picked = pickFromPacks(game, used, packSlots, pickedKeys);

  for (const w of unusedCustom) {
    if (picked.filter((p) => p.pack === "custom").length >= customSlots) break;
    const key = normalize(w.text);
    if (pickedKeys.has(key)) continue;
    picked.push(w);
    pickedKeys.add(key);
  }

  if (picked.length < n) {
    const rest = shuffle(
      buildPool(game).filter((w) => {
        const key = normalize(w.text);
        return key && !used.has(key) && !pickedKeys.has(key);
      })
    );
    for (const w of rest) {
      if (picked.length >= n) break;
      picked.push(w);
      pickedKeys.add(normalize(w.text));
    }
  }

  if (picked.length < n) {
    throw new Error("Not enough unused words left in the selected packs.");
  }

  return shuffle(picked).slice(0, n);
}
