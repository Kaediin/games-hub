# Codenames — static web edition

A free, browser-based, dependency-light version of the **Codenames** party game. No backend, no account, no tracking — everything runs in your browser and is saved to `localStorage`.

## Running locally

It's a static site. Either:

1. Open `index.html` directly in a browser, or
2. Serve the folder over HTTP (recommended, since iOS Safari treats `file://` differently for some features):

```bash
cd codenames
python3 -m http.server 8765
# then open http://localhost:8765/
```

## Hosting

Drop the entire folder onto any static host (GitHub Pages, Netlify, Vercel, S3, your own server, …). Nothing to build.

## How to play

The full instructions are on the landing page. Short version:

1. Add players, then assign them to Red / Blue teams (manual or random). Each team needs a spymaster.
2. The board (this device, ideally an iPad or laptop) shows a 5x5 grid of words.
3. Each spymaster scans the one-time QR code with their phone to see the secret colour key.
4. Operatives tap tiles. Find your team's words first; avoid the assassin.

## Features

- Plain HTML / CSS / vanilla JS, no build step
- Hash-routed single-page app (`#home`, `#setup`, `#assign`, `#qr`, `#play`, `#history`, `#end`, `#key=...`)
- ~400 classic Codenames-style words
- 5x5 board with proper distribution (9 / 8 / 7 / 1)
- One-time QR code → spymaster key on a separate device (no live sync, fully offline)
- Optional per-turn timer with quick presets and pause/cancel
- Procedurally generated sound effects (Web Audio API, no asset files) — toggleable
- Light + dark theme with a Codenames-inspired palette, system-aware default
- Game history saved in `localStorage`
- Refresh-safe: the current game survives page reloads
- Touch-friendly, optimised for iPad Air 4 (portrait + landscape)

## Files

- `index.html` — single shell with `<template>` tags for each view
- `css/styles.css` — theme + responsive layout
- `js/main.js` — entry point
- `js/router.js` — hash router
- `js/state.js` — localStorage-backed state (game, history, settings, draft)
- `js/game.js` — game generation, tile reveal, win/turn logic, key encoding
- `js/words.js` — word library
- `js/theme.js` — light/dark/system theme toggle
- `js/sound.js` — Web Audio sound presets, mute toggle
- `js/timer.js` — per-turn countdown
- `js/ui.js` — small DOM helpers
- `js/views/*.js` — one file per route
- `vendor/qrcode.min.js` — third-party QR generator (Kazuhiko Arase, MIT)

## Privacy

There is no backend. Everything you enter (player names, current game, history) is stored only in this browser's `localStorage`. Clear your browser data to wipe it. The QR code is generated locally and shared directly between your devices — nothing is uploaded anywhere.

## Credits

- Inspired by [Codenames](https://czechgames.com/en/codenames/) by Vlaada Chvátil / Czech Games Edition. Unofficial fan project.
- QR generation: `[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)` by Kazuhiko Arase (MIT).

