# Close Enough

A pass-the-phone party game. Guess a number (weight, price, length — whatever the table decides). Closest wins the round. Furthest drinks. The podium is **lowest average miss** over the night.

No backend, no account, no tracking — everything runs in your browser and is saved to `localStorage`.

## Running locally

Serve the hub (or this folder) over HTTP. iOS Safari is picky about `file://`.

```bash
# from the games-hub repo root
python3 -m http.server 8765
# then open http://localhost:8765/close-enough/
```

## How to play

The full rules and a scored example are on the home screen. Short version:

1. Add names. Pass this device around.
2. Name an object and a unit (default grams).
3. Tap who guesses next — any order — then lock in a secret number, or skip.
4. Enter the actual value. Reveal.
5. Closest 🏆, furthest 💀. Podium ranks average distance (lower is better).
6. Next round, as many as you want.

Skipped rounds never count as zero.

## Features

- Plain HTML / CSS / vanilla JS, no build step
- Hash-routed SPA (`#home`, `#setup`, `#lobby`, `#round`, `#reveal`, `#history`, `#end`)
- Light + dark theme, system-aware default
- Refresh-safe current game
- Touch-friendly, phone first, tablet and desktop too

## Files

- `index.html` — shell + templates
- `css/styles.css` — coral / teal bullseye theme
- `js/score.js` — pure scoring (tested)
- `js/game.js` — round mutations
- `js/views/` — one file per route
- `scripts/score.test.mjs` — `npm test` or `node --test scripts/score.test.mjs`

## Privacy

Everything you enter stays in this browser’s `localStorage`. Clear site data to wipe it.
