# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris in vanilla JavaScript + HTML5 Canvas. Three files, no dependencies, no build step, no test suite, no linter, no `package.json`.

The README, in-game UI strings (`PAUSA`, `Puntuación`, `Reiniciar`) and code comments are in **Spanish** — keep new user-facing text in Spanish.

## Running

```bash
open index.html              # simplest; works because there are no module imports or fetches
python3 -m http.server 8000  # or: npx serve .   — then http://localhost:8000
```

There is nothing to build, lint, or test. Verification is manual: reload the page and play.

## Architecture

`game.js` is a single classic script (not an ES module) loaded at the end of `<body>`. Everything is a top-level function over module-level mutable state:

```js
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
```

No classes, no closures, no state container. Any new feature is another top-level function mutating these variables — match that style rather than introducing modules.

### The color index is the piece type

`PIECES[1..7]` are matrices filled with their own type number, and that same number indexes `COLORS` and is what gets written into `board` cells (`0` = empty). So a cell value is simultaneously "occupied", "which piece", and "which color". Reordering `COLORS` silently recolors pieces; a piece matrix must be filled with its own index or rendering breaks.

### Coupling between files

- `game.js` grabs all DOM nodes by id at load time (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`). Renaming an id in `index.html` throws at startup.
- `<canvas id="board">` is hardcoded `300×600`; it must equal `COLS*BLOCK × ROWS*BLOCK`. Changing `COLS`/`ROWS`/`BLOCK` requires editing `index.html` too.
- `drawNext()` centers the preview in a fixed 4×4 grid at 30px — that's why `#next-canvas` is `120×120`.
- One `#overlay` element serves both PAUSE and GAME OVER; the two states differ only by the text written into `#overlay-title` / `#overlay-score`.

### Game loop

`requestAnimationFrame` accumulating `dropAccum`; when it exceeds `dropInterval` the piece drops one row or `lockPiece()` runs (`merge` → `clearLines` → `spawn`). `dropAccum` is reset to `0`, not decremented by the interval, so drop timing quantizes to frame boundaries.

Pause/resume works by `cancelAnimationFrame` and then calling `loop(performance.now())` directly — resuming does not go through `init()`. `init()` doubles as the restart handler for the button.

### Rotation

`rotateCW` is transpose + row-reverse on the square matrix (no SRS, no rotation state tracked). `tryRotate` retries the rotated shape at x-offsets `[0, -1, 1, -2, 2]` — horizontal kicks only, no floor kicks.

### Stopping the loop on game over

`spawn()` calls `endGame()` while still inside `loop()` (via `lockPiece()`), so `endGame()`'s `cancelAnimationFrame(animId)` cannot stop the frame that is already executing — `animId` refers to it. That is why `loop()` checks `gameOver || paused` *after* `draw()` and returns instead of scheduling the next frame; without that check the loop kept running behind the overlay and pieces kept stacking. `cancelAnimationFrame` in `endGame()` still matters for the hard-drop path, where the game ends from a keydown handler and there is a genuinely pending frame.

Consequences to preserve if you touch lock/spawn/loop: `spawn()` returns right after `endGame()`, `draw()` skips ghost + current piece once `gameOver` is set (the piece that did not fit is never painted over the stack), and `endGame()` repaints once so the final board is correct on both paths.
