# 30 Seconds — vineyard race

A free, browser-based, dependency-light version of the **30 Seconds** party game. No backend, no account, no tracking — everything runs in your browser and is saved to `localStorage`.

Unofficial fan project. Inspired by [30 Seconds](https://en.wikipedia.org/wiki/30_Seconds_(game)) by Calie Esterhuyse. Word lists are original (public-knowledge names and titles) and are **not** copied from any commercial deck.

## Running locally

It's a static site. Either:

1. Open `index.html` directly in a browser, or
2. Serve the folder over HTTP (recommended — iOS Safari treats `file://` differently for some features):

```bash
cd thirty-seconds
python3 -m http.server 8766
# then open http://localhost:8766/
```

On an iPad on the same Wi-Fi, use your computer's local IP instead of `localhost`.

## Hosting

Drop the entire folder onto any static host (GitHub Pages, Netlify, Vercel, S3, your own server, …). Nothing to build.

## How to play

The full instructions are on the landing page. Short version:

1. Set up 2–4 named teams. Mix word packs (NL / EN / films / music / sports / Hollandse cultuur) and optional custom words.
2. The describer holds this device, peeks at five words (optional), then taps **GO**.
3. Teammates guess. Tap a word when it is correct — any order. Last five seconds tick; time-up buzzes.
4. Advance **one space per correct word** on the vineyard path. First team to reach or pass the château wins.

## Features

- Plain HTML / CSS / vanilla JS, no build step
- Hash-routed single-page app (`#home`, `#setup`, `#board`, `#round`, `#history`, `#end`)
- Original mixed-language word packs (150–400+ each) plus a paste-in custom list
- Vineyard race map (~35 spaces), decorative landmarks only (no special-tile rules)
- Peek-before-timer (default on) or a 3-2-1 countdown
- Timer presets 20 / 30 / 45 / 60 seconds
- Procedural sound (Web Audio) — last-5s tick, time-up, mute toggle
- Light + dark theme, system-aware default
- Game history in `localStorage`
- Refresh-safe; touch-friendly for iPad

## Files

- `index.html` — single shell with `<template>` tags for each view
- `css/styles.css` — vineyard theme + responsive layout
- `js/main.js` — entry point
- `js/router.js` — hash router
- `js/state.js` — localStorage-backed state
- `js/game.js` — deal, score, movement, win
- `js/boardMap.js` — path coordinates
- `js/words/` — pack modules + mixer
- `js/views/` — one file per route

## Privacy

There is no backend. Everything you enter (team names, current game, history) is stored only in this browser's `localStorage`. Clear your browser data to wipe it.

## Credits

- Inspired by [30 Seconds](https://en.wikipedia.org/wiki/30_Seconds_(game)) by Calie Esterhuyse. Unofficial fan project.
