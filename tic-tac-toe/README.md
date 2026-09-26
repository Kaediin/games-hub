# Tic-tac-toe

A two-player game for one device. Three in a row takes the round; the match score keeps running and the first move alternates every round.

No backend, no account, no tracking — everything runs in your browser and is saved to `localStorage`.

## Running locally

Serve the hub (or this folder's parent) over HTTP. The game imports `../shared/`, and iOS Safari is picky about `file://`.

```bash
# from the games-hub repo root
python3 -m http.server 8765
# then open http://localhost:8765/tic-tac-toe/
```

## How to play

1. Name both players and pick a colour each. Player 1 plays X, player 2 plays O.
2. Take turns tapping a square. Three across, down or diagonally wins the round.
3. Undo steps back as far as you like until the round is decided.
4. Next round flips who starts. New match resets the score.

## Features

- Plain HTML / CSS / vanilla JS, no build step
- X and O draw themselves as SVG strokes in each player's colour; a stroke is drawn through the winning line
- Match score with draws, alternating starter, unlimited in-round undo
- Generated sound effects, haptic ticks (vibrate, or the iOS 18 switch fallback), winner-coloured confetti
- Light, dark or system theme
- Tabletop mode for a device lying flat between the players: player 2's panel, menu and result card turn to face them
- Phone portrait, landscape, the foldable iPhone folded and unfolded, and iPad
- Refresh-safe current round; the screen stays awake while playing

## Files

- `index.html` — page shell
- `css/styles.css` — board, grooves and marks
- `js/game.js` — pure rules (tested)
- `js/main.js` — board rendering and input, mounted by `../shared/duel.js`
- `scripts/rules.test.mjs` — `npm test` or `node --test scripts/rules.test.mjs`

The setup screen, panels, menu, scoring, sound, haptics, theme and confetti live in the shared two-player kit in `../shared/`, which Connect 4 uses too.

## Privacy

Names, colours, settings and the match score stay in this browser's `localStorage` (keys start with `playground.duel.`). Clear site data to wipe them.
