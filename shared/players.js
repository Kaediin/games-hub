import { read, write } from "./store.js";

// Curated piece colours. Each reads well on the walnut (dark) and maple
// (light) boards, and every pair is distinguishable at a glance.
export const PALETTE = [
  { id: "cherry", name: "Cherry", hex: "#e0464e" },
  { id: "tangerine", name: "Tangerine", hex: "#f08a3c" },
  { id: "sunflower", name: "Sunflower", hex: "#f4c534" },
  { id: "clover", name: "Clover", hex: "#3fae6a" },
  { id: "lagoon", name: "Lagoon", hex: "#1fa9ad" },
  { id: "cobalt", name: "Cobalt", hex: "#3d7fdc" },
  { id: "violet", name: "Violet", hex: "#8b63d6" },
  { id: "rose", name: "Rose", hex: "#e45c9c" },
];

export const NAME_MAX = 14;

const DEFAULTS = [
  { name: "", color: "cherry" },
  { name: "", color: "sunflower" },
];

function isColor(id) {
  return PALETTE.some((c) => c.id === id);
}

export function sanitizePlayers(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const players = DEFAULTS.map((def, i) => {
    const p = list[i] && typeof list[i] === "object" ? list[i] : {};
    return {
      name: typeof p.name === "string" ? p.name.slice(0, NAME_MAX) : def.name,
      color: isColor(p.color) ? p.color : def.color,
    };
  });
  if (players[0].color === players[1].color) {
    players[1].color = PALETTE.find((c) => c.id !== players[0].color).id;
  }
  return players;
}

export function loadPlayers() {
  return sanitizePlayers(read("players", null));
}

export function savePlayers(players) {
  const clean = sanitizePlayers(players);
  write("players", clean);
  return clean;
}

export function displayName(players, index) {
  const name = players[index]?.name?.trim();
  return name || `Player ${index + 1}`;
}

export function colorHex(id) {
  return (PALETTE.find((c) => c.id === id) || PALETTE[0]).hex;
}

function toRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb) {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

// amount > 0 mixes toward white, amount < 0 mixes toward black.
export function shade(hex, amount) {
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  return toHex(toRgb(hex).map((v) => v + (target - v) * t));
}

export function alpha(hex, a) {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
