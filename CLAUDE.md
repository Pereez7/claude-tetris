# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris implemented in vanilla JavaScript with HTML5 Canvas and CSS. No dependencies, no build step, no `package.json`. README is in Spanish.

## Running

No install/build required.

```bash
open index.html        # macOS, opens directly
# or serve locally:
python3 -m http.server 8000
npx serve .
php -S localhost:8000
```

There is no test suite, linter, or bundler in this repo — do not introduce one unless asked.

## Architecture

Three files, all logic in `game.js` (~300 lines, single script, no modules):

- `index.html` — DOM: `#board` canvas (300×600, 10×20 grid at `BLOCK=30`px), `#next-canvas` preview, HUD spans (`#score`/`#lines`/`#level`), and `#overlay` for pause/game-over.
- `style.css` — dark/retro theme, flexbox layout, no CSS frameworks.
- `game.js` — game state and loop, all in module-level `let` globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`).

Key mechanics in `game.js`:
- **Board**: `ROWS × COLS` matrix, each cell `0` (empty), piece color index `1-8`, or `HOLE` (`-1`, the nut piece's center — see below).
- **Pieces**: square matrices in `PIECES`; `rotateCW` does transpose+reverse for rotation. Piece `8` ("N", nut/tuerca) is a 3×3 ring — `PIECE_HOLES[8] = [[1,1]]` marks its center as a hole.
- **Nut hole**: `HOLE = -1` is transparent to `collide()` (`board[ny][nx] > 0`) so other pieces can pass through it, but `clearLines()`'s `v !== 0` check still counts it as filled — it just can never be overwritten once locked. `merge()` writes `HOLE` into the board for cells listed in `PIECE_HOLES` (only if still empty). `drawBlock()`/`drawHole()`/`drawPieceHoles()` render it as a stroked circle instead of a filled block, for the locked board, the current piece, its ghost, and the `next` preview.
- **Collision**: `collide(shape, ox, oy)` checks board bounds and filled cells (`> 0`; `HOLE` doesn't block).
- **Wall kicks**: `tryRotate()` retries rotation at x-offsets `[0, -1, 1, -2, 2]` before giving up.
- **Game loop**: `loop(ts)` via `requestAnimationFrame`, accumulates `dt` into `dropAccum`, advances piece when it exceeds `dropInterval`.
- **Line clear**: `clearLines()` scans bottom-up, splices full rows, unshifts empty rows at top.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` × `level`; hard drop = 2 pts/cell, soft drop = 1 pt/row.
- **Leveling**: `level = floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Ghost piece**: `ghostY()` projects landing row, drawn via `drawBlock(..., alpha=0.2)`.

Flow: `init()` → `createBoard()` + `spawn()` → `requestAnimationFrame(loop)`. `spawn()` promotes `next` to `current` and generates a new `next`; if the new piece immediately collides, `endGame()` fires and shows the Game Over overlay. Input is handled by a single `keydown` listener (arrows move/rotate/soft-drop, Space hard-drops, P toggles pause).

## Tuning constants

Adjustable at the top of `game.js`: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `PIECES`, `PIECE_HOLES`, `LINE_SCORES`, `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `#board` canvas `width`/`height` in `index.html` to match (`COLS×BLOCK` and `ROWS×BLOCK`).
