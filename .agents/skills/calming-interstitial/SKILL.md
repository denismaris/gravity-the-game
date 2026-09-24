---
name: calming-interstitial
description: Canonical build spec for Gravity's calming interstitial - the maze-rolling break screen between level batches (`src/interstitial/CalmingInterstitialScreen.tsx`). The recessed-channel 3D model the board is built from, exact measured colours and maze shape, the swipe-to-roll mechanic, the 4-layer render-performance split, and every real bug already found and fixed here. Load this before touching that screen or its reference files, so a fresh pass works from the actual measured spec instead of re-guessing (or regressing) hard-won specifics.
---

# Calming Interstitial - Build Spec

This screen went through a very long, expensive trial-and-error cycle before
converging on something correct. Most of that cycle was *not* taste
disagreement - it was guessing at a design instead of measuring it, and
tuning numbers instead of finding the actual bug. This document exists so
that never has to happen again for this screen. If you're about to change
`src/interstitial/CalmingInterstitialScreen.tsx`, read this first.

## What this screen is

A small maze the player rolls a ball through by swiping, painting every
tile it crosses. It runs between level batches as a deliberate break - no
score, no fail state, no persisted progress. Filling `MAZE_TARGET_COUNT`
(3) mazes ends the break and hands off to the next real puzzle.

## The reference is a real file - use it, don't eyeball it

There are **two** reference screenshots, and they show different games with
different construction. The newer one is authoritative for how the board is
built:

```
android/design-reference/Screenshot 2026-09-24 at 12.11.49.png   <- AUTHORITATIVE
android/design-reference/Screenshot 2026-09-18 at 21.33.29.png   <- earlier, superseded
```

The earlier screenshot shows a flat board: rounded separated tiles, a
uniform dark halo, no depth of any kind (this is pixel-verified, not an
impression). An enormous amount of time went into matching it, and the
result was repeatedly rejected as "not 3D" and "looks bad" - because the
user's actual target was never that flat look. **Build from the newer
screenshot.** Keep the older one only for the `LEVEL_11_PATTERN` grid,
which is still the shape in use.

**If you need to re-verify or extend the visual spec, read this file
directly and sample it with Python/PIL** (`PIL.Image.open(...).getpixel(...)`)
- don't estimate colors or proportions by eye from a description, including
this one. Every color and dimension below was obtained by writing a small
throwaway script that scans the image for grid divider lines (local
brightness dips against neighboring pixels) to find exact cell boundaries,
then samples each cell's own center pixel. That methodology is reusable if
a *different* reference level ever needs to be measured and added.

Do not re-derive the numbers below from memory or vibes if the reference
file is available to re-check them against.

## Measured visual facts (do not re-estimate these)

### The board is a recessed channel, not tiles on a page

This is the single most important fact about this screen, and getting it
wrong is what made every earlier pass read as flat:

**The maze is a groove carved into a white surface, viewed from slightly
above and in front.** The dark region is the floor of that groove; the
white around and inside it is the top of the surrounding material.

**Exactly one wall face is ever drawn: the far (top) one.** A floor tile
gets a face, ~22px tall against a ~64px cell (`TOP_FACE_RATIO = 0.34`),
precisely when there is no floor above it. Left, right and bottom edges
get nothing at all. This is measured: scanning straight through an
interior hole (`y=530` in the 2026-09-24 reference) shows floor running up
to the white with 2-3px of antialiasing and no grey whatsoever on either
side.

**The face stands in the space *above* its tile - it does not overlay the
tile's own top.** Measured: a floor tile directly below a wall runs ~56px
against a ~62px row pitch, i.e. essentially its full height, with the
face occupying the white above it. Drawing the face inside the tile's top
third instead (an earlier version) cropped every tile that happened to
have a wall above it, so the board came out with tiles at two different
heights depending on their neighbours - which is exactly what "the tile is
not fully visible" was describing. Consequence: the top row's face sits at
a *negative* y in grid coordinates, so the arena reserves one face of
headroom (`topFacePx`) and the board is translated down into it, or the
topmost wall is clipped by the canvas edge.

That asymmetry *is* the 3D effect - a face on every side is just a flat
outline, which is what the old uniform "peek" halo was.

**Do not add left/right faces back.** They were tried, and they are the
cause of the "corners look weird and not complete" bug: a vertical face
and a horizontal one meeting at a hole's corner leave a notch wherever
their ends disagree, and no amount of tuning the join fixes a face that
shouldn't exist. With only horizontal faces there are no L-junctions to
get wrong. In code this is `MazeWallFaces`, which early-returns on
`northOpen` and reads no other direction.

(The shape's *outermost* left/right edges do show a ~5px grey sliver in
the reference, and it drifts outward toward the bottom of the screen -
that is true perspective, the whole board being slightly wider at the
near edge. It is not reproduced, and at this size it isn't missed.)

Each far wall also carries two measured details: a 2px lighter lip along
its very top (`WALL_FACE_LIP`, where the face meets the white surface) and
a 3px darker contact line at its base (`WALL_FOOT`, the floor in the
wall's own shadow).

### Colours (all sampled from the 2026-09-24 reference)

- Background / the surface the groove is cut into: `#FFFFFF`.
- Floor, unpainted: `#2A2A2E` - a near-black, not a mid grey. The earlier
  muted `#928CA0` on white is most of why this screen read as washed out;
  the contrast between a near-black floor and one saturated paint colour
  is most of why the reference reads as crisp.
- Floor, painted: `#81DEFC` - a bright, saturated cyan.
- Wall face: `#626568`. Lip: `#74767E`. Foot: `#343539`.
- Ball: polished pewter, `#B8C4D2` body falling to `#6C757F` at the rim.
  Deliberately **not** tinted to the current paint colour - it has to stay
  legible on the near-black floor and on every colour the paint cycles
  through, and a ball the same hue as its own trail stops reading as a
  separate object.
- Title: `#1F2025`, bold condensed sans.

### Geometry

- Floor tiles are **square-cornered and gapless** - one continuous slab
  ruled by faint seams, not separate rounded tiles with gaps between them.
  No `CELL_RADIUS`, no `CELL_GAP`, no bridge shapes to erase gaps on open
  passages. All of that machinery existed to serve the older reference and
  is gone.
- Seams between adjacent tiles are ~2px and *faint*. They step **away**
  from the floor rather than always darkening it: faintly lighter on the
  near-black floor, faintly darker on the bright paint. Always darkening
  (the obvious rule) makes the seam vanish entirely on the dark floor.
- Every face is one flat colour. No gradient, no bevel, no blur anywhere -
  verified by sampling; faces are flat to within sensor noise. A
  `LinearGradient` bevel and a `BlurMask` shadow have each been tried
  twice on this screen and both times read as muddy rather than
  dimensional. Depth comes from *which* edges get a face and how wide each
  one is, never from shading.
- Give the board real margin (`SIDE_MARGIN`). Letting it bleed to the
  screen edge to "make it dominant" was tried and made the screen feel
  cramped; the reference floats a noticeably smaller board in white space.
- Maze grid: **7 columns x 9 rows**, uniform ~53-54px cells in the
  original screenshot. The exact active/inactive pattern (measured, not
  invented) is the `LEVEL_11_PATTERN` constant in the source file:
  ```
  ###.###
  #.#.#.#
  #.#.#.#
  #######
  ..#.#..
  #######
  #.#.#.#
  #.#.#.#
  ###.###
  ```
  Two ring/bracket structures joined by a double spine - this shape has
  genuine loops (cycles), which is fine for this screen's continuous
  rolling (no spanning-tree / branch-stop requirement the way a discrete
  auto-slide-to-wall mechanic would need).
- Every adjacent pair of active cells is an open edge - the reference
  shows no internal walls within its own connected shape, only the outer
  silhouette. Don't run a maze-generation algorithm (spanning tree,
  corridor-carving) against this pattern; just connect every
  active-adjacent pair directly (see `buildLevel11Maze`).
- The ball itself, at rest, is a **plain round sphere** - not the
  irregular ink-blot/blob shape an earlier pass mistakenly built from a
  literal read of the reference's motion-blur artifact. It only ever
  turns briefly oval on an actual wall-contact squash, springing back
  round immediately after. The reference's spiky/splattered look is an
  **impact effect** (`SPIKE_NUBS`), not the ball's resting shape - it only
  renders for `SQUASH_MS` right after a wall hit, bursting outward and
  fading, never as a permanent decoration.
- No on-screen gauge or directional pad. Swipe is the *only* input. Both
  were tried and explicitly removed - they ate the width budget the
  7-column maze needed, and the pad's "hold to drive" model added
  complexity the swipe-only "flick" model doesn't need.
- **No speckle trail and no glow cone behind the ball.** Both existed to
  chase the older reference's "wet paint" look, neither appears in the
  current one, and together they rebuilt up to ~70 Skia nodes *every
  frame* - by far the largest per-frame cost on this screen. The painted
  floor is the trail now. Don't add a decorative per-frame effect here
  without counting what it costs first.

## The mechanic: continuous roll, not discrete slide

The ball's position is continuous (`ball.x`/`ball.y`, real floats, not
snapped to cell centers). A swipe starts it rolling in one cardinal
direction at a constant speed (`ROLL_CELLS_PER_SEC`, currently 34) until it
meets a wall, then auto-stops - there is no "hold a button" state anymore
(that was tried, then explicitly removed along with the directional pad).
A new swipe can redirect the ball mid-roll without waiting for a wall.

**Corridor width is exactly one cell.** The axis perpendicular to travel
has no meaningful sub-cell position, so it's snapped to the cell's own
center the instant a new direction starts (`tryStartMove`).

## Bugs already found here - do not reintroduce these

Every one of these produced a real, user-visible symptom before being
found. If a future change touches the same code, re-check against these.

1. **The ball stopping mid-wall ("stuck at half the ball").** The ball's
   *center* was being stopped exactly on the wall's grid line. Since the
   ball has a real radius (`BALL_RADIUS_RATIO = 0.42`, a large fraction of
   a cell), stopping the center there left half the ball visually
   overlapping the wall cell. Fix: the stop line is pulled back into the
   valid cell by one full ball radius before the wall is checked
   (`stopLine = wallAhead ? rawBoundary - dir * ballRadiusPx : rawBoundary`
   in the tick loop). An *open* passage needs no such pullback - only an
   actual wall stop does.

2. **Permanent stuck ball (an off-by-one in `cellAt`'s own `Math.floor`).**
   Before fix #1 existed, stopping the ball's center exactly on
   `(cellIndex + 1) * cellSize` (moving in the positive direction) landed
   it exactly on the far, *invalid* cell's own edge. `Math.floor` then read
   the ball as sitting inside that invalid cell, which has no recorded
   open edges in any direction (edges are only ever built from active
   cells), so every future direction reported "blocked" forever. Fix #1
   above also happens to fix this, since the radius pullback keeps the
   stop position strictly inside the valid cell, off the exact grid line.
   Verified with a headless simulation (see PR history / commit messages
   from this period) that repeatedly drove the ball into walls from every
   direction 400 times: the bug reproduced in 399/400 cases before the
   fix, 0/400 after.

3. **A `lerpColor`/`shade` format mismatch silently rendering a tile
   black.** `lerpColor` used to return an `rgb(r,g,b)` string, which then
   got passed straight into `shade()` (which parses its input as
   `#rrggbb` hex). Feeding it an `rgb(...)` string produced NaN channel
   values with no error, which Skia rendered as opaque black. If you ever
   reintroduce a color-interpolation helper, make sure every helper in the
   chain agrees on hex vs. `rgb()` string format, or centralize this in
   one representation.

4. **Swipe gesture only fired on release, not during the drag.** The
   shared `src/components/useSwipeGesture.ts` hook (correct for Gravity's
   own board, where a swipe is one discrete, deliberate action) only
   reports a direction in `onPanResponderRelease`. For continuous rolling,
   this means the ball wouldn't start moving until the player finished
   their *entire* drag-and-lift gesture - a real, full-gesture's worth of
   input latency in front of every move, independent of render
   performance. This was the actual cause of persistent "feels laggy"
   reports that survived multiple real rendering-performance fixes. Fixed
   with a *local*, screen-specific `useImmediateSwipeGesture` that fires
   in `onPanResponderMove` the instant the drag crosses the swipe
   threshold. **Do not "fix" this by modifying the shared
   `useSwipeGesture.ts`** - it's correct for its own (different) use case
   elsewhere in the app; this screen needs its own gesture, not a shared
   one with a new mode flag, unless a second screen independently needs
   the same immediate-fire behavior.

5. **The whole maze re-rendering every animation frame for no reason.**
   The shadow layer, the bevelled-border layer, and the settled fill layer
   (~130+ shapes total across a 44-cell maze, several carrying a real Skia
   blur filter) only actually change when a maze is generated or a new
   cell gets painted - both rare events (a few times per maze) compared to
   the 60-times-a-second render loop driving the ball's own animation.
   Redrawing all of them every tick was a real, measurable performance
   cost, not a style issue. There is no Reanimated in this project, so the
   tick loop drives a `setTick` re-render of the whole component every
   frame - which makes *what sits in that tree* the thing that matters.
   Rendering is split into four layers, each invalidated by a different
   thing:
   - `MazeFloorBase` - the whole floor in its unpainted state.
     `React.memo`'d on `cells`/`cellSize`, which stay referentially stable
     within one maze (see the `activeCells` `useMemo` keyed on `[maze]`).
     Renders once per maze and never again.
   - `MazePaintedFloor` - **only** the tiles actually painted so far,
     drawn over the base, `React.memo`'d against a `paintedVersion`
     counter that moves only on a real paint event. Split from the base
     deliberately: a fast roll crosses ~30 tiles a second, so what matters
     is the cost of *one* invalidation. Redrawing all ~44 tiles each time
     (the earlier single-layer version) re-ran the entire floor 30 times a
     second during exactly the moments the screen most needs to stay
     smooth.
   - `MazeFadeOverlay` - the **only** part that genuinely needs a fresh
     render every tick: an unpainted-tone copy of just the 0-2 tiles
     currently inside their own `PAINT_FADE_MS` (220ms) window, fading
     *out* to reveal the painted tile underneath. Same crossfade as
     interpolating every tile's colour, without touching all ~44 to do it.
   - `MazeWallFaces` - the 3D wall faces. Depends only on the maze shape,
     so `React.memo`'d on `cells` and rendered once per maze. Drawn
     **last** so the walls always occlude the floor and the fading tile -
     the whole illusion is that they stand above it.

   If you add a new per-cell visual effect, work out which of these four
   layers it belongs to *before* adding it, and what invalidates it -
   "just redraw everything every frame" is the default that caused this
   problem in the first place, twice.

6. **Frame-time safety margin vs. roll speed.** The per-tick `dt` is
   clamped (`Math.min(..., 0.018)`, paired with `ROLL_CELLS_PER_SEC = 34`)
   so that `ROLL_CELLS_PER_SEC * dtCap` stays safely under 1 cell-width
   (currently ~0.61, about 39% margin). If roll speed is ever increased
   further, the dt cap has to come down proportionally, or a frame-time
   spike could let the ball's proposed position jump clean over a
   one-cell-wide wall before that same tick's collision check runs,
   tunnelling through undetected. Don't increase `ROLL_CELLS_PER_SEC`
   without rechecking this margin (and re-running the headless
   wall-bounce/full-coverage simulation to confirm no regressions - see
   the verification section below).

## Verification pattern used throughout this screen's history

Real device touch/drag input and real frame timing can't be exercised from
this environment. What *can* be verified headlessly: write a small
standalone Node script that reimplements the exact tick-loop math
(collision, stop-line, cell resolution) against the real
`LEVEL_11_PATTERN`, then drive it through hundreds of simulated
wall-bounces and a BFS-planned full-coverage traversal. This caught both
the permanent-stuck bug and confirmed every speed increase stayed safe
before ever touching the simulator. Prefer this over guessing when a
change touches movement/collision math - screenshots can't show you a
timing bug.
