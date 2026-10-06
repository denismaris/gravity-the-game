import React, { useEffect, useMemo, useRef } from 'react';
import { Circle, DashPathEffect, Group, LinearGradient, Path, RadialGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  BinairoCell,
  BinairoConstraint,
  BinairoPuzzle,
  BinairoState,
  BinairoValue,
  constraintKey,
  constraintPartner,
  isGiven,
  tripleRunGroups,
  twinKey,
  twinPartner,
  unbalancedLines,
  violatedConstraints,
  violatedTwins,
} from '../game/binairo';
import {
  BoardLayout,
  computeBoardLayout,
  getCellOrigin,
  INTRO_STAGGER_MS,
  INTRO_TILE_MS,
  INTRO_TOTAL_MS,
  IDLE_MOTION_FPS,
  useAnimationClock,
  useIntroWave,
  useReducedMotion,
} from '../game/rendering';
import { theme, inkWash } from '../theme';

/** A placed mark doesn't turn or fade in - it stamps: it lands a touch
 * oversized and settles to its resting size in one quick, decelerating
 * motion, the way a rubber stamp's ink looks a beat "heavier" the
 * instant it strikes the page before your eye settles on the mark
 * itself. `STAMP_IN_MS` is that settle's own duration; `TOGGLE_MS` is
 * the outer window the rest of this file uses to know how long a cell
 * stays in its "currently transitioning" set (see `useToggleEvents`'s
 * callers below) - equal to the longer of the incoming stamp and the
 * outgoing lift, since both can be running at once (see `STAMP_OUT_MS`). */
const STAMP_IN_MS = 150;
const TOGGLE_MS = STAMP_IN_MS;
/** How long an outgoing mark takes to lift off the tile and vanish - a
 * plain quick shrink-and-fade, not a mirror of the incoming stamp.
 * Deliberately shorter than `STAMP_IN_MS` and run *concurrently* with it
 * (not sequenced, like a page turning) - the old mark is old news the
 * instant a new one starts landing, and overlapping the two is what
 * keeps a fast run of taps feeling continuous instead of stuttery. */
const STAMP_OUT_MS = 90;
/** How much larger than its resting size an incoming mark starts - the
 * "struck a touch too hard" overshoot the settle then eases out of. */
const STAMP_OVERSHOOT_SCALE = 1.3;
/** The empty ring's own fade - clearing out (or landing back) well
 * before the incoming/outgoing mark is done animating, over a window
 * this much shorter than `STAMP_IN_MS`, so it never sits half-visible
 * underneath an already-legible mark. */
const RING_FADE_MS = 70;

/** The three rule violations share one hazard-tape look, at the extent
 * of what is actually wrong: a triple run tapes just the cells of the run
 * (the three, or four, that match - the player sees exactly which tiles
 * to change), while an unequal count or a duplicated line - wrong as a
 * whole line, with no single culprit - tapes the entire row or column.
 * The onset delay (`ERROR_DELAY_MS`) keeps a run passed through
 * mid-cycle from flaring up under the player's finger. */
const ERROR_ENTER_MS = 140;
const ERROR_SCALE_MS = 220;
const ERROR_EXIT_MS = 160;
/** A violation has to hold steady for this long before it's allowed to
 * start entering (see `useDelayedKeys` below) - it used to flag the
 * instant a line went bad, which read as too quick/twitchy while still
 * mid-move. Clearing is never delayed: fixing a line drops its tape/badge
 * immediately, only the *onset* waits. */
const ERROR_DELAY_MS = 450;
const ERROR_BORDER_OPACITY = 0.9;
/** The soft wash behind the offending tiles, and how slowly the outline breathes. */
const ERROR_FILL_OPACITY = 0.2;
const ERROR_BREATHE_MS = 1800;

/** Every tile is its own small raised surface inset from the raw cell
 * bounds, instead of a square on one shared flat board surface - see the
 * per-cell chrome drawn in `StaticBinairoTiles` below. Wide enough that
 * the hazard-tape zone (rendered *behind* the tiles, not over them - see
 * the error-zone block in `BinairoBoardView` itself) has a real gap to
 * show through, not just a hairline. */
const TILE_GAP = 6;
export const TILE_RADIUS = 8;

/** The solve celebration: a ring of light pops on every tile in turn,
 * radiating outward (Chebyshev distance - square "rings", not circular
 * ones, matching the grid's own geometry) from whichever cell the player
 * just placed to finish the puzzle - not a flat "everyone pops at once",
 * and not a plain row-by-row wipe either. `WAVE_TOTAL_MS` is a fixed
 * upper bound covering the worst case (a corner-to-corner ripple on a
 * 10x10 board: max distance 9 * `WAVE_STAGGER_MS` + `WAVE_TILE_MS` =
 * 360 + 220 = 580ms) with a small margin, since the animation clock needs
 * to know how long to keep running for *before* the per-cell timings
 * below are actually evaluated. `BinairoScreen`'s own popup delay is
 * tuned to this same number - see its `POPUP_DELAY_MS`. */
// Slowed after play-testing: at 40/220ms the ring was over before it
// registered. An 8x8 corner-to-corner wave is now 7 * 70 + 480 = 970ms,
// inside the shared 1.1s finish beat (`SOLVE_CELEBRATION_MS`).
const WAVE_STAGGER_MS = 70;
const WAVE_TILE_MS = 480;
const WAVE_TOTAL_MS = 1050;

/** The board's own opening flourish: every tile - given or not - starts
 * hidden under a solid cream "shutter" (the page's own `background`, not a
 * near-white that would nearly vanish against the tray beneath it) with a
 * bright accent seam glowing along its shrinking edge, then those shutters
 * shrink away in a diagonal wave from the top-left corner, the seam fading
 * as it goes, revealing the tray underneath tile by tile, like a deck
 * being dealt out rather than the whole grid just appearing at once. Runs
 * once when the board first mounts, and again on every restart (see
 * `introKey`) - a puzzle resetting reads as the same tray waking back up,
 * not a silent snap back to blank. Distance is plain Chebyshev from the
 * corner `(0,0)`, the same "square rings" metric `useSolveWave` already
 * uses, just fixed at a corner instead of wherever the winning move landed
 * - `WAVE_TOTAL_MS`'s margin math applies here too: worst case a 10x10
 * board's opposite corner is 9 tiles away, 9 * `INTRO_STAGGER_MS` +
 * `INTRO_TILE_MS` = 306 + 340 = 646ms, comfortably under `INTRO_TOTAL_MS`. */
const INTRO_SEAM_WIDTH_FACTOR = 0.05;

/** A tile's own tactile "press" feedback: an accent-coloured ring that
 * pulses outward from the centre and fades - a deliberately visible "ink"
 * ripple (the same idiom Material-style touch feedback uses), not just a
 * quiet tint - plus a softer full-tile darkening that holds for as long as
 * the finger stays down and eases out on release. Both start the instant a
 * finger lands, independent of (and usually much quicker than) whatever
 * toggle/flip that release goes on to trigger: this is purely "something
 * under my finger reacted", the flip is "the value actually changed". The
 * ripple always plays out in full (`PRESS_RIPPLE_MS`) even if the finger
 * lifts immediately - a tap that's already over by the time the ripple
 * would start is exactly the case this most needs to cover. */
const PRESS_GLOW_IN_MS = 90;
const PRESS_GLOW_OUT_MS = 150;
const PRESS_GLOW_OPACITY = 0.14;
const PRESS_RIPPLE_MS = 340;
const PRESS_RIPPLE_START_FACTOR = 0.2;
const PRESS_RIPPLE_END_FACTOR = 0.95;
const PRESS_RIPPLE_OPACITY = 0.45;

/** The two fillable states are a solid disc and a solid rounded square,
 * *and* two different colours (see `theme/colors.ts`'s own comment for
 * which, and why those two) - shape and colour agree instead of only one
 * of them carrying the distinction, since colour alone isn't colourblind-
 * safe and shape alone reads noticeably slower at a glance across a full
 * board. Only the mark itself carries colour - the tile it sits on stays
 * this app's plain paper colour regardless of value (see
 * `renderTileChrome`), so a filled cell never paints a second, unrelated
 * colour across its whole background the way an earlier version of this
 * board did. Constraint badges use their own separate ink
 * (`badgeInk()` below) rather than either of these two - a badge is
 * a different kind of mark (a rule check, not a value), and borrowing a
 * value's own colour for it would blur that difference. */
function markGradientStops(value: 1 | 0): { readonly light: string; readonly dark: string } {
  return value === 1
    ? { light: theme.colors.binairoMarkFilledLight, dark: theme.colors.binairoMarkFilledDark }
    : { light: theme.colors.binairoMarkOutlineLight, dark: theme.colors.binairoMarkOutlineDark };
}
/** The constraint badges' own ink - plain `primary`, independent of
 * `markColor` above (see that function's own comment for why). */
const badgeInk = (): string => theme.colors.primary;

/** The square mark's own proportions, relative to the circle's own radius
 * `R` - slightly larger half-width than `R`, so it reads as "the same
 * visual weight" next to the disc rather than looking small and
 * secondary beside it. */
const SQUARE_HALF_FACTOR = 1.02;
const SQUARE_CORNER_FACTOR = 0.32;

/** A mark's own soft contact shadow, offset down and slightly right - the
 * one consistent light direction the tray's own edge seam and this board's
 * outer shadow (`BinairoBoard`'s native shadow) already shade toward. Kept
 * tight: a thin mark sits close enough to its own tile that a wide,
 * diffuse shadow would read as a smudge rather than a mark resting a hair
 * above the paper. Ink-based (not the mark's own colour) since a shadow is
 * never the colour of the thing casting it. This is a genuinely different
 * relationship from the tile's own elevation (a mark resting *on* the
 * tile, not the tile itself lifting off the tray - see `renderTileChrome`'s
 * own comment for why the tile no longer casts one of these itself). */
const MARK_SHADOW_OFFSET_FACTOR = 0.05;
const MARK_SHADOW_ALPHA = 0.22;

/** A constraint badge sits centred on the shared edge between its two
 * cells - small enough to read as a marker on the seam, not a third tile
 * competing with the two it sits between. */
const CONSTRAINT_BADGE_RADIUS_FACTOR = 0.22;
const CONSTRAINT_BADGE_STROKE_WIDTH = 1.5;
const CONSTRAINT_MARK_STROKE_FACTOR = 0.3;
/** A badge pops (an `easeOutBack` overshoot, the same curve the error
 * zone's own entrance uses) the instant its violated/satisfied state
 * flips either way - becoming wrong is as worth noticing as becoming
 * right again. Once that pop settles, a badge still actively violated
 * keeps a slow, subtle breathing pulse so a mistake sitting untouched
 * for a while doesn't just go visually silent. */
const CONSTRAINT_POP_MS = 260;
const CONSTRAINT_PULSE_PERIOD_MS = 1100;
const CONSTRAINT_PULSE_AMPLITUDE = 0.045;

/** A twin badge sits *on* one cell, not between two - deliberately unlike
 * a constraint badge (which marks a relationship between neighbours), a
 * twin's own partner is usually nowhere near it on the board, so a
 * shared visual language between the two would suggest a connection
 * that isn't there. Much smaller and quieter than a constraint badge
 * (`0.09` vs. `0.22` of tile size) - it's a single quiet cue a player
 * learns once (see `MechanicsCarousel`'s own twin slide), not something
 * that needs its own presence competing with the mark it sits beside. */
const TWIN_BADGE_RADIUS_FACTOR = 0.09;
/** How far from each tile edge the badge sits - the tile's own top-right
 * corner, inset so it never overlaps the mark at the tile's centre. */
const TWIN_BADGE_INSET_FACTOR = 0.16;
/** Same pop-on-flip and pulse-while-violated timing as a constraint
 * badge (`CONSTRAINT_POP_MS`/`CONSTRAINT_PULSE_PERIOD_MS`/
 * `CONSTRAINT_PULSE_AMPLITUDE`), reused rather than re-tuned - one
 * consistent "a badge just became wrong" rhythm for every badge kind on
 * this board, not a second one to learn. */

// Worklets, so the per-tap animations below can run them on the UI
// thread; they work the same when called from ordinary JavaScript.
function clamp01(t: number): number {
  'worklet';
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
function easeOutCubic(t: number): number {
  'worklet';
  return 1 - (1 - t) ** 3;
}
function easeInCubic(t: number): number {
  'worklet';
  return t ** 3;
}
/** A small, standard overshoot curve (not a real spring - this file
 * animates purely off `Date.now()` diffs, no Reanimated): settles exactly
 * at 1 when t=1, but visibly overshoots just before, giving an error
 * zone's entrance a "snapped into place" energy instead of a plain fade. */
function easeOutBack(t: number): number {
  const c1 = 1.4;
  const c3 = c1 + 1;
  const x = t - 1;
  return 1 + c3 * x ** 3 + c1 * x ** 2;
}
/** A disc, stamped with a quiet top-left-to-bottom-right satin gradient
 * plus its own soft contact shadow - real dimension, not a flat single
 * fill (which read as bland/"boring" against this board's own textured
 * paper tray), but still short of a glossy game-token bevel: one gentle
 * gradient and a shadow, no rim stroke, no specular highlight. */
export function renderCircleMark(key: string, cx: number, cy: number, r: number, value: 1 | 0): React.JSX.Element {
  const dx = r * MARK_SHADOW_OFFSET_FACTOR;
  const { light, dark } = markGradientStops(value);
  return (
    <Group key={key}>
      <Circle cx={cx + dx} cy={cy + dx} r={r} color={inkWash(MARK_SHADOW_ALPHA)} />
      <Circle cx={cx} cy={cy} r={r}>
        <LinearGradient start={vec(cx - r * 0.5, cy - r)} end={vec(cx + r * 0.5, cy + r)} colors={[light, dark]} />
      </Circle>
    </Group>
  );
}

/** The circle's counterpart: the same gradient-fill-plus-shadow treatment
 * applied to a rounded square - a genuinely different silhouette, so the
 * two fillable states are still told apart by shape even in grayscale. */
export function renderSquareMark(key: string, cx: number, cy: number, R: number, value: 1 | 0): React.JSX.Element {
  const half = R * SQUARE_HALF_FACTOR;
  const x = cx - half;
  const y = cy - half;
  const side = half * 2;
  const cr = half * SQUARE_CORNER_FACTOR;
  const dx = half * MARK_SHADOW_OFFSET_FACTOR;
  const { light, dark } = markGradientStops(value);
  return (
    <Group key={key}>
      <RoundedRect x={x + dx} y={y + dx} width={side} height={side} r={cr} color={inkWash(MARK_SHADOW_ALPHA)} />
      <RoundedRect x={x} y={y} width={side} height={side} r={cr}>
        <LinearGradient start={vec(x, y)} end={vec(x + side, y + side)} colors={[light, dark]} />
      </RoundedRect>
    </Group>
  );
}

function renderSymbol(key: string, value: 1 | 0, cx: number, cy: number, R: number): React.JSX.Element {
  return value === 1 ? renderCircleMark(key, cx, cy, R, value) : renderSquareMark(key, cx, cy, R, value);
}

/** The resting state's own icon: a faint dashed ring, distinct in kind
 * (not just colour) from both fillable symbols. */
export function renderEmptyRing(key: string, cx: number, cy: number, R: number): React.JSX.Element {
  return (
    <Group key={key}>
      {/* A genuinely recessed socket, not just a faint flat disc - shading
          runs the *opposite* way a raised token's own gradient does (dark
          toward the upper-left, where the board's own light can't reach
          the near wall of a hollow, lighter toward the lower-right, where
          it can), so this reads as a small dent waiting for a piece
          rather than a sticker floating on the tile. Deliberately subtle:
          this cell is about to be the least visually interesting thing on
          the board once filled, so it only needs a hint of depth. */}
      <Circle cx={cx} cy={cy} r={R * 0.86}>
        <RadialGradient c={vec(cx + R * 0.3, cy + R * 0.3)} r={R * 1.1} colors={[inkWash(0.03), inkWash(0.1)]} />
      </Circle>
      <Circle cx={cx} cy={cy} r={R * 0.86} color={inkWash(0.16)} style="stroke" strokeWidth={1} />
      {/* Thinner and a touch more transparent than the mark strokes it sits
          among - a whole board is mostly empty cells before it's mostly
          filled, so this needs to recede as a quiet placeholder rather
          than compete with the bold, flat marks that eventually replace
          it one by one. */}
      <Circle cx={cx} cy={cy} r={R} color={theme.colors.textTertiary} style="stroke" strokeWidth={1.25} opacity={0.75}>
        <DashPathEffect intervals={[R * 0.28, R * 0.22]} />
      </Circle>
    </Group>
  );
}

/**
 * A `=`/`x` constraint marker: a small circle sitting on the shared edge
 * between two adjacent cells, with `same` drawn as two short parallel
 * bars (an equals sign, regardless of whether the edge itself runs
 * horizontally or vertically - a typographic `=`, not a rotated one) and
 * `different` as a cross - the same cut-out-X idiom `DestroyedPieceMark`
 * already uses elsewhere in this app. `violated` swaps the whole badge
 * into the same `danger` red the hazard-tape zones use, rather than
 * inventing a second "this is wrong" colour language just for
 * constraints.
 */
export function renderConstraintBadge(key: string, cx: number, cy: number, radius: number, kind: BinairoConstraint['kind'], violated: boolean): React.JSX.Element {
  const fill = violated ? theme.colors.danger : theme.colors.surfaceHi;
  const ring = violated ? theme.colors.danger : theme.colors.borderStrong;
  const mark = violated ? theme.colors.surfaceHi : badgeInk();
  const strokeWidth = Math.max(1.25, radius * CONSTRAINT_MARK_STROKE_FACTOR);
  const d = radius * 0.5;
  const markPath =
    kind === 'same'
      ? `M ${cx - d} ${cy - d * 0.55} L ${cx + d} ${cy - d * 0.55} M ${cx - d} ${cy + d * 0.55} L ${cx + d} ${cy + d * 0.55}`
      : `M ${cx - d} ${cy - d} L ${cx + d} ${cy + d} M ${cx + d} ${cy - d} L ${cx - d} ${cy + d}`;
  return (
    <Group key={key}>
      <Circle cx={cx} cy={cy} r={radius} color={fill} />
      <Circle cx={cx} cy={cy} r={radius} color={ring} style="stroke" strokeWidth={CONSTRAINT_BADGE_STROKE_WIDTH} />
      <Path path={markPath} color={mark} style="stroke" strokeWidth={strokeWidth} strokeCap="round" />
    </Group>
  );
}

/**
 * A twin badge: a single small filled dot, nothing else - no ring, no
 * mark inside it, unlike a constraint badge. Sits in one cell's own
 * top-right corner rather than on a shared edge (see
 * `TWIN_BADGE_RADIUS_FACTOR`'s own comment for why it's deliberately
 * unlike `renderConstraintBadge`). `violated` swaps it to the same
 * `danger` red every other "this is wrong" signal on this board uses.
 */
export function renderTwinBadge(key: string, cx: number, cy: number, radius: number, violated: boolean): React.JSX.Element {
  return <Circle key={key} cx={cx} cy={cy} r={radius} color={violated ? theme.colors.danger : theme.colors.binairoAccent} />;
}

/** Distance along the diagonal between consecutive stripe centres, for a
 * given stroke thickness - equal stripe and gap, measured perpendicular. */
export function hazardStripePeriod(stripeWidth: number): number {
  return stripeWidth * 2 * Math.SQRT2;
}

/**
 * Absolute-coordinate 45-degree stripe centrelines covering a `w`x`h` box
 * anchored at `(bx, by)`, spaced so the *true perpendicular* gap between
 * consecutive `stripeWidth`-thick strokes is also `stripeWidth` (an equal
 * stripe/gap hazard-tape look) - each line is drawn far past the box on
 * both ends and left to a clip to crop, rather than computed to the exact
 * box edges, so no per-line trimming math is needed.
 *
 * Deliberately has no phase parameter. The idle scroll used to be built in
 * here, which meant rebuilding every one of these strings - around 26 per
 * errored line - on every frame, for every errored line on the board. That
 * was the single most expensive thing this board did, and it ran at 60fps
 * for as long as a mistake sat on screen. The stripes are now generated
 * once per box and scrolled by translating the group that holds them (a
 * diagonal phase shift of `d` is exactly a translation of `-d` in y), so
 * the geometry is stable and the per-frame cost is one transform.
 *
 * One extra period of lead-in is generated beyond the box so that a
 * translation of up to a full period never drags the first stripe into
 * view from nowhere.
 */
export function hazardStripePaths(bx: number, by: number, w: number, h: number, stripeWidth: number): string[] {
  const period = hazardStripePeriod(stripeWidth);
  const margin = w + h;
  const dMin = -h - stripeWidth - period;
  const dMax = w + stripeWidth;
  const paths: string[] = [];
  const t0 = -margin;
  const t1 = w + h + margin;
  for (let d = dMin; d <= dMax; d += period) {
    paths.push(`M ${bx + t0} ${by + t0 - d} L ${bx + t1} ${by + t1 - d}`);
  }
  return paths;
}

interface ToggleEvent {
  readonly from: BinairoValue;
  readonly to: BinairoValue;
  readonly startedAt: number;
}

/** Diffs `values` against the previous render to find cells that just
 * changed, recording when - the same during-render-diff idiom
 * `useGemBursts`/`useMirrorFlourish` use on Mirror Maze's board. Every
 * toggle used to also drive its own pop/crossfade animation here; that
 * read as fussy and got in the way of fast, repeated tapping, so a
 * toggled cell now just shows its new value immediately (see
 * `StaticBinairoTiles`) - this history survives purely because
 * `useSolveWave` still needs to know *which* cell was most recently
 * toggled, to pick the ripple's origin. */
function useToggleEvents(values: BinairoState['values']): Map<string, ToggleEvent> {
  const prevRef = useRef<BinairoState['values'] | null>(null);
  const eventsRef = useRef(new Map<string, ToggleEvent>());

  if (prevRef.current !== values) {
    const prev = prevRef.current;
    const now = Date.now();
    for (let r = 0; r < values.length; r += 1) {
      for (let c = 0; c < values[r].length; c += 1) {
        const from = prev ? prev[r][c] : values[r][c];
        const to = values[r][c];
        if (from !== to) eventsRef.current.set(`${r}:${c}`, { from, to, startedAt: now });
      }
    }
    prevRef.current = values;
  }
  return eventsRef.current;
}

interface SolveWave {
  readonly originRow: number;
  readonly originCol: number;
  readonly startedAt: number;
}

/** Fires exactly once, the instant `solved` flips false -> true, picking
 * the ripple's origin as whichever cell most recently toggled (the
 * player's own last move solving the puzzle) - falling back to the
 * board's centre if that's somehow unavailable. Stored in a ref, not
 * state, since nothing about this needs its own re-render: the board
 * component already re-renders every frame for the wave's duration via
 * `useAnimationClock`, so a ref read each render is enough. */
function useSolveWave(solved: boolean, toggles: Map<string, ToggleEvent>, gridSize: number): SolveWave | null {
  const waveRef = useRef<SolveWave | null>(null);
  const previousSolvedRef = useRef(solved);

  if (solved && !previousSolvedRef.current) {
    let originRow = Math.floor(gridSize / 2);
    let originCol = Math.floor(gridSize / 2);
    let latestStart = -Infinity;
    for (const [key, event] of toggles) {
      if (event.startedAt > latestStart) {
        latestStart = event.startedAt;
        const [r, c] = key.split(':').map(Number);
        originRow = r;
        originCol = c;
      }
    }
    waveRef.current = { originRow, originCol, startedAt: Date.now() };
  }
  previousSolvedRef.current = solved;

  return waveRef.current;
}

/** The intro wave's own start time - `Date.now()` at first mount, and
 * again whenever `introKey` changes (a restart). Stored in a ref rather
 * than state since, exactly like `useSolveWave`, nothing here needs its
 * own re-render - the animation clock already drives one for the whole
 * window this covers. */

interface PressGlow {
  readonly key: string;
  readonly pressedAt: number;
  readonly releasedAt: number | null;
}

/** Tracks the one cell currently (or most recently) held down, entirely
 * independent of `useToggleEvents` - a press that never completes a toggle
 * (a finger sliding off before release) still gets its own fade-out here,
 * and a press that does complete one races the flip it triggers rather
 * than being tied to it (see `PRESS_GLOW_OUT_MS`). */
/**
 * One cell's stamp, played on the UI thread. It mounts once, when the cell
 * changes, and Reanimated runs it from there - so a tap costs one React
 * render instead of a burst of them at 60fps for the length of the stamp,
 * which was the lag felt on a phone. Same curves as ever, as worklets: the
 * old mark lifts and fades while the new one strikes oversized and settles.
 */
function StampTransition({
  event,
  x,
  y,
  tileSize,
  R,
  given,
  reducedMotion,
}: {
  event: ToggleEvent;
  x: number;
  y: number;
  tileSize: number;
  R: number;
  given: boolean;
  reducedMotion: boolean;
}): React.JSX.Element {
  const cx = x + tileSize / 2;
  const cy = y + tileSize / 2;
  const centre = vec(cx, cy);
  const elapsed = useSharedValue(0);
  useEffect(() => {
    elapsed.value = withTiming(STAMP_IN_MS, { duration: STAMP_IN_MS, easing: Easing.linear });
  }, [elapsed]);
  const outOpacity = useDerivedValue(() => 1 - easeInCubic(clamp01(elapsed.value / STAMP_OUT_MS)));
  const outTransform = useDerivedValue(() => [{ scale: reducedMotion ? 1 : 1 - clamp01(elapsed.value / STAMP_OUT_MS) * 0.3 }]);
  const inOpacity = useDerivedValue(() => easeOutCubic(clamp01(elapsed.value / (STAMP_IN_MS * 0.5))));
  const inTransform = useDerivedValue(() => [
    { scale: reducedMotion ? 1 : 1 + (STAMP_OVERSHOOT_SCALE - 1) * (1 - easeOutCubic(clamp01(elapsed.value / STAMP_IN_MS))) },
  ]);
  const ringOut = useDerivedValue(() => 1 - easeOutCubic(clamp01(elapsed.value / RING_FADE_MS)));
  const ringIn = useDerivedValue(() => easeOutCubic(clamp01(elapsed.value / RING_FADE_MS)));
  return (
    <Group>
      {renderTileChrome(x, y, tileSize, given)}
      {event.from !== null && (
        <Group opacity={outOpacity} transform={outTransform} origin={centre}>
          {renderSymbol('out', event.from, cx, cy, R)}
        </Group>
      )}
      {event.from === null && <Group opacity={ringOut}>{renderEmptyRing('ring-out', cx, cy, R)}</Group>}
      {event.to === null && <Group opacity={ringIn}>{renderEmptyRing('ring-in', cx, cy, R)}</Group>}
      {event.to !== null && (
        <Group opacity={inOpacity} transform={inTransform} origin={centre}>
          {renderSymbol('in', event.to, cx, cy, R)}
        </Group>
      )}
    </Group>
  );
}

/**
 * The press feedback under a finger - a tint, and a ripple echoing out -
 * on the UI thread, like the stamp: mounted on the press, faded out on the
 * release, never re-rendering in between.
 */
function PressGlowView({
  x,
  y,
  tileSize,
  released,
  reducedMotion,
}: {
  x: number;
  y: number;
  tileSize: number;
  released: boolean;
  reducedMotion: boolean;
}): React.JSX.Element {
  const tint = useSharedValue(0);
  const ripple = useSharedValue(0);
  useEffect(() => {
    tint.value = withTiming(1, { duration: PRESS_GLOW_IN_MS, easing: Easing.out(Easing.cubic) });
    ripple.value = withTiming(1, { duration: PRESS_RIPPLE_MS, easing: Easing.linear });
  }, [tint, ripple]);
  useEffect(() => {
    if (released) tint.value = withTiming(0, { duration: PRESS_GLOW_OUT_MS, easing: Easing.in(Easing.cubic) });
  }, [released, tint]);
  const tintOpacity = useDerivedValue(() => PRESS_GLOW_OPACITY * tint.value);
  const rippleRadius = useDerivedValue(
    () => tileSize * (PRESS_RIPPLE_START_FACTOR + (PRESS_RIPPLE_END_FACTOR - PRESS_RIPPLE_START_FACTOR) * easeOutCubic(ripple.value)),
  );
  const rippleOpacity = useDerivedValue(() => (ripple.value >= 1 ? 0 : PRESS_RIPPLE_OPACITY * (1 - easeOutCubic(ripple.value))));
  return (
    <Group>
      <RoundedRect x={x} y={y} width={tileSize} height={tileSize} r={TILE_RADIUS} color="#3B1F52" opacity={tintOpacity} />
      {!reducedMotion && <Circle cx={x + tileSize / 2} cy={y + tileSize / 2} r={rippleRadius} color={theme.colors.accent} opacity={rippleOpacity} />}
    </Group>
  );
}

function usePressGlow(pressedCell: BinairoCell | null | undefined, now: number): PressGlow | null {
  const ref = useRef<PressGlow | null>(null);
  const pressedKey = pressedCell ? `${pressedCell.row}:${pressedCell.col}` : null;
  const current = ref.current;

  if (pressedKey && (!current || current.key !== pressedKey || current.releasedAt !== null)) {
    ref.current = { key: pressedKey, pressedAt: now, releasedAt: null };
  } else if (!pressedKey && current && current.releasedAt === null) {
    ref.current = { ...current, releasedAt: now };
  }

  // Kept alive until *both* the tint has fully faded (from `releasedAt`)
  // and the ripple has fully played out (from `pressedAt`, since the ripple
  // runs its own fixed duration regardless of how quickly the finger
  // lifted) - whichever finishes last.
  const entry = ref.current;
  if (entry && entry.releasedAt !== null && now - entry.releasedAt > PRESS_GLOW_OUT_MS && now - entry.pressedAt > PRESS_RIPPLE_MS) {
    ref.current = null;
  }
  return ref.current;
}

/** Delays a set of keys' *onset* by `delayMs` without delaying their
 * removal - a key only counts as "ready" once it's been continuously
 * present for the full delay, but drops out the instant it's no longer
 * present. Shared by the hazard-tape zones and the constraint badges
 * below, both fed straight into their own lifecycle hook, so a violation
 * that flares up only briefly (mid-cycle through one tile) never gets far
 * enough to actually show. */
function useDelayedKeys(keys: Iterable<string>, now: number, delayMs: number): ReadonlySet<string> {
  const seenAtRef = useRef(new Map<string, number>());
  const current = new Set(keys);
  for (const key of current) {
    if (!seenAtRef.current.has(key)) seenAtRef.current.set(key, now);
  }
  for (const key of Array.from(seenAtRef.current.keys())) {
    if (!current.has(key)) seenAtRef.current.delete(key);
  }
  const ready = new Set<string>();
  for (const key of current) {
    if (now - seenAtRef.current.get(key)! >= delayMs) ready.add(key);
  }
  return ready;
}

interface ConstraintBadgeLifecycle {
  readonly violated: boolean;
  /** When `violated` last flipped - the moment to pop the badge from, in
   * either direction, rather than only animating entrances. */
  readonly changedAt: number;
}

/** Tracks each constraint's own violated/satisfied flip, independent of
 * every other constraint on the board - so a player fixing one badge
 * doesn't reset the pop animation on an unrelated one still mid-flight. */
function useConstraintBadgeLifecycles(violated: ReadonlySet<string>, keys: ReadonlyArray<string>, now: number): Map<string, ConstraintBadgeLifecycle> {
  const stateRef = useRef(new Map<string, ConstraintBadgeLifecycle>());
  for (const key of keys) {
    const isViolated = violated.has(key);
    const existing = stateRef.current.get(key);
    if (!existing || existing.violated !== isViolated) {
      stateRef.current.set(key, { violated: isViolated, changedAt: now });
    }
  }
  return stateRef.current;
}

/** A pixel-space box for one error zone - always a square-cornered full
 * row or column, never a rounded local box. */
interface ErrorZoneBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface ErrorZoneLifecycle {
  readonly box: ErrorZoneBox;
  readonly firstSeenAt: number;
  readonly removedAt: number | null;
}

/**
 * One shared entrance/idle/exit lifecycle for every error zone, keyed by
 * what's actually wrong so a triple-run growing at its far end, a line
 * becoming unbalanced, and a newly-duplicated line all restart their own
 * entrance independently, and each keeps rendering (fading out) for
 * `ERROR_EXIT_MS` after it resolves rather than disappearing mid-frame.
 */
function useErrorZoneLifecycles(boxes: Map<string, ErrorZoneBox>, now: number): Map<string, ErrorZoneLifecycle> {
  const stateRef = useRef(new Map<string, ErrorZoneLifecycle>());
  const currentKeys = new Set(boxes.keys());

  for (const [key, box] of boxes) {
    const existing = stateRef.current.get(key);
    if (!existing || existing.removedAt !== null) {
      stateRef.current.set(key, { box, firstSeenAt: now, removedAt: null });
    } else {
      stateRef.current.set(key, { ...existing, box });
    }
  }

  for (const [key, entry] of stateRef.current) {
    if (!currentKeys.has(key) && entry.removedAt === null) {
      stateRef.current.set(key, { ...entry, removedAt: now });
    } else if (entry.removedAt !== null && now - entry.removedAt > ERROR_EXIT_MS) {
      stateRef.current.delete(key);
    }
  }

  return stateRef.current;
}

/**
 * The tray, not a plain white rectangle - a very quiet top-left-to-
 * bottom-right gradient (near-white easing toward a whisper of warm
 * shadow) so the whole board reads as one physical slab catching the
 * same light every tile and token already does, rather than a flat sheet
 * the tiles happen to sit on. Still light enough that empty cells
 * disappear into it cleanly - a coloured gutter would compete with the
 * tiles' own (bolder) colour. Cheap enough (three shapes) that it doesn't
 * need its own memo the way the tile chrome below does - it just needs to
 * render *before* the error zone, which itself needs to render before the
 * tile chrome (see `BinairoBoardView`).
 */
function renderTray(layout: BoardLayout): React.JSX.Element {
  const { boardSize } = layout;
  return (
    <Group>
      <RoundedRect x={0} y={0} width={boardSize} height={boardSize} r={10} color={theme.colors.surfaceHi}>
        <LinearGradient start={vec(0, 0)} end={vec(boardSize, boardSize)} colors={[theme.colors.trayLight, theme.colors.surfaceHi, theme.colors.trayDeep]} positions={[0, 0.55, 1]} />
      </RoundedRect>
      {/* A thin light seam along the top-left edge and a slightly deeper
          one along the bottom-right - the board's own edge catching and
          losing the light, not a uniform outline on all four sides. */}
      <Path
        path={`M ${boardSize - 1.5} 10 L ${boardSize - 1.5} ${boardSize - 10} Q ${boardSize - 1.5} ${boardSize - 1.5} ${boardSize - 10} ${boardSize - 1.5} L 10 ${boardSize - 1.5}`}
        color={inkWash(0.16)}
        style="stroke"
        strokeWidth={1.5}
        strokeCap="round"
      />
      {/* The frame is this game's own identity colour, not a neutral rule -
          the one place on the board itself that says "Binairo" at a
          glance, echoing (not duplicating) the header's own accent-tinted
          kicker/progress-track rather than leaving the accent to do all
          its work in a thin 3px line up there alone. */}
      <RoundedRect x={1} y={1} width={boardSize - 2} height={boardSize - 2} r={9} color={theme.colors.binairoAccent} style="stroke" strokeWidth={1.5} opacity={0.55} />
    </Group>
  );
}

/** One tile's full chrome - plain paper face, border, nothing else. Used
 * to also carry its own offset drop shadow and a pair of corner-highlight
 * strokes on top of that, on top of the *tray's* own shadow underneath the
 * whole board - three elevation cues stacked on the same surface, which is
 * exactly the "ghost card" a shadow-under-a-border always reads as: this
 * board has exactly one raised surface (the tray, see `renderTray`, which
 * owns the one shadow this whole board casts against the page), and a
 * tile is a ruled cell *within* that surface, not a second raised object
 * floating a millimetre above it. `given` still tells a puzzle's own clue
 * apart from a player's own entry, but now through the same token
 * semantics the rest of the app already uses for surface hierarchy -
 * `surface` (a touch toned down from the page) for a printed clue,
 * `surfaceHi` ("the brightest tappable surface") for a cell the player can
 * actually act on - plus a heavier rule, not through a fake shadow. */
export function renderTileChrome(tx: number, ty: number, tileSize: number, given: boolean): React.JSX.Element {
  return (
    <>
      <RoundedRect x={tx} y={ty} width={tileSize} height={tileSize} r={TILE_RADIUS} color={given ? theme.colors.surface : theme.colors.surfaceHi} />
      <RoundedRect
        x={tx}
        y={ty}
        width={tileSize}
        height={tileSize}
        r={TILE_RADIUS}
        color={given ? theme.colors.borderStrong : theme.colors.border}
        style="stroke"
        strokeWidth={given ? 1.5 : 1}
      />
    </>
  );
}

interface StaticBinairoTilesProps {
  puzzle: BinairoPuzzle;
  state: BinairoState;
  layout: BoardLayout;
  flashCell?: BinairoCell | null;
  /** Comma-joined `row:col` keys of cells mid-toggle right now, as a plain
   * string rather than a `Set` so `React.memo`'s default shallow prop
   * comparison (which compares primitives by value) can actually tell
   * "nothing changed" apart from "something changed" - a fresh `Set`
   * object would compare unequal every render even with identical
   * contents, defeating the memo entirely. */
  transitioningKeys: string;
}

/**
 * The board's static bulk: every tile's chrome (shadow, tinted face,
 * border) and every cell's steady-state symbol or empty ring - none of
 * which depends on the animation clock. Memoized away from the ~60
 * renders/sec the toggle-rotation/error-zone/constraint-badge/wave
 * layers run at, the same reasoning as `MirrorMazeBoardView`'s own
 * `StaticMazeLayer` split: without it, every tile on the board was being
 * fully rebuilt and reconciled every single frame for as long as the
 * puzzle stayed unsolved, which is exactly what made a 10x10 board feel
 * laggy even while the player was just looking at it, not actively
 * toggling anything. Deliberately opaque, and rendered *after* the error
 * zone in `BinairoBoardView` - a tile's own face is meant to fully hide
 * the hazard tape behind it, leaving the tape visible only through the
 * gaps between tiles.
 */
/**
 * One tile's chrome and one cell's symbol, each memoised on plain values.
 * A tap changes one cell, but the static layer re-renders twice per tap
 * (as the stamp starts, and as it ends) - and it used to rebuild every tile
 * and symbol on the board each time, 64 cells at 8x8, several shapes each.
 * On a phone that was lag on every placement. Now only the cell whose value
 * changed does any work; the rest bail out on their props.
 */
const TileChrome = React.memo(function TileChromeImpl({ tx, ty, tileSize, given }: { tx: number; ty: number; tileSize: number; given: boolean }) {
  return renderTileChrome(tx, ty, tileSize, given);
});

const CellSymbol = React.memo(function CellSymbolImpl({ cellKey, value, cx, cy, R }: { cellKey: string; value: BinairoState['values'][number][number]; cx: number; cy: number; R: number }) {
  return value === null ? renderEmptyRing(cellKey, cx, cy, R) : renderSymbol(cellKey, value, cx, cy, R);
});

const StaticBinairoTiles = React.memo(function StaticBinairoTilesImpl({ puzzle, state, layout, flashCell, transitioningKeys }: StaticBinairoTilesProps) {
  const tileSize = Math.max(0, layout.cellSize - TILE_GAP * 2);
  const R = tileSize * 0.32;
  const skipKeys = useMemo(() => new Set(transitioningKeys ? transitioningKeys.split(',') : []), [transitioningKeys]);

  return (
    <Group>
      {/* Per-cell tile chrome: a flat offset shadow (no blur - the same
          technique `towersShadow`/`tentsShadow` already use elsewhere)
          under a raised, plain-paper face, so cells read as tiles sitting
          in the tray above rather than squares drawn on one shared
          surface. Every tile is this same paper colour regardless of its
          value now - only a given cell's heavier `borderStrong` rule and
          deeper shadow (see `renderTileChrome`) tell it apart from a
          player's own entry; colour lives on the mark, not the tile. */}
      {state.values.map((line, r) =>
        line.map((_value, c) => {
          // A transitioning cell's whole chrome - not just its symbol - is
          // owned by the animated overlay instead, for exactly as long as
          // that overlay's own stamp/lift is still playing (see
          // `renderTileChrome`).
          if (skipKeys.has(`${r}:${c}`)) return null;
          const origin = getCellOrigin(layout, r, c);
          return <TileChrome key={`tile-${r}-${c}`} tx={origin.x + TILE_GAP} ty={origin.y + TILE_GAP} tileSize={tileSize} given={isGiven(puzzle, r, c)} />;
        }),
      )}

      {/* Hint-flash tint: matches the tile's own inset bounds/radius so it
          tints the raised tile itself, not the gutter around it. */}
      {flashCell &&
        (() => {
          const origin = getCellOrigin(layout, flashCell.row, flashCell.col);
          return (
            <RoundedRect
              x={origin.x + TILE_GAP}
              y={origin.y + TILE_GAP}
              width={tileSize}
              height={tileSize}
              r={TILE_RADIUS}
              color={theme.colors.accent}
            />
          );
        })()}

      {/* Steady-state symbols - skipped for any cell currently mid-toggle,
          since the small animated layer drawn on top of this one owns
          those while the placement's own rotation plays. */}
      {state.values.map((line, r) =>
        line.map((value, c) => {
          const key = `${r}:${c}`;
          if (skipKeys.has(key)) return null;
          const origin = getCellOrigin(layout, r, c);
          return <CellSymbol key={key} cellKey={key} value={value} cx={origin.x + TILE_GAP + tileSize / 2} cy={origin.y + TILE_GAP + tileSize / 2} R={R} />;
        }),
      )}
    </Group>
  );
});

export interface BinairoBoardViewProps {
  puzzle: BinairoPuzzle;
  state: BinairoState;
  size: number;
  solved: boolean;
  flashCell?: BinairoCell | null;
  /** The single cell currently held down, for the tactile press-glow -
   * see `usePressGlow`. */
  pressedCell?: BinairoCell | null;
  /** Bumped by the screen on every restart to replay the intro wave - see
   * `useIntroWave`. Undefined (the default, never changing) still plays
   * the wave once, at mount. */
  introKey?: number;
}

/**
 * The Skia-drawn Binairo board: individually raised tiles rather than one
 * flat surface, a flat gold disc vs. a flat blue rounded square as the
 * two fillable symbols (told apart by shape *and* colour together - see
 * `markColor`), an empty cell reading as a faint dashed ring, and one
 * consistent hazard-tape zone for the three rule violations - around
 * just the cells of a triple run, or the entire row or column for an
 * unequal count or a duplicated line.
 */
export function BinairoBoardView({ puzzle, state, size, solved, flashCell, pressedCell, introKey }: BinairoBoardViewProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const layout = useMemo(() => computeBoardLayout(puzzle.size, size), [puzzle.size, size]);
  const toggles = useToggleEvents(state.values);
  const solveWave = useSolveWave(solved, toggles, puzzle.size);
  // Both waves are purely decorative celebration/reveal moments (no state
  // information rides on them - the board is legible with or without
  // them), so reduced motion turns them off outright rather than
  // softening them: a puzzle solving instantly, with no light-wave sweep,
  // loses nothing a player needs.
  const waveActive = !reducedMotion && solveWave !== null && Date.now() - solveWave.startedAt < WAVE_TOTAL_MS;
  const now = Date.now();
  const introStartedAt = useIntroWave(introKey, now);
  const introElapsed = now - introStartedAt;
  const introActive = !reducedMotion && introElapsed < INTRO_TOTAL_MS;
  const pressGlow = usePressGlow(pressedCell, now);

  // Which rows/columns are actually wrong is a game rule (see
  // `errorLines`'s own comment for why a triple run washes immediately
  // while an unequal count or a duplicated line wait for the row/column to
  // be complete) - this view only turns that answer into pixel-space
  // hazard-tape boxes.
  const errorBoxes = useMemo(() => {
    const map = new Map<string, ErrorZoneBox>();
    const cellSize = layout.cellSize;
    // Whole lines: an unequal count.
    const unbalanced = unbalancedLines(puzzle, state);
    const rows = new Set<number>(unbalanced.rows);
    const cols = new Set<number>(unbalanced.cols);
    for (const r of rows) map.set(`line:row:${r}`, { x: 0, y: r * cellSize, w: layout.boardSize, h: cellSize });
    for (const c of cols) map.set(`line:col:${c}`, { x: c * cellSize, y: 0, w: cellSize, h: layout.boardSize });
    // Triple runs: just the run's own cells - unless its whole line is
    // already taped, which covers it.
    for (const run of tripleRunGroups(state)) {
      const length = run.end - run.start + 1;
      if (run.orientation === 'row') {
        if (rows.has(run.index)) continue;
        map.set(`run:row:${run.index}:${run.start}`, { x: run.start * cellSize, y: run.index * cellSize, w: length * cellSize, h: cellSize });
      } else {
        if (cols.has(run.index)) continue;
        map.set(`run:col:${run.index}:${run.start}`, { x: run.index * cellSize, y: run.start * cellSize, w: cellSize, h: length * cellSize });
      }
    }
    return map;
  }, [puzzle, state, layout]);

  const readyErrorKeys = useDelayedKeys(errorBoxes.keys(), now, ERROR_DELAY_MS);
  const delayedErrorBoxes = useMemo(() => {
    const map = new Map<string, ErrorZoneBox>();
    for (const [key, box] of errorBoxes) {
      if (readyErrorKeys.has(key)) map.set(key, box);
    }
    return map;
  }, [errorBoxes, readyErrorKeys]);
  const errorLifecycles = useErrorZoneLifecycles(delayedErrorBoxes, now);

  const violatedConstraintKeys = useMemo(() => violatedConstraints(puzzle, state), [puzzle, state]);
  const constraintKeys = useMemo(() => (puzzle.constraints ?? []).map(constraintKey), [puzzle]);
  const readyViolatedKeys = useDelayedKeys(violatedConstraintKeys, now, ERROR_DELAY_MS);
  const badgeLifecycles = useConstraintBadgeLifecycles(readyViolatedKeys, constraintKeys, now);

  // Twin badges reuse the exact same delayed-onset/lifecycle machinery as
  // constraint badges above - both are "a badge that pops on violate and
  // pulses while it stays wrong," just keyed and positioned differently.
  const violatedTwinKeys = useMemo(() => violatedTwins(puzzle, state), [puzzle, state]);
  const twinCellKeys = useMemo(() => (puzzle.twinCells ?? []).map(twinKey), [puzzle]);
  const readyViolatedTwinKeys = useDelayedKeys(violatedTwinKeys, now, ERROR_DELAY_MS);
  const twinBadgeLifecycles = useConstraintBadgeLifecycles(readyViolatedTwinKeys, twinCellKeys, now);

  // The animation clock used to run for as long as `!solved` - i.e. the
  // entire time a puzzle is open, whether or not anything on screen was
  // actually changing. A player just looking at a clean, unsolved board
  // was still costing a 60fps re-render loop with nothing to show for it.
  // It now runs only while something is genuinely animating:
  //  - any error zone, for its enter/exit fade (bounded, `ERROR_ENTER_MS`/
  //    `ERROR_EXIT_MS`) - and, unless reduced motion is on, for as long as
  //    it stays on screen, since its outline keeps breathing;
  //  - any constraint/twin badge mid-pop (`CONSTRAINT_POP_MS`, in either
  //    direction - becoming violated *or* becoming satisfied again both
  //    pop) - and, unless reduced motion is on, for as long as it stays
  //    actively violated, since it keeps breathing;
  //  - the solve wave, the intro wave, or an in-flight press glow, exactly
  //    as before.
  const errorEntering = Array.from(errorLifecycles.values()).some(
    lifecycle =>
      (lifecycle.removedAt === null && now - lifecycle.firstSeenAt < ERROR_ENTER_MS) ||
      (lifecycle.removedAt !== null && now - lifecycle.removedAt < ERROR_EXIT_MS),
  );
  const badgePopping =
    Array.from(badgeLifecycles.values()).some(lifecycle => now - lifecycle.changedAt < CONSTRAINT_POP_MS) ||
    Array.from(twinBadgeLifecycles.values()).some(lifecycle => now - lifecycle.changedAt < CONSTRAINT_POP_MS);
  // A key that just became wrong but hasn't yet cleared `ERROR_DELAY_MS`
  // isn't in `readyErrorKeys`/`readyViolatedKeys` yet, and so isn't
  // reflected in `errorLifecycles`/`badgeLifecycles` either - none of the
  // three "is something showing" checks above see it. Without this, the
  // clock went idle for exactly that pending window, since nothing on
  // screen looked like it needed a frame; nothing then woke this
  // component up once the delay actually elapsed, so a fresh mistake sat
  // invisible until some *other* prop change (the player's next move)
  // forced a re-render at a `now` that happened to have cleared it. That
  // render made the violation appear to onset in one uneven jump instead
  // of on its own timer - reported as "the error isn't visible until I do
  // another move, and it's buggy". Counting the pending set here keeps
  // the clock (at the idle throttle - there is nothing to actually paint
  // yet) alive through exactly that window, so the delay always resolves
  // on its own.
  const errorPending = errorBoxes.size > readyErrorKeys.size;
  const constraintPending = violatedConstraintKeys.size > readyViolatedKeys.size;
  const twinPending = violatedTwinKeys.size > readyViolatedTwinKeys.size;
  const idleMotion =
    !reducedMotion &&
    (errorLifecycles.size > 0 ||
      readyViolatedKeys.size > 0 ||
      readyViolatedTwinKeys.size > 0 ||
      errorPending ||
      constraintPending ||
      twinPending);
  // Split by what is actually on screen. The short transitions - a zone
  // fading in, a badge popping, the solve/intro waves, a press glow - are
  // the moments a player is looking straight at, and they get real frames.
  // The idle half (hazard tape scrolling, a violated badge breathing) is
  // ambient and runs for as long as a mistake sits there, so it takes the
  // same throttle Mirror Maze and Tents already use. This board was the one
  // that never got it, and it is the heaviest of the three.
  // Which cells are still within their `TOGGLE_MS` rotation window right
  // now - typically none. `toggles` never shrinks (finished transitions
  // just age past `TOGGLE_MS` rather than being deleted), so this is a
  // cheap linear scan over at most one entry per cell on the board, not
  // proportional to anything animation-related.
  const transitioningEntries: Array<[string, ToggleEvent]> = [];
  for (const entry of toggles) {
    if (now - entry[1].startedAt < TOGGLE_MS) transitioningEntries.push(entry);
  }
  const transitioningKeys = transitioningEntries.map(([key]) => key).join(',');

  // The stamp itself is in here now. It was not, so a placed piece only
  // animated smoothly while the press glow happened to be keeping the
  // clock at full rate - a quick tap, or a hint, landed it on whatever
  // the idle throttle gave it (or on no frames at all), which is the lag
  // players felt on every move.
  // The stamp and the press glow are no longer on this list: both now play
  // on the UI thread (`StampTransition`, `PressGlowView`) and need no
  // frames from here at all - so an ordinary tap runs no clock.
  const needsFullRate = errorEntering || badgePopping || waveActive || introActive;
  useAnimationClock(needsFullRate || idleMotion, needsFullRate ? 60 : IDLE_MOTION_FPS);

  const tileSize = Math.max(0, layout.cellSize - TILE_GAP * 2);
  const R = tileSize * 0.32;

  return (
    <Group>
      {renderTray(layout)}

      {/* Error zone: one consistent hazard-tape treatment for all three
          rule violations - a triple run's own cells, or a whole row or
          column (see `errorBoxes` above). Rendered *behind* the tile chrome
          (`StaticBinairoTiles`, below) rather than over it: a tile's own
          opaque face fully covers the tape across its own footprint, so
          the diagonal stripes only show through the gaps between and
          around the offending tiles - a red seam, not a wash painted across the tiles
          and symbols themselves. */}
      {Array.from(errorLifecycles.entries()).map(([key, { box, firstSeenAt, removedAt }]) => {
        let opacity: number;
        let scale: number;
        if (removedAt === null) {
          const elapsed = now - firstSeenAt;
          opacity = easeOutCubic(clamp01(elapsed / ERROR_ENTER_MS));
          // Reduced motion keeps the fade (the zone appearing/disappearing
          // is a real signal) and drops the tiny overshoot-grow.
          scale = reducedMotion ? 1 : 0.95 + easeOutBack(clamp01(elapsed / ERROR_SCALE_MS)) * 0.05;
        } else {
          const t = easeInCubic(clamp01((now - removedAt) / ERROR_EXIT_MS));
          opacity = 1 - t;
          scale = reducedMotion ? 1 : 1 - t * 0.02;
        }

        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        // A calm ring around just the offending tiles: a soft red wash
        // behind them (it shows in the gaps between tiles) and a rounded
        // outline that hugs them, breathing gently while the mistake
        // stays. Inset into the cell gaps so it never spills past the
        // board's edge. Reduced motion keeps it still.
        const inset = TILE_GAP * 0.45;
        const breathe = reducedMotion ? 1 : 0.72 + 0.28 * (0.5 + 0.5 * Math.cos(((now - firstSeenAt) / ERROR_BREATHE_MS) * Math.PI * 2));

        return (
          <Group
            key={key}
            opacity={opacity}
            transform={[{ translateX: cx }, { translateY: cy }, { scale }, { translateX: -cx }, { translateY: -cy }]}
          >
            <RoundedRect x={box.x + inset} y={box.y + inset} width={box.w - inset * 2} height={box.h - inset * 2} r={TILE_RADIUS + 4} color={theme.colors.danger} opacity={ERROR_FILL_OPACITY} />
            <RoundedRect
              x={box.x + inset}
              y={box.y + inset}
              width={box.w - inset * 2}
              height={box.h - inset * 2}
              r={TILE_RADIUS + 4}
              color={theme.colors.danger}
              style="stroke"
              strokeWidth={2}
              opacity={ERROR_BORDER_OPACITY * breathe}
            />
          </Group>
        );
      })}

      <StaticBinairoTiles puzzle={puzzle} state={state} layout={layout} flashCell={flashCell} transitioningKeys={transitioningKeys} />

      {/* Toggle placement: a stamp, not a flip - see `STAMP_IN_MS`'s own
          comment for why. The outgoing mark (if any) and the incoming
          mark (if any) animate concurrently off the same `elapsed`, not
          sequenced into two halves of one window - a real ink stamp
          doesn't wait for the old mark to finish leaving before it
          strikes, and running them together is what keeps a fast run of
          taps feeling continuous. The tile's own chrome no longer needs
          to swap colour mid-transition (see `renderTileChrome`), so it's
          just drawn once per transitioning cell here, same as the static
          layer draws it everywhere else. */}
      {transitioningEntries.map(([key, event]) => {
        const [rStr, cStr] = key.split(':');
        const r = Number(rStr);
        const c = Number(cStr);
        const origin = getCellOrigin(layout, r, c);
        return (
          <StampTransition
            key={`${key}@${event.startedAt}`}
            event={event}
            x={origin.x + TILE_GAP}
            y={origin.y + TILE_GAP}
            tileSize={tileSize}
            R={R}
            given={isGiven(puzzle, r, c)}
            reducedMotion={reducedMotion}
          />
        );
      })}

      {/* Constraint tiles: drawn every frame (not in the memoized static
          layer) purely so they can animate - a pop the instant a badge's
          violated/satisfied state flips, settling into a slow breathing
          pulse for as long as it stays actually wrong. Always on top of
          the tile faces/symbols and the hazard tape, right on the seam
          between the two cells a badge connects. */}
      {(puzzle.constraints ?? []).map(constraint => {
        const key = constraintKey(constraint);
        const partner = constraintPartner(constraint);
        const originA = getCellOrigin(layout, constraint.row, constraint.col);
        const originB = getCellOrigin(layout, partner.row, partner.col);
        const cx = (originA.x + originB.x) / 2 + layout.cellSize / 2;
        const cy = (originA.y + originB.y) / 2 + layout.cellSize / 2;
        const isViolated = readyViolatedKeys.has(key);
        const lifecycle = badgeLifecycles.get(key);
        const elapsedSinceChange = lifecycle ? now - lifecycle.changedAt : Infinity;
        // Reduced motion keeps the badge's colour swap (the real signal -
        // violated red vs. resting ink) and drops the overshoot pop and
        // the continuous breathing pulse, both pure movement.
        const scale = reducedMotion
          ? 1
          : elapsedSinceChange < CONSTRAINT_POP_MS
            ? 0.7 + easeOutBack(clamp01(elapsedSinceChange / CONSTRAINT_POP_MS)) * 0.3
            : isViolated
              ? 1 + Math.sin((now / CONSTRAINT_PULSE_PERIOD_MS) * Math.PI * 2) * CONSTRAINT_PULSE_AMPLITUDE
              : 1;
        return renderConstraintBadge(`constraint-${key}`, cx, cy, tileSize * CONSTRAINT_BADGE_RADIUS_FACTOR * scale, constraint.kind, isViolated);
      })}

      {/* Twin badges: same every-frame/pop/pulse treatment as constraint
          tiles above, just one dot per twinned cell instead of a badge on
          a shared edge - see `renderTwinBadge`'s own comment for why the
          two badge kinds are deliberately unlike each other. `twinCells`
          only ever lists one side of each pair (see that field's own
          comment), so both the anchor *and* its derived partner draw a
          badge here - a player has to recognise the cue on either cell
          it lands on, not just the one the puzzle data happens to name. */}
      {(puzzle.twinCells ?? []).flatMap(anchor => {
        const key = twinKey(anchor);
        const partner = twinPartner(puzzle.size, anchor);
        const isViolated = readyViolatedTwinKeys.has(key);
        const lifecycle = twinBadgeLifecycles.get(key);
        const elapsedSinceChange = lifecycle ? now - lifecycle.changedAt : Infinity;
        // Same reduced-motion treatment as the constraint badge above -
        // keep the colour swap, drop the pop and the breathing pulse.
        const scale = reducedMotion
          ? 1
          : elapsedSinceChange < CONSTRAINT_POP_MS
            ? 0.7 + easeOutBack(clamp01(elapsedSinceChange / CONSTRAINT_POP_MS)) * 0.3
            : isViolated
              ? 1 + Math.sin((now / CONSTRAINT_PULSE_PERIOD_MS) * Math.PI * 2) * CONSTRAINT_PULSE_AMPLITUDE
              : 1;
        const radius = tileSize * TWIN_BADGE_RADIUS_FACTOR * scale;
        return [anchor, partner].map((cell, i) => {
          const origin = getCellOrigin(layout, cell.row, cell.col);
          const tx = origin.x + TILE_GAP;
          const ty = origin.y + TILE_GAP;
          const cx = tx + tileSize - tileSize * TWIN_BADGE_INSET_FACTOR;
          const cy = ty + tileSize * TWIN_BADGE_INSET_FACTOR;
          return renderTwinBadge(`twin-${key}-${i}`, cx, cy, radius, isViolated);
        });
      })}

      {/* Solve wave: a glowing double ring (a soft warm halo plus a crisp
          bright core) on every tile in turn, radiating from the cell that
          finished the puzzle, plus a quick white sparkle flash on the
          token itself right as the ring passes over it - not just a ring
          drawn on top of it. The crisp core is white, not the warm accent
          the halo uses - an accent-coloured ring all but disappeared
          against the tile face's own similarly warm gold half of the
          board, so only the ambient halo (which doesn't need to read
          crisply) keeps that colour; the core needs to read clearly
          against both tile colours, and white does. The board's own
          celebration, on top of everything else, that `BinairoScreen`'s
          completion popup deliberately waits for rather than cutting
          off. */}
      {waveActive &&
        solveWave &&
        state.values.map((line, r) =>
          line.map((_value, c) => {
            const dist = Math.max(Math.abs(r - solveWave.originRow), Math.abs(c - solveWave.originCol));
            const cellElapsed = now - solveWave.startedAt - dist * WAVE_STAGGER_MS;
            if (cellElapsed < 0 || cellElapsed >= WAVE_TILE_MS) return null;
            const t = easeOutCubic(cellElapsed / WAVE_TILE_MS);
            const origin = getCellOrigin(layout, r, c);
            const cx = origin.x + layout.cellSize / 2;
            const cy = origin.y + layout.cellSize / 2;
            // A quick sparkle on the bubble itself: rises fast, peaks
            // early in the tile's own window, fades out by the time the
            // ring has moved on.
            const flash = Math.max(0, 1 - Math.abs(cellElapsed - WAVE_TILE_MS * 0.18) / (WAVE_TILE_MS * 0.4));
            return (
              <Group key={`wave-${r}-${c}`}>
                <Circle cx={cx} cy={cy} r={(tileSize / 2) * (1 + t * 0.38)} color={theme.colors.accent} style="stroke" strokeWidth={7} opacity={(1 - t) * 0.28} />
                <Circle cx={cx} cy={cy} r={(tileSize / 2) * (1 + t * 0.3)} color="rgba(255,255,255,0.95)" style="stroke" strokeWidth={2.5} opacity={(1 - t) * 0.95} />
                <Circle cx={cx} cy={cy} r={tileSize * 0.32} color="rgba(255,255,255,0.95)" opacity={flash * 0.5} />
              </Group>
            );
          }),
        )}

      {/* Press feedback: a soft full-tile darkening for as long as the
          finger stays down, plus a brighter accent ring rippling outward
          from the centre - drawn on top of everything so both still read
          even the instant a toggle's own flip starts underneath (see
          `PRESS_GLOW_OUT_MS`/`PRESS_RIPPLE_MS` for why that overlap is
          brief and harmless). */}
      {pressGlow &&
        (() => {
          const [rStr, cStr] = pressGlow.key.split(':');
          const origin = getCellOrigin(layout, Number(rStr), Number(cStr));
          return (
            <PressGlowView
              key={`${pressGlow.key}@${pressGlow.pressedAt}`}
              x={origin.x + TILE_GAP}
              y={origin.y + TILE_GAP}
              tileSize={tileSize}
              released={pressGlow.releasedAt !== null}
              reducedMotion={reducedMotion}
            />
          );
        })()}

      {/* Intro wave: every tile - given or not - starts hidden under its
          own solid cream shutter with a glowing accent seam along its
          shrinking edge, which pops away (an overshooting "iris" reveal,
          not a plain fade) in a diagonal wave from the top-left corner -
          see `INTRO_STAGGER_MS`/`INTRO_TILE_MS`. Drawn last so it covers
          the tray, tile chrome, tokens and constraint badges alike until
          each tile's own turn comes up. */}
      {introActive &&
        state.values.map((line, r) =>
          line.map((_value, c) => {
            const dist = Math.max(r, c);
            const cellElapsed = introElapsed - dist * INTRO_STAGGER_MS;
            const origin = getCellOrigin(layout, r, c);
            const tx = origin.x + TILE_GAP;
            const ty = origin.y + TILE_GAP;
            if (cellElapsed < 0) {
              return <RoundedRect key={`intro-${r}-${c}`} x={tx} y={ty} width={tileSize} height={tileSize} r={TILE_RADIUS} color={theme.colors.background} />;
            }
            if (cellElapsed >= INTRO_TILE_MS) return null;
            const t = clamp01(cellElapsed / INTRO_TILE_MS);
            const scale = 1 - easeOutCubic(t);
            if (scale <= 0.001) return null;
            const cx = tx + tileSize / 2;
            const cy = ty + tileSize / 2;
            const seamOpacity = 1 - easeInCubic(t);
            return (
              <Group key={`intro-${r}-${c}`} transform={[{ scale }]} origin={vec(cx, cy)}>
                <RoundedRect x={tx} y={ty} width={tileSize} height={tileSize} r={TILE_RADIUS} color={theme.colors.background} />
                <RoundedRect
                  x={tx}
                  y={ty}
                  width={tileSize}
                  height={tileSize}
                  r={TILE_RADIUS}
                  color={theme.colors.accent}
                  style="stroke"
                  strokeWidth={Math.max(1, tileSize * INTRO_SEAM_WIDTH_FACTOR)}
                  opacity={seamOpacity}
                />
              </Group>
            );
          }),
        )}
    </Group>
  );
}
