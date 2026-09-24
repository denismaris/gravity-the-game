import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderHandlers, PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, Circle, Group, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { ConfettiBurst, PressableScale } from '../components';
import { Direction } from '../game/engine';
import { Cell, cellKey, DIRS, edgeKey, hasOpenEdge, MazeShape } from '../game/maze';
import { shade, triggerFeedback, useReducedMotion } from '../game/rendering';
import { theme } from '../theme';

export interface CalmingInterstitialScreenProps {
  /** Called once, either after `MAZE_TARGET_COUNT` mazes are filled or the
   * player skips - the caller (App.tsx) treats the two identically: move
   * on to the next level's first puzzle. */
  onDone: () => void;
}

/**
 * The calming interstitial between level batches: a small maze the player
 * rolls a ball through by swiping - the only input, no on-screen gauge or
 * directional pad - painting every tile it crosses. Each swipe starts the
 * ball rolling continuously in that direction until it meets a wall; a new
 * swipe redirects it mid-roll without waiting for one. Filling one maze
 * bursts with confetti and starts the next; finishing `MAZE_TARGET_COUNT`
 * of them ends the break - a real, visible goal rather than a clock nobody's
 * watching. `SAFETY_DURATION_MS` is only a fallback for a session that
 * never engages at all.
 */
const MAZE_TARGET_COUNT = 3;
const SAFETY_DURATION_MS = 90000;
/** The maze's own bounding grid - taller than wide, like the reference
 * this is chasing (a phone screen's own aspect, not a square). */
const BOUNDING_COLS = 7;
const BOUNDING_ROWS = 9;
/**
 * The maze is a channel *recessed into* a white surface, seen from
 * slightly above and in front - not a set of tiles lying on top of a page.
 * That single idea is where all of this screen's depth comes from, and it
 * is measured from `android/design-reference/Screenshot 2026-09-24 at
 * 12.11.49.png` rather than invented.
 *
 * Because the camera looks down *and forward*, the only wall face ever
 * visible is the far (top) one. Nothing is drawn on a tile's left, right
 * or bottom edge - verified by scanning straight through an interior hole
 * in the reference, where floor runs up to the white with no grey at all.
 * Getting that asymmetry right is what makes the board read as carved
 * rather than printed: a face on every side is just a flat outline, which
 * is what every earlier pass at this screen drew.
 *
 * Floor tiles are square-cornered and gapless: one continuous slab ruled
 * by faint seams, not separate rounded tiles with a halo between them.
 */
/** Height of the far wall's face, as a fraction of one cell - measured at
 * ~22px against a ~64px cell pitch. */
const TOP_FACE_RATIO = 0.34;
/** A lighter lip along the very top of the far wall, where its face meets
 * the white surface above - measured at 2px. */
const LIP_PX = 2;
/** A darker contact line where a wall's face meets the floor at its base -
 * measured at 3px. */
const FOOT_PX = 3;
/** Seam between two adjacent floor tiles. Deliberately faint: in the
 * reference these read as ruling on one continuous surface, nothing like a
 * structural wall. */
const SEAM_WIDTH = 2;
/** Ball radius as a fraction of one cell - scales with whatever `cellSize`
 * this device's arena works out to, rather than a fixed pixel size. */
const BALL_RADIUS_RATIO = 0.42;
/** Continuous rolling speed, in cells per second - not a discrete tween
 * between cell centres. The ball only ever moves while a direction is
 * actively being driven (a held pad button, or the brief "flick" a
 * completed swipe starts) and stops the instant that stops or a wall gets
 * in the way, wherever it happens to be - free rolling, not cell-snapping. */
const ROLL_CELLS_PER_SEC = 34;
/** How long the squash pulse - a wall arrival, or a press that couldn't
 * move the ball at all - takes to spring back round, as a smooth
 * 0->peak->0 pulse (`Math.sin(progress * Math.PI)`), not a linear fade. */
const SQUASH_MS = 150;
/** How long a tile takes to cross-fade from its wall tone to the painted
 * accent once the ball crosses it - within the skill's own "small
 * feedback" duration budget (100-250ms), not a teleporting colour flip. */
const PAINT_FADE_MS = 220;
const SQUASH_MAGNITUDE = 0.22;
/** How far the whole board recoils on a wall hit. Small on purpose - a
 * couple of pixels reads as impact, more reads as the screen glitching. */
const IMPACT_JOLT_PX = 4;
/** How long the maze stays fully painted, confetti and all, before the
 * next one replaces it. */
const CELEBRATE_PAUSE_MS = 750;

/** A plain, bright page - the reference's own backdrop is a plain white
 * card, not a themed dark panel. */
const SCREEN_BG = '#FFFFFF';
// Every colour below is sampled directly out of the saved reference file
// (`android/design-reference/Screenshot 2026-09-24 at 12.11.49.png`) with
// a Python/PIL script, not estimated by eye - the exact value is quoted in
// each comment. The palette is deliberately far bolder than this screen's
// earlier grey-on-white pass: a near-black floor against one saturated
// paint colour is most of why the reference reads as crisp, and a muted
// grey-violet floor on white is most of why the earlier pass read as
// washed out.
/** The floor before the ball has crossed it - the single most common
 * colour in the reference after the white surround. */
const FLOOR_UNPAINTED = '#2A2A2E';
/** A wall's face where it drops to the floor. One flat tone for every
 * wall, regardless of whether the floor beside it is painted. */
const WALL_FACE = '#626568';
/** The lit lip along a wall's very top edge, where its face meets the
 * white surface it's cut into. */
const WALL_FACE_LIP = '#74767E';
/** The contact line at a wall's base - the floor in its own shadow. */
const WALL_FOOT = '#343539';
const TITLE_COLOR = '#1F2025';
/** The ball, measured off the reference: a cool polished pewter, lit from
 * the top left like every other object in this app. */
const BALL_LIGHT = '#EDF2F7';
const BALL_BODY = '#B8C4D2';
const BALL_RIM = '#6C757F';

/** Three colour "chapters" the paint cycles through, one per maze in a
 * break, each a [light, fill, dark] trio - `fill` is the floor's colour
 * once painted, `dark` its shaded end used by the wall-contact splash.
 *
 * The cyan is measured (#81DEFC, uniform across the whole painted region);
 * the other two are unmeasured, since the reference only shows one
 * chapter. Both are picked to sit at a similar brightness and saturation
 * against the near-black floor, because that contrast is the effect worth
 * preserving - a muted accent here would sink into the floor. */
const PAINTED_VARIANTS: ReadonlyArray<[string, string, string]> = [
  ['#C4EEFE', '#81DEFC', '#3E8FAF'],
  ['#D8C8FB', '#A88BF5', '#5B44A8'],
  ['#FFD9A8', '#FFB55C', '#A86A22'],
];

/**
 * The shapes the break cycles through. The first is the measured
 * reference level (see `LEVEL_11_PATTERN`'s history in this screen's
 * skill doc); the rest were found by enumerating every 4-fold-symmetric
 * 7x9 layout and keeping only those that pass all of:
 *
 *  - fully connected, and no dead ends at all (a dead end forces a
 *    backtrack, which is the opposite of calming),
 *  - corridor-like rather than a solid slab (at most two cells with all
 *    four neighbours open),
 *  - 3 to 8 loops, so there is always a way round rather than only back,
 *  - **finishable using wall stops alone.**
 *
 * That last one is the non-obvious constraint and it is brutal: of 8185
 * layouts meeting the other criteria, only 71 survive it. The ball can in
 * principle be redirected mid-roll, but at `ROLL_CELLS_PER_SEC` a corridor
 * cell goes by in under 30ms, so in practice a player turns at walls. A
 * maze that can only be completed by precise mid-corridor turns is
 * frustrating, not restful - so a layout that cannot be finished by
 * rolling wall to wall is not shipped, however pretty it looks.
 */
const MAZE_PATTERNS: ReadonlyArray<ReadonlyArray<string>> = [
  // The measured reference: two ring structures joined by a double spine.
  ['###.###', '#.#.#.#', '#.#.#.#', '#######', '..#.#..', '#######', '#.#.#.#', '#.#.#.#', '###.###'],
  // The same skeleton opened out - one clear band across the middle.
  ['###.###', '#.#.#.#', '#.#.#.#', '#######', '#.....#', '#######', '#.#.#.#', '#.#.#.#', '###.###'],
  // A narrow waist with wide shoulders.
  ['..###..', '###.###', '#.#.#.#', '###.###', '#.....#', '###.###', '#.#.#.#', '###.###', '..###..'],
  // Stepped shoulders, an open heart.
  ['##...##', '###.###', '#.#.#.#', '#.###.#', '#.....#', '#.###.#', '#.#.#.#', '###.###', '##...##'],
  // Chunky and open - the calmest of the set to sweep through.
  ['###.###', '#.###.#', '##...##', '##...##', '.#...#.', '##...##', '##...##', '#.###.#', '###.###'],
];

/** Builds a `MazeShape` from one pattern - every adjacent pair of active
 * cells is an open edge (these layouts have no internal walls, only an
 * outer silhouette and their holes), which is what produces the loops.
 *
 * The start is the first active cell in row-major order rather than a
 * hardcoded (0,0): several of the patterns above have an inactive
 * top-left corner, and starting the ball outside the maze would leave
 * every direction reporting blocked forever. */
function firstActiveCell(pattern: ReadonlyArray<string>): Cell {
  for (let row = 0; row < pattern.length; row++) {
    const col = pattern[row].indexOf('#');
    if (col !== -1) return { col, row };
  }
  return { col: 0, row: 0 };
}

function buildMaze(pattern: ReadonlyArray<string>): MazeShape {
  const rows = pattern.length;
  const cols = pattern[0].length;
  const active = new Set<string>();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (pattern[row][col] === '#') active.add(cellKey(col, row));
    }
  }
  const openEdges = new Set<string>();
  for (const k of active) {
    const [col, row] = k.split(':').map(Number);
    for (const d of DIRS) {
      const next = { col: col + d.dc, row: row + d.dr };
      if (active.has(cellKey(next.col, next.row))) openEdges.add(edgeKey({ col, row }, next));
    }
  }
  return { cols, rows, active, openEdges, start: firstActiveCell(pattern) };
}

function generateMaze(level: number): MazeShape {
  return buildMaze(MAZE_PATTERNS[level % MAZE_PATTERNS.length]);
}

function cellAt(pos: { x: number; y: number }, cellSize: number): Cell {
  return { col: Math.floor(pos.x / cellSize), row: Math.floor(pos.y / cellSize) };
}

function cellCenter(cell: Cell, cellSize: number): { x: number; y: number } {
  return { x: cell.col * cellSize + cellSize / 2, y: cell.row * cellSize + cellSize / 2 };
}

function ballRadiusFor(cellSize: number): number {
  return cellSize * BALL_RADIUS_RATIO;
}

/** A handful of thin, elongated "spike" nubs scattered asymmetrically
 * around the ball's rim for the wall-contact splash burst (see the
 * `squashActive` block below) - a close crop of the reference file's own
 * impact moment shows these as thin radiating slivers, not round
 * droplets: each is a unit circle stretched along its own outward angle
 * (`length` along the spike, `width` across it) rather than a plain small
 * circle. Fixed, uneven angles/lengths - not evenly divided around the
 * circle the way a gear or flower would be. This is a transient impact
 * effect only, not the ball's own resting shape (which is a plain round
 * sphere - see the ball-rendering block's own comment). */
const SPIKE_NUBS: ReadonlyArray<{ angle: number; dist: number; length: number; width: number }> = [
  { angle: 0.3, dist: 0.92, length: 0.22, width: 0.14 },
  { angle: 1.1, dist: 0.98, length: 0.16, width: 0.11 },
  { angle: 1.9, dist: 0.88, length: 0.24, width: 0.13 },
  { angle: 2.7, dist: 0.95, length: 0.15, width: 0.1 },
  { angle: 3.6, dist: 0.9, length: 0.23, width: 0.15 },
  { angle: 4.3, dist: 0.97, length: 0.17, width: 0.11 },
  { angle: 5.0, dist: 0.87, length: 0.2, width: 0.12 },
  { angle: 5.8, dist: 0.94, length: 0.14, width: 0.1 },
];


/** The ball's own visual state - `x`/`y` are its true continuous position
 * (anywhere within the corridor, not snapped to a cell centre), and
 * `rollAngle` is a real no-slip rolling rotation so the splat's own drip
 * marks visibly swing as it travels, the cue that sells motion rather
 * than a flat disc sliding. */
interface BallVisual {
  x: number;
  y: number;
  rollAngle: number;
}

/** The ball is being actively driven in one cardinal direction, from a
 * completed swipe's own "flick" - it auto-clears itself the instant it
 * meets a wall, since there's no finger held down to keep it pressed
 * there (swipe is the *only* input now - see the removed directional pad
 * in this file's own history). `blocked` latches true the first frame a
 * wall stops further progress, so the contact squash/haptic fires once on
 * that transition rather than every frame. */
interface MovingState {
  dc: number;
  dr: number;
  blocked: boolean;
}

interface SquashPulse {
  readonly axis: 'x' | 'y';
  readonly at: number;
  /** Which way the ball was travelling when it hit, so the board can jolt
   * *with* the impact rather than in some arbitrary direction. */
  readonly dc: number;
  readonly dr: number;
}

/** One active cell's own static facts - which of its four sides continue
 * into more floor - precomputed once per maze (see the `activeCells`
 * `useMemo` in the main component) rather than re-derived from scratch on
 * every animation frame. A side that *isn't* open is a wall, and every
 * wall face and floor seam is decided from these four flags. */
interface CellInfo {
  readonly key: string;
  readonly col: number;
  readonly row: number;
  readonly northOpen: boolean;
  readonly southOpen: boolean;
  readonly eastOpen: boolean;
}

/** The maze's own extruded border - the block's dark side face and the
 * rim sitting on top of it - fully static once a maze exists (position,
 * size and colour never depend on paint state or elapsed time, only on
 * `cells`/`cellSize`, which stay referentially stable across frames
 * within one maze). `React.memo`'d separately from the per-frame fill
 * layer so React skips re-rendering (and Skia skips re-painting) two full
 * passes over every active cell 60 times a second for no reason, rather
 * than only the handful of times a maze actually changes - which is also
 * what makes a second static pass affordable here at all.
 *
 * Every face is flat solid colour: no gradient, no blur, no drop shadow.
 * Pixel-sampling the reference confirmed its tiles and borders are
 * hard-edged flat colour with zero gradient and no diffuse shadow, and a
 * bevel/`BlurMask` pass was tried here twice and both times read as muddy
 * rather than dimensional. The depth instead comes from `SIDE_DEPTH`
 * offsetting the dark layer downward, so it reads as a block's side face
 * rather than a halo - shape, not shading. */
/**
 * The far wall of the recessed channel - the only one actually drawn.
 *
 * A floor tile gets a wall face exactly when there's no floor above it.
 * Nothing is drawn on a tile's left, right or bottom edge. That is
 * measured, not a simplification: scanning straight through an interior
 * hole in the reference (`y=530`) shows floor running right up to the
 * white with only 2-3px of antialiasing on either side, and no grey at
 * all. Only the face *below* a wall block is ever visible.
 *
 * Drawing left/right faces as well was this screen's "weird, incomplete
 * corners" bug: a vertical face and a horizontal one meeting at a hole's
 * corner leave a notch wherever their ends don't agree, and no amount of
 * fiddling with the join fixes a face that shouldn't be there. With only
 * horizontal faces there are no L-junctions to get wrong.
 *
 * Fully static once a maze exists: which sides are walls depends only on
 * `cells`, never on paint state or elapsed time, so this whole pass is
 * `React.memo`'d and skips re-rendering on the ~30 paint events a second
 * a fast roll produces, let alone every frame.
 *
 * Every face is one flat colour. No gradient, no blur, no bevel: the
 * reference's faces are flat to within sampling noise, and the depth is
 * carried entirely by *which* edges get a face and how wide each is.
 */
const MazeWallFaces = React.memo(function MazeWallFacesImpl({
  cells,
  cellSize,
}: {
  cells: ReadonlyArray<CellInfo>;
  cellSize: number;
}): React.JSX.Element {
  const topFace = Math.round(cellSize * TOP_FACE_RATIO);

  return (
    <>
      {cells.map(({ key: k, col, row, northOpen }) => {
        if (northOpen) return null;
        const x = col * cellSize;
        // The face stands in the space *above* the tile, not on top of it.
        // Measured: a floor tile directly below a wall is ~56px of a ~62px
        // pitch in the reference - essentially its full height. Drawing the
        // face inside the tile's own top third instead (the previous
        // version) visibly cropped every tile that had a wall above it,
        // so tiles came out at two different heights depending on their
        // neighbours.
        const y = row * cellSize - topFace;

        return (
          <Group key={`wall-${k}`}>
            <Rect x={x} y={y} width={cellSize} height={topFace} color={WALL_FACE} />
            <Rect x={x} y={y} width={cellSize} height={LIP_PX} color={WALL_FACE_LIP} />
            <Rect x={x} y={y + topFace - FOOT_PX} width={cellSize} height={FOOT_PX} color={WALL_FOOT} />
          </Group>
        );
      })}
    </>
  );
});

/** One floor tile: the square plus whichever seams it owns. Shared by the
 * two floor layers below so an unpainted and a painted tile are guaranteed
 * to occupy exactly the same pixels - any drift between them would show as
 * a hairline of the wrong colour along a painted tile's edge. */
function floorTile(
  { key: k, col, row, eastOpen, southOpen }: CellInfo,
  cellSize: number,
  floor: string,
  seam: string,
): React.JSX.Element {
  const x = col * cellSize;
  const y = row * cellSize;
  return (
    <Group key={`floor-${k}`}>
      <Rect x={x} y={y} width={cellSize} height={cellSize} color={floor} />
      {eastOpen && <Rect x={x + cellSize - SEAM_WIDTH / 2} y={y} width={SEAM_WIDTH} height={cellSize} color={seam} />}
      {southOpen && <Rect x={x} y={y + cellSize - SEAM_WIDTH / 2} width={cellSize} height={SEAM_WIDTH} color={seam} />}
    </Group>
  );
}

/** A seam has to stay visible against whatever it is ruled on, so it steps
 * *away* from the floor rather than always darkening it: the reference's
 * seams are faintly lighter than its near-black floor and faintly darker
 * than its bright paint. Darkening in both cases would make the seam
 * disappear entirely on the dark floor. */
function seamFor(floor: string, painted: boolean): string {
  return painted ? shade(floor, 0.86) : shade(floor, 1.5);
}

/** The whole floor in its unpainted state. Depends only on the maze's own
 * shape, so it is `React.memo`'d on `cells` and rendered exactly once per
 * maze - never again, no matter how much gets painted on top of it. */
const MazeFloorBase = React.memo(function MazeFloorBaseImpl({
  cells,
  cellSize,
}: {
  cells: ReadonlyArray<CellInfo>;
  cellSize: number;
}): React.JSX.Element {
  const seam = seamFor(FLOOR_UNPAINTED, false);
  return <>{cells.map(cell => floorTile(cell, cellSize, FLOOR_UNPAINTED, seam))}</>;
});

/** Just the tiles that have actually been painted, drawn over the base.
 *
 * Split from the base deliberately. A fast roll crosses ~30 tiles a
 * second, and every one of those is a paint event that invalidates this
 * layer's memo - so what matters is how much work one invalidation costs.
 * Redrawing all ~44 tiles each time (the previous single-layer version)
 * meant re-running the whole floor 30 times a second during exactly the
 * moments the screen most needs to stay smooth; redrawing only the painted
 * ones costs a handful of tiles early in a maze and never more than the
 * whole floor at the very end, by which point the ball has stopped. */
const MazePaintedFloor = React.memo(function MazePaintedFloorImpl({
  cells,
  cellSize,
  paintedRef,
  paintedVariant,
}: {
  cells: ReadonlyArray<CellInfo>;
  cellSize: number;
  paintedRef: React.RefObject<Set<string>>;
  paintedVariant: [string, string, string];
  // Only read to force this memo to invalidate on an actual paint event -
  // the component itself reads live membership from `paintedRef.current`.
  paintedVersion: number;
}): React.JSX.Element {
  const floor = paintedVariant[1];
  const seam = seamFor(floor, true);
  return (
    <>
      {cells
        .filter(cell => paintedRef.current?.has(cell.key) ?? false)
        .map(cell => floorTile(cell, cellSize, floor, seam))}
    </>
  );
});

/** The still-fading edge of a paint transition - an unpainted-tone copy of
 * just the tiles inside their own `PAINT_FADE_MS` window (typically 0-2 of
 * them at any instant, never all of them), fading *out* to reveal the
 * already-painted tile underneath. Same visual crossfade as interpolating
 * every tile's colour, at a fraction of the cost: this is the one part of
 * the floor that genuinely needs a fresh render each tick, so it is kept
 * as small as the passage of time allows. No seams of its own - the
 * settled layer beneath is already showing the correct ones. */
function MazeFadeOverlay({
  cells,
  cellSize,
  paintedAtRef,
  now,
}: {
  cells: ReadonlyArray<CellInfo>;
  cellSize: number;
  paintedAtRef: React.RefObject<Map<string, number>>;
  now: number;
}): React.JSX.Element {
  return (
    <>
      {cells.map(({ key: k, col, row }) => {
        const paintedAt = paintedAtRef.current?.get(k);
        if (paintedAt === undefined) return null;
        const elapsed = now - paintedAt;
        if (elapsed <= 0 || elapsed >= PAINT_FADE_MS) return null;
        const easeOut = 1 - (1 - elapsed / PAINT_FADE_MS) ** 3;

        return (
          <Rect
            key={`fade-${k}`}
            x={col * cellSize}
            y={row * cellSize}
            width={cellSize}
            height={cellSize}
            color={FLOOR_UNPAINTED}
            opacity={1 - easeOut}
          />
        );
      })}
    </>
  );
}

/** Minimum finger travel (in dp) before a drag counts as a swipe - kept
 * comfortably above typical tap/tremor jitter, same threshold the shared
 * `useSwipeGesture` uses. */
const SWIPE_THRESHOLD = 32;
/** Minimum travel before the responder even engages, so a plain tap never
 * gets intercepted as a gesture in the first place. */
const CAPTURE_THRESHOLD = 10;

/**
 * A swipe gesture that fires the *instant* a drag crosses its own
 * threshold, mid-drag - not the shared `src/components/useSwipeGesture.ts`
 * (which only reports a direction on release, correct for Gravity's own
 * board where a swipe is one discrete, deliberate action). Continuous
 * rolling needs the opposite: the ball has to start moving the moment the
 * player commits to a direction, not after they've finished dragging and
 * lifted their finger - waiting for release added a real, full-gesture's
 * worth of input latency in front of every single move, which is exactly
 * what repeated "feels laggy" reports were describing. Reported at most
 * once per physical touch (`firedRef`), so a finger that keeps moving
 * further past the threshold doesn't retrigger.
 */
function useImmediateSwipeGesture(onSwipe: (direction: Direction) => void): GestureResponderHandlers {
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;
  const firedRef = useRef(false);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > CAPTURE_THRESHOLD || Math.abs(gesture.dy) > CAPTURE_THRESHOLD,
        onPanResponderGrant: () => {
          firedRef.current = false;
        },
        onPanResponderMove: (_event, gesture) => {
          if (firedRef.current) return;
          const { dx, dy } = gesture;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
          firedRef.current = true;
          if (Math.abs(dx) > Math.abs(dy)) onSwipeRef.current(dx > 0 ? 'right' : 'left');
          else onSwipeRef.current(dy > 0 ? 'down' : 'up');
        },
        // If the OS interrupts the gesture (e.g. an incoming call), simply
        // drop it - there is no partial state to unwind.
        onPanResponderTerminate: () => {},
      }),
    [],
  );

  return responder.panHandlers;
}

export function CalmingInterstitialScreen({ onDone }: CalmingInterstitialScreenProps): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  // Fit the bounding grid into whatever box is left over once the title
  // above and the side margins are accounted for - width- or height-
  // constrained, whichever is tighter. `NON_MAZE_HEIGHT` is an empirical
  // budget for the title and margins stacked above/below it.
  //
  // The side margin is generous on purpose. An earlier pass let the board
  // claim nearly the whole width on the theory that it should dominate,
  // but the reference floats a noticeably smaller board in real white
  // space, and bleeding to the screen edge is most of what made this
  // screen feel cramped rather than composed.
  const NON_MAZE_HEIGHT = 220;
  const SIDE_MARGIN = 28;
  // A wall face stands in the space above its tile, so the top row's face
  // sits at a negative y in grid coordinates. The arena reserves one
  // face's worth of headroom and the board is shifted down into it,
  // otherwise the topmost wall gets clipped off by the canvas edge.
  const cellSize = Math.min(
    (width - SIDE_MARGIN * 2) / BOUNDING_COLS,
    (height - NON_MAZE_HEIGHT) / (BOUNDING_ROWS + TOP_FACE_RATIO),
  );
  const topFacePx = Math.round(cellSize * TOP_FACE_RATIO);
  const arenaWidth = cellSize * BOUNDING_COLS;
  const arenaHeight = cellSize * BOUNDING_ROWS + topFacePx;

  const levelRef = useRef(0);
  const mazeRef = useRef<MazeShape>(useMemo(() => generateMaze(0), []));
  const mazesCompletedRef = useRef(0);
  const cellSizeRef = useRef(0);
  cellSizeRef.current = cellSize;

  const paintedRef = useRef<Set<string>>(new Set([cellKey(mazeRef.current.start.col, mazeRef.current.start.row)]));
  // When each cell *became* painted - lets the fill colour cross-fade from
  // the wall tone to the accent over `PAINT_FADE_MS` instead of snapping
  // instantly, the "state changes that teleport" gap the animation skill's
  // own audit flags as a missed opportunity. The start cell is seeded
  // already-elapsed (`-PAINT_FADE_MS`) so the very first tile is simply
  // painted from frame one, no fade-in for a cell the player never
  // actually watched get crossed.
  const paintedAtRef = useRef<Map<string, number>>(
    new Map([[cellKey(mazeRef.current.start.col, mazeRef.current.start.row), -PAINT_FADE_MS]]),
  );
  const ballRef = useRef<BallVisual>({
    ...cellCenter(mazeRef.current.start, cellSizeRef.current),
    rollAngle: 0,
  });
  const movingRef = useRef<MovingState | null>(null);
  const squashRef = useRef<SquashPulse | null>(null);
  const celebratingRef = useRef(false);
  const lastFrameRef = useRef(Date.now());
  const mazeStartedAtRef = useRef(Date.now());

  const [, setTick] = useState(0);
  const forceRender = (): void => setTick(n => n + 1);
  const startRef = useRef(Date.now());
  const doneRef = useRef(false);
  // Bumped only when a *new* cell is actually marked painted (a handful of
  // times per maze), not every frame - the prop `MazeSettledFillLayer`
  // keys its own `React.memo` on, so that layer (every cell's long-term
  // settled colour, bevel, dividers and top/bottom edge lines) only
  // re-renders on an actual paint event instead of 60 times a second. The
  // still-fading edge of that transition is drawn separately, per frame,
  // by a much smaller overlay below.
  const [paintedVersion, setPaintedVersion] = useState(0);

  const finish = (): void => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  /** Starts a fresh maze: resets the painted set, ball position and
   * celebration flag. Called for the very first maze (implicitly, via the
   * refs' own initializers above) and again every time one is completed. */
  const startMaze = (level: number): void => {
    levelRef.current = level;
    const maze = generateMaze(level);
    mazeRef.current = maze;
    paintedRef.current = new Set([cellKey(maze.start.col, maze.start.row)]);
    paintedAtRef.current = new Map([[cellKey(maze.start.col, maze.start.row), -PAINT_FADE_MS]]);
    const center = cellCenter(maze.start, cellSizeRef.current);
    ballRef.current = { x: center.x, y: center.y, rollAngle: 0 };
    movingRef.current = null;
    squashRef.current = null;
    celebratingRef.current = false;
    mazeStartedAtRef.current = Date.now();
    setPaintedVersion(v => v + 1);
  };

  /** Starts the ball rolling continuously in one cardinal direction from a
   * completed swipe - the only input this screen has, now that the gauge
   * and directional pad are gone. The roll is a "flick": it auto-clears
   * itself the instant it meets a wall, since there's no finger held down
   * to keep it pressed there. A direction that's blocked immediately (no
   * open passage at all from the ball's current cell) still gets a felt
   * response - the squash pulse and a soft haptic - rather than doing
   * nothing at all. A new swipe overrides whatever direction is currently
   * driving, so the player can redirect mid-roll without waiting for a
   * wall. Reads/writes only refs, so it's safe to call from the swipe
   * gesture regardless of which render it was captured from. */
  const tryStartMove = (dc: number, dr: number): void => {
    if (celebratingRef.current) return;

    const maze = mazeRef.current;
    const cellPx = cellSizeRef.current;
    const cell = cellAt(ballRef.current, cellPx);
    if (!hasOpenEdge(maze, cell, dc, dr)) {
      squashRef.current = { axis: dc !== 0 ? 'x' : 'y', at: Date.now(), dc, dr };
      triggerFeedback('mazeContact');
      return;
    }

    // The corridor is exactly one cell wide, so the axis *perpendicular*
    // to travel has no meaningful "sub-cell" position - snap it to this
    // cell's own centre the moment a new direction starts, the same way a
    // real ball settles into a groove before rolling further along it.
    const center = cellCenter(cell, cellPx);
    if (dc !== 0) ballRef.current.y = center.y;
    else ballRef.current.x = center.x;

    movingRef.current = { dc, dr, blocked: false };
  };

  useEffect(() => {
    let frame: number;

    const tick = (): void => {
      const now = Date.now();
      // Capped well below "one full cell per frame" at the current roll
      // speed (`ROLL_CELLS_PER_SEC * dtCap` has to stay under 1) - a
      // frame-time spike (a real stall, not just an ordinary slow frame)
      // would otherwise let the ball's proposed position jump clean over
      // a one-cell-wide wall before this same tick's own collision check
      // ever runs, tunnelling through it undetected instead of stopping.
      const dt = Math.min((now - lastFrameRef.current) / 1000, 0.018);
      lastFrameRef.current = now;
      const moving = movingRef.current;
      const cellPx = cellSizeRef.current;
      const maze = mazeRef.current;

      if (moving && !celebratingRef.current) {
        const ball = ballRef.current;
        const axisKey: 'x' | 'y' = moving.dc !== 0 ? 'x' : 'y';
        const dir = moving.dc !== 0 ? moving.dc : moving.dr;
        const speed = cellPx * ROLL_CELLS_PER_SEC;
        const cell = cellAt(ball, cellPx);
        const cellIndex = axisKey === 'x' ? cell.col : cell.row;
        const rawBoundary = (dir > 0 ? cellIndex + 1 : cellIndex) * cellPx;
        const wallAhead = !hasOpenEdge(maze, cell, moving.dc, moving.dr);
        // When a wall is ahead, the ball has to stop with its own *edge*
        // touching it, not its centre - stopping the centre exactly on the
        // cell line (the old behaviour) left a full radius of the ball
        // visually poking into the wall cell, reading as "stuck halfway
        // through the wall". Pulling the stop line back into the current
        // cell by one radius fixes that *and*, as a side effect, keeps the
        // stop position safely inside the valid cell's own bounds - no
        // longer landing exactly on the grid line where `cellAt`'s
        // `Math.floor` would misread it as the far (invalid) cell and
        // report every direction blocked forever. An *open* passage needs
        // no pullback: the ball's centre can travel straight through into
        // the walkable neighbour.
        const ballRadiusPx = ballRadiusFor(cellPx);
        const stopLine = wallAhead ? rawBoundary - dir * ballRadiusPx : rawBoundary;
        const current = axisKey === 'x' ? ball.x : ball.y;
        const proposed = current + dir * speed * dt;
        const crossesBoundary = dir > 0 ? proposed >= stopLine : proposed <= stopLine;
        const blockedNow = crossesBoundary && wallAhead;

        if (blockedNow) {
          if (axisKey === 'x') ball.x = stopLine;
          else ball.y = stopLine;
        } else {
          if (axisKey === 'x') ball.x = proposed;
          else ball.y = proposed;
          ball.rollAngle += (Math.abs(dir) * speed * dt) / (cellPx * BALL_RADIUS_RATIO);
        }

        if (blockedNow && !moving.blocked) {
          squashRef.current = { axis: axisKey, at: now, dc: moving.dc, dr: moving.dr };
          triggerFeedback('mazeContact');
          movingRef.current = null;
        }
        if (movingRef.current) movingRef.current.blocked = blockedNow;

        const currentCell = cellAt(ball, cellPx);
        const currentKey = cellKey(currentCell.col, currentCell.row);
        if (!paintedRef.current.has(currentKey)) {
          paintedAtRef.current.set(currentKey, now);
          paintedRef.current.add(currentKey);
          setPaintedVersion(v => v + 1);
        }

        if (paintedRef.current.size >= maze.active.size) {
          movingRef.current = null;
          celebratingRef.current = true;
          triggerFeedback('mazeSolve');
          mazesCompletedRef.current += 1;
          if (mazesCompletedRef.current >= MAZE_TARGET_COUNT) {
            setTimeout(() => finish(), CELEBRATE_PAUSE_MS);
          } else {
            setTimeout(() => startMaze(levelRef.current + 1), CELEBRATE_PAUSE_MS);
          }
        }
      }

      forceRender();

      if (now - startRef.current >= SAFETY_DURATION_MS) {
        finish();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `useImmediateSwipeGesture` (this file's own, not the shared
  // `useSwipeGesture`) only engages once real movement crosses its own
  // threshold, so a tap always passes through to whatever's underneath -
  // the exact "don't steal taps from touchables sharing this screen"
  // gotcha this project already solved once for Gravity's own board (an
  // unconditional `onStartShouldSetPanResponder: () => true` on the outer
  // container had swallowed presses meant for the Skip button). A
  // completed swipe starts a "flick" that auto-clears itself on wall
  // contact, since there's no finger left down once the gesture ends.
  const handleSwipe = (direction: Direction): void => {
    if (direction === 'up') tryStartMove(0, -1);
    else if (direction === 'down') tryStartMove(0, 1);
    else if (direction === 'left') tryStartMove(-1, 0);
    else tryStartMove(1, 0);
  };
  const swipeHandlers = useImmediateSwipeGesture(handleSwipe);

  const now = Date.now();
  const ball = ballRef.current;
  const maze = mazeRef.current;
  const paintedVariant = PAINTED_VARIANTS[levelRef.current % PAINTED_VARIANTS.length];

  // Precomputed once per maze (this reference stays stable across every
  // frame within one maze, only changing when `startMaze` swaps in a new
  // one) - both so the per-frame fill pass below doesn't re-derive
  // col/row/open-edges from scratch 60 times a second, and so
  // `MazeWallFaces` (which takes this same array as a prop) can
  // `React.memo` its way out of re-rendering every frame too.
  const activeCells = useMemo<CellInfo[]>(
    () =>
      Array.from(maze.active).map(k => {
        const [col, row] = k.split(':').map(Number);
        return {
          key: k,
          col,
          row,
          northOpen: hasOpenEdge(maze, { col, row }, 0, -1),
          southOpen: hasOpenEdge(maze, { col, row }, 0, 1),
          eastOpen: hasOpenEdge(maze, { col, row }, 1, 0),
        };
      }),
    [maze],
  );

  const squashAge = squashRef.current ? now - squashRef.current.at : Infinity;
  const squashActive = squashRef.current !== null && squashAge < SQUASH_MS;
  let squashX = 1;
  let squashY = 1;
  if (squashActive && squashRef.current) {
    const pulse = Math.sin((squashAge / SQUASH_MS) * Math.PI) * SQUASH_MAGNITUDE;
    if (squashRef.current.axis === 'x') {
      squashX = 1 - pulse;
      squashY = 1 + pulse;
    } else {
      squashX = 1 + pulse;
      squashY = 1 - pulse;
    }
  }

  // The whole board jolts a few pixels in the direction the ball was
  // travelling when it hit, then settles - the cue that sells a heavy
  // thing loose inside the device rather than a sprite sliding on glass.
  // It rides the squash pulse's own clock and envelope, so the board's
  // recoil and the ball's deformation are visibly the same event. Damped
  // rather than merely scaled under reduced motion, since this is an
  // impact, and an impact that doesn't move at all reads as a dropped
  // frame.
  let jolt = 0;
  if (squashActive) {
    jolt = Math.sin((squashAge / SQUASH_MS) * Math.PI) * IMPACT_JOLT_PX * (reducedMotion ? 0.35 : 1);
  }
  const joltX = squashRef.current ? squashRef.current.dc * jolt : 0;
  const joltY = squashRef.current ? squashRef.current.dr * jolt : 0;

  const ballRadius = cellSize * BALL_RADIUS_RATIO;

  // A slow, gentle "breathing" pulse while the ball just sits there - the
  // one cue that reads as "alive" rather than "paused", not a strong
  // effect (this app's own reduced-motion convention is "gentler, not
  // zero" - the pulse still runs under reduced motion, just at a fraction
  // of the amplitude, rather than freezing solid). Only while not being
  // actively driven, so it never fights the real wall-contact squash.
  const idleBreathe = movingRef.current ? 1 : 1 + Math.sin(now / 480) * (reducedMotion ? 0.008 : 0.03);
  const idleSway = movingRef.current ? 0 : Math.sin(now / 620) * (reducedMotion ? 0.03 : 0.12);

  // A fresh maze scales gently up from ~0.93 with a matching fade-in
  // rather than snapping straight to full size - the "scale(0.9-0.97) +
  // opacity, never scale(0)" entrance convention this app's own animation
  // guidelines call for. Skipped (both values pinned to 1) under reduced
  // motion rather than merely shortened, since a fresh maze appearing is a
  // one-off per break, not a frequent action worth softening instead.
  const introT = reducedMotion ? 1 : Math.min((now - mazeStartedAtRef.current) / 300, 1);
  const introEase = 1 - (1 - introT) ** 3;
  const introScale = reducedMotion ? 1 : 0.93 + 0.07 * introEase;
  const introOpacity = reducedMotion ? 1 : 0.35 + 0.65 * introEase;

  return (
    <View style={styles.container}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Skip"
        onPress={finish}
        containerStyle={styles.skipPosition}
        style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
      >
        <Text style={styles.skipText}>Skip</Text>
      </PressableScale>

      <Text style={styles.mazeLabel}>LEVEL {levelRef.current + 1}</Text>

      <View style={{ width: arenaWidth, height: arenaHeight }} {...swipeHandlers}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Group
            opacity={introOpacity}
            transform={[
              { translateX: arenaWidth / 2 + joltX },
              { translateY: arenaHeight / 2 + joltY },
              { scale: introScale },
              { translateX: -arenaWidth / 2 },
              { translateY: -arenaHeight / 2 },
              // Applied to the geometry first (Skia walks this array
              // outermost-first), dropping the whole board into the
              // headroom reserved for the top row's wall face.
              { translateY: topFacePx },
            ]}
          >
            {/* Back to front: the floor of the channel, the brief paint
                crossfade riding on top of it, then the channel's own
                walls. The walls go last so they always occlude the floor
                (and the fading tile) rather than the other way round - the
                whole illusion is that they stand above it. See each
                component's own doc comment for what it draws and why it's
                split out the way it is. */}
            <MazeFloorBase cells={activeCells} cellSize={cellSize} />
            <MazePaintedFloor cells={activeCells} cellSize={cellSize} paintedRef={paintedRef} paintedVariant={paintedVariant} paintedVersion={paintedVersion} />
            <MazeFadeOverlay cells={activeCells} cellSize={cellSize} paintedAtRef={paintedAtRef} now={now} />
            <MazeWallFaces cells={activeCells} cellSize={cellSize} />

            {/* The ball: a plain, properly round sphere - premium glossy
                marble, not an irregular blob. A soft blurred contact
                shadow, a real sphere-like radial gradient body (light
                catching one corner, falling off toward the rim), a
                fixed bright specular highlight plus a softer secondary
                sheen, and a small rotating fleck (tied to `rollAngle`)
                that reads as a real no-slip roll rather than a flat disc
                sliding. `idleBreathe` is a gentle uniform "still alive"
                pulse while the ball just sits there - uniform on both
                axes, so it stays round, not the old permanent squash
                ellipse. `squashX`/`squashY` is the only thing that ever
                turns it briefly oval, on an actual wall arrival, springing
                straight back round after. */}
            {/* A layered fake-soft shadow (two flat, slightly offset
                circles at decreasing opacity) instead of a real
                `BlurMask` - the maze's own shadow can afford a genuine
                GPU blur pass because `MazeStaticLayers` only repaints it
                on an actual new maze, but the ball moves (and this shadow
                is redrawn) on literally every frame it's rolling; a real
                blur filter running 60 times a second for one continuously-
                moving shape is real, avoidable GPU cost, not a style
                choice - two flat circles read as "soft" without it. */}
            <Circle cx={ball.x + 3} cy={ball.y + 5} r={ballRadius * 1.08 * idleBreathe} color="rgba(0,0,0,0.12)" />
            <Circle cx={ball.x + 2} cy={ball.y + 3} r={ballRadius * idleBreathe} color="rgba(0,0,0,0.22)" />
            {/* The splash burst is an *impact* effect, not the ball's own
                resting shape - it only exists for `SQUASH_MS` right after
                a wall contact (reusing the same squash pulse's own
                timing/state rather than a second animation clock), and
                bursts outward with a fading, ease-out cubic progress
                (`1 - (1-t)**3` - the same "starts fast, settles" curve
                this app's other entrances use) rather than sitting there
                unchanging. */}
            {squashActive && (
              <Group transform={[{ translateX: ball.x }, { translateY: ball.y }]}>
                {SPIKE_NUBS.map((nub, i) => {
                  const t = squashAge / SQUASH_MS;
                  const easeOut = 1 - (1 - t) ** 3;
                  const burstDist = nub.dist * (1 + easeOut * 0.9);
                  return (
                    <Group
                      key={i}
                      transform={[
                        { translateX: Math.cos(nub.angle) * ballRadius * burstDist },
                        { translateY: Math.sin(nub.angle) * ballRadius * burstDist },
                        { rotate: nub.angle },
                        { scaleX: nub.length * (1 - easeOut * 0.3) },
                        { scaleY: nub.width * (1 - easeOut * 0.3) },
                      ]}
                    >
                      <Circle cx={0} cy={0} r={ballRadius} color={paintedVariant[2]} opacity={1 - easeOut} />
                    </Group>
                  );
                })}
              </Group>
            )}
            <Group
              transform={[
                { translateX: ball.x },
                { translateY: ball.y },
                { scaleX: squashX * idleBreathe },
                { scaleY: squashY * idleBreathe },
              ]}
            >
              {/* Polished pewter, not a tinted marble - measured off the
                  reference's own ball (#B8C4D2 body falling to #6C757F at
                  the rim). Fixed rather than following the current paint
                  colour: it has to stay legible on the near-black floor
                  *and* on every colour the paint cycles through, and a ball
                  the same hue as the trail it leaves behind stops reading
                  as a separate object. */}
              <Circle cx={0} cy={0} r={ballRadius}>
                <RadialGradient
                  c={vec(-ballRadius * 0.38, -ballRadius * 0.45)}
                  r={ballRadius * 1.7}
                  colors={[BALL_LIGHT, BALL_BODY, BALL_RIM]}
                  positions={[0, 0.45, 1]}
                />
              </Circle>
              <Circle cx={ballRadius * 0.42} cy={ballRadius * 0.4} r={ballRadius * 0.4} color="rgba(255,255,255,0.08)" />
              <Circle cx={-ballRadius * 0.3} cy={-ballRadius * 0.35} r={ballRadius * 0.26} color="rgba(255,255,255,0.75)" />
              {/* A small rotating fleck, tied to the ball's own no-slip
                  `rollAngle` (plus the same gentle idle sway as before) -
                  the cue that sells a real rolling sphere rather than a
                  flat disc translating in place. */}
              <Circle
                cx={Math.cos(ball.rollAngle * 0.6 + idleSway) * ballRadius * 0.5}
                cy={Math.sin(ball.rollAngle * 0.6 + idleSway) * ballRadius * 0.5}
                r={ballRadius * 0.1}
                color="rgba(90,100,115,0.45)"
              />
            </Group>
          </Group>
        </Canvas>
      </View>

      {celebratingRef.current && <ConfettiBurst />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SCREEN_BG,
    alignItems: 'center',
    paddingTop: 96,
  },
  skipPosition: {
    position: 'absolute',
    top: 56,
    right: theme.spacing.lg,
    zIndex: 5,
  },
  skip: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  skipPressed: {
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  skipText: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: TITLE_COLOR,
  },
  mazeLabel: {
    fontSize: theme.typography.sizes.title + 6,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
    color: TITLE_COLOR,
    marginBottom: theme.spacing.xl,
  },
});
