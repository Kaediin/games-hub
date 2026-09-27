# Connect 4

A two-player game for one device on the classic 7×6 board. Four in a row, in any direction, takes the round; the match score keeps running and the first move alternates every round.

No backend, no account, no tracking — everything runs in your browser and is saved to `localStorage`.

## Running locally

Serve the hub (or this folder's parent) over HTTP. The game imports `../shared/`, and iOS Safari is picky about `file://`.

```bash
# from the games-hub repo root
python3 -m http.server 8765
# then open http://localhost:8765/connect-four/
```

## How to play

1. Name both players and pick a disc colour each.
2. Tap anywhere in a column (or drag along the board and let go) to drop a disc. A ghost disc shows where it will land.
3. Line up four across, down or diagonally to win the round. A full board with no line is a draw.
4. Undo steps back as far as you like until the round is decided.
5. Next round flips who starts. New match resets the score.

## Features

- Plain HTML / CSS / vanilla JS, no build step
- Wooden board with real holes: discs fall behind the face with a spring bounce, and the winning four get pulsing rings
- Match score with draws, alternating starter, unlimited in-round undo
- Generated sound effects, haptic ticks (vibrate, or the iOS 18 switch fallback), winner-coloured confetti
- Light, dark or system theme
- Tabletop mode for a device lying flat between the players: the board turns sideways so gravity runs across the screen and both players see it the same way, and player 2's panel, menu and result card turn to face them
- Phone portrait, landscape, the foldable iPhone folded and unfolded, and iPad
- Refresh-safe current round; the screen stays awake while playing

## Files

- `index.html` — page shell
- `css/styles.css` — board, holes and discs
- `js/game.js` — pure rules (tested)
- `js/main.js` — board rendering, drop animation and input, mounted by `../shared/duel.js`
- `scripts/rules.test.mjs` — `npm test` or `node --test scripts/rules.test.mjs`

The setup screen, panels, menu, scoring, sound, haptics, theme and confetti live in the shared two-player kit in `../shared/`, which Tic-tac-toe uses too.

## Privacy

Names, colours, settings and the match score stay in this browser's `localStorage` (keys start with `playground.duel.`). Clear site data to wipe them.
