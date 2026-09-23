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

`PIECES[1..13]` are matrices whose non-zero cells hold their own type number, and that same number indexes `COLORS` and is what gets written into `board` cells (`0` = empty). So a cell value is simultaneously "occupied", "which piece", and "which color". Reordering `COLORS` silently recolors pieces; a piece matrix must be filled with its own index or rendering breaks.

The one exception is `WILD` (`14`): it is a board cell value with no piece, so `PIECES[14]` is `null` — `randomPiece()` must never return it.

### The nut (`PIECES[8]`, `NUT`)

A 3×3 ring with `0` in the center — the only piece whose interior cell is empty on purpose. Consequences:

- It is rotation-invariant, so `tryRotate` is effectively a no-op on it.
- The hole is sealed by the ring, so `merge()` leaves a cell nothing can ever fill; it only disappears when that row is completed and cleared. That is the intended difficulty.
- `randomPiece()` is no longer a uniform 1-of-7: with probability `NUT_CHANCE` it returns `NUT`, otherwise one of the 7 standard pieces.
- `drawNutHole()` paints the center cell as a ring (a `rect` plus an `arc` filled with `'evenodd'`, which punches the circle out instead of covering it with a theme-colored disc). It is called from `draw()` (ghost and current piece) and `drawNext()` at offset `+1,+1`, hardcoded because the hole is always the center of a 3×3 matrix. Locked nuts get no circle: the board only stores cell values, so a merged hole is an ordinary empty cell.

### Power-ups (`PIECES[9..13]`, `WILD`)

`BOMB`/`BOLT`/`DYE`/`GRAVITY`/`FREEZE` = types `9..13`, each a 1×1 matrix, so rotation is a no-op and `makePiece()` centers them at column 5.

- **Scheduling**: `clearLines()` sets `pendingPowerUp` when `lines` reaches `nextPowerUpLines` (`POWERUP_EVERY` = 5) and advances the threshold to the next multiple, so at most one power-up is queued per clear. `randomPiece()` consumes the flag before the nut/standard branch, which means the power-up shows up in the NEXT preview first and only falls one piece later.
- **They are consumed, not merged**: `lockPiece()` calls `applyPowerUp()` *instead of* `merge()` for these types, so a power-up value never reaches `board` — nothing in the board renderer or `clearLines` has to know about them. `clearLines()` still runs right after, because `compact()` can complete rows.
- Effects operate on the landing cell `(current.x, current.y)`: `blast()` (3×3, clipped at the edges), `bolt()` (whole row + column; the intersection is already `0` on the second pass, so it is counted once), `dye()` (most abundant color → `WILD`), `compact()` (per-column fall, `write` pointer), `FREEZE` (just sets `freezeMs`). Only `blast`/`bolt` score: `cells × POWERUP_SCORE × level`.
- **`WILD` is passable**: `collide()` skips cells equal to `WILD`, so pieces fall *through* comodín cells and `merge()` overwrites them — that is the whole point of Tinte. `clearLines()` uses `v !== 0`, so a comodín still counts as a filled cell for completing a row. Any new board scan has to decide which of the two rules it follows.
- **Freeze lives in `loop()`**: while `freezeMs > 0` the auto-drop branch is skipped entirely (`dropAccum` pinned to `0`) and the remaining time is decremented by `dt`, so `togglePause()` does not burn the effect. Keyboard moves, rotation, soft drop and hard drop all still work while frozen — only gravity stops.
- Rendering: `drawGlyph()` paints the emoji over the 1×1 cell (ghost, current piece and NEXT preview) — it must set `fillStyle` itself, because `drawBlock()` leaves it on `HIGHLIGHT_COLORS[theme]` (a ~10% alpha color) and a monochrome glyph inherited from it comes out invisible; the same trap applies to anything else drawn after a block, `drawWild()` paints comodines translucent with a diamond, and `draw()` strokes a frame in the freeze color while the effect is active. `powerLabel` / `updatePowerStatus()` drive `#power-status`, which shows the freeze countdown while frozen and the last power-up used otherwise.

### Coupling between files

- `game.js` grabs all DOM nodes by id at load time (`board`, `next-canvas`, `score`, `lines`, `level`, `power-status`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`). Renaming an id in `index.html` throws at startup.
- `<canvas id="board">` is hardcoded `300×600`; it must equal `COLS*BLOCK × ROWS*BLOCK`. Changing `COLS`/`ROWS`/`BLOCK` requires editing `index.html` too.
- `drawNext()` centers the preview in a fixed 4×4 grid at 30px — that's why `#next-canvas` is `120×120`.
- One `#overlay` element serves both PAUSE and GAME OVER; the two states differ only by the text written into `#overlay-title` / `#overlay-score`.

### Game loop

`requestAnimationFrame` accumulating `dropAccum`; when it exceeds `dropInterval` the piece drops one row or `lockPiece()` runs (`merge` → `clearLines` → `spawn`). `dropAccum` is reset to `0`, not decremented by the interval, so drop timing quantizes to frame boundaries. While `freezeMs > 0` that whole branch is skipped (see Power-ups).

Pause/resume works by `cancelAnimationFrame` and then calling `loop(performance.now())` directly — resuming does not go through `init()`. `init()` doubles as the restart handler for the button.

### Rotation

`rotateCW` is transpose + row-reverse on the square matrix (no SRS, no rotation state tracked). `tryRotate` retries the rotated shape at x-offsets `[0, -1, 1, -2, 2]` — horizontal kicks only, no floor kicks.

### Stopping the loop on game over

`spawn()` calls `endGame()` while still inside `loop()` (via `lockPiece()`), so `endGame()`'s `cancelAnimationFrame(animId)` cannot stop the frame that is already executing — `animId` refers to it. That is why `loop()` checks `gameOver || paused` *after* `draw()` and returns instead of scheduling the next frame; without that check the loop kept running behind the overlay and pieces kept stacking. `cancelAnimationFrame` in `endGame()` still matters for the hard-drop path, where the game ends from a keydown handler and there is a genuinely pending frame.

Consequences to preserve if you touch lock/spawn/loop: `spawn()` returns right after `endGame()`, `draw()` skips ghost + current piece once `gameOver` is set (the piece that did not fit is never painted over the stack), and `endGame()` repaints once so the final board is correct on both paths.

### Skins (`SKIN_PALETTES`, `SKIN_RENDERERS`, `setSkin()`)

A `<select id="skin-select">` in the panel swaps palette **and** block renderer at
runtime; the choice persists in `localStorage` under `tetris-skin` and anything
that is not one of `retro` / `neon` / `pastel` / `pixel` falls back to `retro`
(`SKIN_NAMES.includes(...)`, so `__proto__` and friends are rejected too).

- **`colors` is the active palette, `COLORS` is only the retro one.** Every draw
  function reads `colors[...]`; `COLORS` survives as `SKIN_PALETTES.retro` and as
  the length reference for `dye()` (`new Array(COLORS.length)`), which stays valid
  because **every palette must have the same 15 indices: `null` at 0 and one color
  per type through `WILD` (14)**. The color index is still the piece type, so a
  palette with a different order silently recolors pieces and a shorter one breaks
  `dye()`.
- **`drawBlock()` is now just a dispatcher**: it keeps the `if (!colorIndex) return`
  guard (call sites pass `0` cells freely) and delegates to `drawBlockSkin`, which
  `setSkin()` points at `drawBlockRetro` / `Neon` / `Pastel` / `Pixel`. Retro is
  byte-for-byte the old body.
- **A renderer must restore the context** (`globalAlpha`, `shadowBlur`,
  `shadowColor`, `lineWidth`) before returning: the grid, the ghost, `drawGlyph()`,
  `drawWild()` and the freeze frame are painted right after and inherit whatever it
  leaves. Neon is the one that sets `shadowBlur`/`shadowColor`, and it clears both.
- **`drawGlyph()` still sets its own `fillStyle`**, now `SKIN_GLYPH_INK[skin]`: the
  dark `GLYPH_INK` would be invisible over neon's dark blocks, and inheriting
  `drawBlock`'s last `fillStyle` (a ~10% alpha highlight) was already the
  documented trap.
- **Skin and theme are orthogonal.** `theme` is still `'dark'`/`'light'` in
  `tetris-theme`; per-skin colors keep both variants (`SKIN_GRIDS[skin][theme]`,
  `PASTEL_GLOSS[theme]`, retro still uses `HIGHLIGHT_COLORS[theme]`). Neon is the
  deliberate exception: its two grid variants are identical because
  `body.skin-neon` forces a black board background in both themes from CSS — glow
  only reads over black.
- `setSkin()` repaints with `draw()` + `drawNext()` instead of going through
  `init()`, so changing skin mid-game keeps the board; it is guarded by
  `if (board)` because it also runs at load time, before `init()`.
- `drawNutHole()` keeps the `rect` + `arc` + `fill('evenodd')` ring (the hole shows
  the board background) and the hardcoded `+1,+1` offset; only its color
  (`colors[NUT]`) and a per-skin alpha (`SKIN_NUT_ALPHA`, to tone the ring down in
  neon) depend on the skin.
- The `<select>` needs two guards because the game's `keydown` listener is on
  `document` and does not `preventDefault()` the arrow keys: its own `keydown`
  handler calls `stopPropagation()` (while the select has focus its keys are its
  own and never reach the game), and the `change` handler calls `blur()` (after
  picking a skin with the mouse the focus goes back to the game, so the next
  ArrowDown soft-drops instead of advancing the select and flipping the skin).

### The pause menu (`#pause-menu`)

Pausing opens a menu inside the existing `#overlay`, as a new sibling after `#overlay-score`. `togglePause()` shows it (`showPauseMenu()`) and hides it (`hidePauseMenu()`); `endGame()` does not touch it, so game over keeps the plain overlay + `#restart-btn`. Those two functions also toggle `.hidden` on `#restart-btn` itself, so the overlay's restart button and the menu's own "Reiniciar" are never on screen together — the swap is in the functions, not in markup order.

- `Escape` is a second pause key alongside `KeyP`, on the same early-return line of the `keydown` handler — except while `#start-level` has focus, where Escape belongs to the open dropdown. The existing `if (paused || gameOver) return;` right below is what keeps every game key from reaching the piece while the menu is open; nothing in the menu code does that.
- `hidePauseMenu()` blurs whatever holds focus (unless that is `document.body`, so page load is untouched). Every game key is also a widget key: without this, a menu button clicked with the mouse — or the panel's theme switch — stays focused and the next `Space` (hard drop) or `Enter` activates it instead of playing. `init()` calls it too, so restarting from the menu leaves nothing focused.
- `handleMenuKey` is a second `document` keydown listener, registered after the game's. It cycles `Tab`/`Shift+Tab` inside the menu (it is `role="dialog" aria-modal`, so focus must not land on the panel behind the blurred overlay) and moves the focus with the arrows over the `.pause-option` buttons only: the `<select>` is deliberately outside the arrow ring, because arrowing into a closed select changes its value — it is reached with Tab or the mouse, and there the arrows keep their native meaning.
- **Start level**: `startLevel` is the persisted preference (`localStorage`, key `tetris-start-level`, validated in `setStartLevel()` to an integer 1..`MAX_START_LEVEL`, otherwise 1); `baseLevel` is the level the *current* game started at. `init()` copies one into the other, and `clearLines()` computes `level = baseLevel + Math.floor(lines / 10)` — that split is what makes changing the selector mid-game affect only the next one. `MAX_START_LEVEL` is derived from `startLevelSelect.options.length`, so the `<option>` list in `index.html` is the single source of truth for the range. `levelInterval()` is the one copy of the `Math.max(100, 1000 - (level - 1) * 90)` formula, used by both `init()` and `clearLines()`.
- The menu's key list is a copy of the one in `.panel-section.controls`, not a move: both exist, and adding a key means updating both.
- Its CSS is one block at the end of `style.css`, including its own `:root` / `body.light-theme` variable pair, so the whole feature stays in one place; any new color needs both halves, since the light theme only redefines variables.
