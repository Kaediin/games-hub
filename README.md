# Playground

A cozy arcade hub for game night. Plain HTML, CSS and JavaScript, one folder
per game, no build step. Serve the repo from any static host.

## Installable, offline site

The hub and every game install to the home screen as one app
(`manifest.webmanifest`) and work offline (`sw.js`, registered by `js/pwa.js`).
Every path is relative, so the site runs from any static HTTPS host, including
under a subpath. Installing needs HTTPS (or `localhost`).

### Wiring in a game

Add this to the `<head>` of the game's `index.html` (for a game folder at the
repo root, next to `codenames/`):

```html
<link rel="manifest" href="../manifest.webmanifest" />
<link rel="apple-touch-icon" href="../icons/icon-180.png" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Playground" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<script type="module" src="../js/pwa.js"></script>
```

Then regenerate the precache list and commit the updated `sw.js`:

```sh
node scripts/gen-precache.mjs
```

### Keeping the precache current

Run `node scripts/gen-precache.mjs` after adding, changing or deleting any file
the site serves. The version in `sw.js` is a hash of those files, so installed
apps switch to the new version on their next visit. `--check` exits non-zero
when `sw.js` is out of date.

Precached: every web asset (HTML, CSS, JS, JSON, images, fonts, audio) outside
dot-folders, `node_modules/`, `scripts/` and test folders, minus `*.test.*`
files, READMEs and `package.json`. Google Fonts are cached the first time a page
uses them; a game never opened online shows system fonts offline.

### Icons and checks

Playwright is not a repo dependency; these commands fetch it on the fly.

```sh
npx -y -p playwright node scripts/render-icons.mjs  # icons/icon.svg -> PNGs
npx -y -p playwright node scripts/check-pwa.mjs     # install + offline check
```
