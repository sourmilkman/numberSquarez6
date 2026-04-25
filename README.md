# Number Squarez 6

Number Squarez 6 is a dependency-free portrait PWA containing two puzzle modes:

- Anti-Magic Squares: place every number once so rows, columns and diagonals have unique consecutive sums.
- Alphanametics: arrange nine numbers into a 3x3 square that is magic by numeric value and by British-English word length.

## Files

- `index.html` - single-page app shell, styling, screens and overlays
- `game.js` - self-contained game logic IIFE
- `manifest.json` - PWA install metadata
- `service-worker.js` - offline-first cache
- `icon.svg`, `icon192.png`, `icon512.png` - app icons

Run locally with:

```sh
python -m http.server 8066
```

Then open `http://127.0.0.1:8066/`.
