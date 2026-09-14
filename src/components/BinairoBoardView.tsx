import React, { useMemo, useRef } from 'react';
import { Circle, DashPathEffect, Group, Path, RadialGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import {
  BinairoCell,
  BinairoConstraint,
  BinairoPuzzle,
  BinairoState,
  BinairoValue,
  constraintKey,
  constraintPartner,
  duplicateLineGroups,
  isGiven,
  tripleRunGroups,
  unbalancedLines,
  violatedConstraints,
} from '../game/binairo';
import { BoardLayout, computeBoardLayout, getCellOrigin, useAnimationClock } from '../game/rendering';
import { theme } from '../theme';

/** One duration covers every toggle transition; which parameter animates
 * (a crossfade between two symbols, or scale+opacity against the empty
 * ring) depends on whether either end of the transition is "empty". */
const TOGGLE_MS = 200;

/** All three rule violations - a triple run, an unequal count, a
 * duplicated line - render as the *same* hazard-tape zone at the *same*
 * extent: the entire offending row or column, never a tight box around
 * just the 3 or 4 cells that happen to be the run itself. A player still
 * mid-cycle through blank -> ring -> dot on some other cell of that same
 * line would otherwise see a small error patch flare up and vanish
 * around their finger on every pass, with no specific tile to fix and no
 * way to act on it yet - the whole-line treatment reads as "this line
 * still needs work" instead. */
const ERROR_ENTER_MS = 140;
const ERROR_SCALE_MS = 220;
const ERROR_EXIT_MS = 160;
const ERROR_SCROLL_PERIOD_MS = 2400;
const ERROR_STRIPE_WIDTH = 5;
const ERROR_STRIPE_OPACITY = 0.55;
const ERROR_BORDER_OPACITY = 0.8;

/** Every tile is its own small raised surface inset from the raw cell
 * bounds, instead of a square on one shared flat board surface - see the
 * per-cell chrome drawn in `StaticBinairoTiles` below. Wide enough that
 * the hazard-tape zone (rendered *behind* the tiles, not over them - see
 * the error-zone block in `BinairoBoardView` itself) has a real gap to
 * show through, not just a hairline. */
const TILE_GAP = 6;
const TILE_RADIUS = 8;
const TILE_SHADOW_DY = 2;

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
const WAVE_STAGGER_MS = 40;
const WAVE_TILE_MS = 220;
const WAVE_TOTAL_MS = 650;

/** The two fillable states are a solid disc and a solid rounded square -
 * two different *shapes*, not two colours, so they're still told apart at
 * a glance even though both are now the same kind of glossy 3D "bubble".
 * `ICON_COLOR` survives only for the constraint badges' own ink marks -
 * the two symbols below get their colour from `bubbleBaseColor` instead. */
const ICON_COLOR = theme.colors.primary;

/** The square bubble's own proportions, relative to the circle bubble's
 * radius `R` - slightly larger half-width than `R`, so it reads as "the
 * same visual weight" next to the disc rather than looking small and
 * secondary beside it. */
const SQUARE_HALF_FACTOR = 1.05;
const SQUARE_CORNER_FACTOR = 0.38;

/**
 * Both fillable symbols are glossy 3D "bubbles" now, coloured with the
 * exact same hue family their own tile face already uses -
 * `binairoFilledTile*` for the circle ("1"), `binairoOutlineTile*` for
 * the square ("0") - just as the bubble's own flat base, so a bubble and
 * the tile it sits in are always one coordinated colour rather than two
 * competing ones (see `bubbleBaseColor`). A radial highlight-to-shadow
 * gradient on top - this app's first use of a Skia gradient shader, not
 * a blur filter, so the existing "cheap shapes over image filters" stance
 * still holds - gives the flat base real sphere-like volume; a thin ink
 * rim keeps the bubble legible even where its own hue nearly matches its
 * tile. The highlight itself is a thin bright *crescent* hugging the
 * upper-left rim (`crescentPath`, a plain stroked arc), not a glow or a
 * dot sitting in the middle - the actual shape a curved reflective
 * surface produces, closer to how light really wraps around a sphere or
 * a bubble-wrap dome than either of the two earlier attempts (flat
 * highlight dots that read as pasted-on blemishes; then a soft centred
 * glow that still read as a smudge rather than a rim of light). A given
 * cell's bubble gets a bolder crescent and a deeper shadow edge (more
 * polished/"premium"); a player cell's gets a gentler version of the
 * exact same treatment - still unmistakably a 3D bubble, just a touch
 * softer - continuing the given-vs-player materiality distinction the
 * tile chrome itself already makes.
 */
const BUBBLE_HIGHLIGHT_OFFSET_FACTOR = 0.32;
const BUBBLE_GRADIENT_REACH_FACTOR = 1.3;
const BUBBLE_RIM_COLOR = 'rgba(42, 37, 31, 0.3)';
const BUBBLE_RIM_STROKE_FACTOR = 0.045;
const BUBBLE_HIGHLIGHT_GIVEN = 0.85;
const BUBBLE_HIGHLIGHT_PLAYER = 0.6;
const BUBBLE_SHADOW_GIVEN = 0.42;
const BUBBLE_SHADOW_PLAYER = 0.24;
/** The crescent arc: a ring slightly inside the bubble's own edge,
 * spanning roughly its upper-left quadrant (`200deg` to `300deg`, in a
 * y-down system where `0deg` is due east and angle increases clockwise -
 * so `270deg` is due north), stroked rather than filled. */
const BUBBLE_CRESCENT_RADIUS_FACTOR = 0.6;
const BUBBLE_CRESCENT_STROKE_FACTOR = 0.15;
const BUBBLE_CRESCENT_START_DEG = 200;
const BUBBLE_CRESCENT_END_DEG = 300;
const BUBBLE_CRESCENT_OPACITY_GIVEN = 0.85;
const BUBBLE_CRESCENT_OPACITY_PLAYER = 0.55;

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

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}
function easeInCubic(t: number): number {
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
/** The same overshoot shape as `easeOutBack`, just a stronger snap (a
 * bigger `c1`) reserved for a bubble actually popping into place - a
 * distinctly bigger, springier motion than the smaller UI-chrome
 * overshoots (the error zone, the constraint badge) use. */
function easeOutPop(t: number): number {
  const c1 = 2.4;
  const c3 = c1 + 1;
  const x = t - 1;
  return 1 + c3 * x ** 3 + c1 * x ** 2;
}

/** The tile-matching flat colour a bubble is built on top of - the same
 * token its own tile face already fills with, so bubble and tile are one
 * coordinated colour by construction rather than two independently-tuned
 * ones that could drift apart later. */
function bubbleBaseColor(value: 1 | 0, given: boolean): string {
  if (value === 1) return given ? theme.colors.binairoFilledTileGiven : theme.colors.binairoFilledTile;
  return given ? theme.colors.binairoOutlineTileGiven : theme.colors.binairoOutlineTile;
}

/** An SVG arc path for one stroked crescent - `startDeg`/`endDeg` in a
 * y-down system where `0deg` is due east and angle increases clockwise
 * (so `270deg` is due north). Only ever spans <=180deg in this file, so
 * the SVG arc's own large-arc flag stays a fixed `0`. */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const sx = cx + r * Math.cos(toRad(startDeg));
  const sy = cy + r * Math.sin(toRad(startDeg));
  const ex = cx + r * Math.cos(toRad(endDeg));
  const ey = cy + r * Math.sin(toRad(endDeg));
  return `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`;
}

/** A glossy 3D disc: a flat base fill, a radial highlight-to-shadow
 * gradient on top for real sphere volume, a thin bright crescent hugging
 * the upper-left rim - the actual shape light wraps a curved surface in,
 * not a dot or a glow sitting in the middle of it - and a thin ink rim
 * for legibility against a tile that may share its exact hue. */
function renderCircleBubble(key: string, cx: number, cy: number, R: number, opacity: number, scale: number, given: boolean): React.JSX.Element {
  const r = R * scale;
  const hi = given ? BUBBLE_HIGHLIGHT_GIVEN : BUBBLE_HIGHLIGHT_PLAYER;
  const shadow = given ? BUBBLE_SHADOW_GIVEN : BUBBLE_SHADOW_PLAYER;
  const crescentOpacity = given ? BUBBLE_CRESCENT_OPACITY_GIVEN : BUBBLE_CRESCENT_OPACITY_PLAYER;
  const hx = cx - r * BUBBLE_HIGHLIGHT_OFFSET_FACTOR;
  const hy = cy - r * BUBBLE_HIGHLIGHT_OFFSET_FACTOR;
  return (
    <Group key={key}>
      <Circle cx={cx} cy={cy} r={r} color={bubbleBaseColor(1, given)} opacity={opacity} />
      <Circle cx={cx} cy={cy} r={r} opacity={opacity}>
        <RadialGradient c={vec(hx, hy)} r={r * BUBBLE_GRADIENT_REACH_FACTOR} colors={[`rgba(255,255,255,${hi})`, 'rgba(255,255,255,0.04)', `rgba(24,18,12,${shadow})`]} positions={[0, 0.55, 1]} />
      </Circle>
      <Path
        path={arcPath(cx, cy, r * BUBBLE_CRESCENT_RADIUS_FACTOR, BUBBLE_CRESCENT_START_DEG, BUBBLE_CRESCENT_END_DEG)}
        color="rgba(255,255,255,0.95)"
        style="stroke"
        strokeWidth={r * BUBBLE_CRESCENT_STROKE_FACTOR}
        strokeCap="round"
        opacity={opacity * crescentOpacity}
      />
      <Circle cx={cx} cy={cy} r={r} color={BUBBLE_RIM_COLOR} style="stroke" strokeWidth={Math.max(1, r * BUBBLE_RIM_STROKE_FACTOR)} opacity={opacity} />
    </Group>
  );
}

/** The circle's counterpart: the exact same glossy-bubble treatment
 * (flat base, radial gradient, crescent highlight, ink rim) applied to a
 * rounded square instead - a genuinely different silhouette, so the two
 * fillable states are still told apart by shape alone even though both
 * are now filled, 3D bubbles rather than one solid and one hollow. */
function renderSquareBubble(key: string, cx: number, cy: number, R: number, opacity: number, scale: number, given: boolean): React.JSX.Element {
  const half = R * SQUARE_HALF_FACTOR * scale;
  const x = cx - half;
  const y = cy - half;
  const side = half * 2;
  const cr = half * SQUARE_CORNER_FACTOR;
  const hi = given ? BUBBLE_HIGHLIGHT_GIVEN : BUBBLE_HIGHLIGHT_PLAYER;
  const shadow = given ? BUBBLE_SHADOW_GIVEN : BUBBLE_SHADOW_PLAYER;
  const crescentOpacity = given ? BUBBLE_CRESCENT_OPACITY_GIVEN : BUBBLE_CRESCENT_OPACITY_PLAYER;
  const hx = cx - half * BUBBLE_HIGHLIGHT_OFFSET_FACTOR;
  const hy = cy - half * BUBBLE_HIGHLIGHT_OFFSET_FACTOR;
  return (
    <Group key={key}>
      <RoundedRect x={x} y={y} width={side} height={side} r={cr} color={bubbleBaseColor(0, given)} opacity={opacity} />
      <RoundedRect x={x} y={y} width={side} height={side} r={cr} opacity={opacity}>
        <RadialGradient c={vec(hx, hy)} r={half * BUBBLE_GRADIENT_REACH_FACTOR} colors={[`rgba(255,255,255,${hi})`, 'rgba(255,255,255,0.04)', `rgba(24,18,12,${shadow})`]} positions={[0, 0.55, 1]} />
      </RoundedRect>
      <Path
        path={arcPath(cx, cy, half * BUBBLE_CRESCENT_RADIUS_FACTOR, BUBBLE_CRESCENT_START_DEG, BUBBLE_CRESCENT_END_DEG)}
        color="rgba(255,255,255,0.95)"
        style="stroke"
        strokeWidth={half * BUBBLE_CRESCENT_STROKE_FACTOR}
        strokeCap="round"
        opacity={opacity * crescentOpacity}
      />
      <RoundedRect x={x} y={y} width={side} height={side} r={cr} color={BUBBLE_RIM_COLOR} style="stroke" strokeWidth={Math.max(1, half * BUBBLE_RIM_STROKE_FACTOR)} opacity={opacity} />
    </Group>
  );
}

function renderSymbol(key: string, value: 1 | 0, cx: number, cy: number, R: number, opacity: number, scale: number, given: boolean): React.JSX.Element {
  return value === 1 ? renderCircleBubble(key, cx, cy, R, opacity, scale, given) : renderSquareBubble(key, cx, cy, R, opacity, scale, given);
}

/** The resting state's own icon: a faint dashed ring, distinct in kind
 * (not just colour) from both fillable symbols. Takes its own `key`
 * explicitly (rather than a hardcoded one) since it's sometimes returned
 * directly as a list element and sometimes as one of two siblings inside
 * a wrapping `Group` - a fixed key would collide across every empty cell
 * in the first case. */
function renderEmptyRing(key: string, cx: number, cy: number, R: number, opacity: number): React.JSX.Element {
  return (
    <Circle key={key} cx={cx} cy={cy} r={R} color={theme.colors.textTertiary} style="stroke" strokeWidth={1.5} opacity={opacity}>
      <DashPathEffect intervals={[R * 0.28, R * 0.22]} />
    </Circle>
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
function renderConstraintBadge(key: string, cx: number, cy: number, radius: number, kind: BinairoConstraint['kind'], violated: boolean): React.JSX.Element {
  const fill = violated ? theme.colors.danger : theme.colors.surfaceHi;
  const ring = violated ? theme.colors.danger : theme.colors.borderStrong;
  const mark = violated ? theme.colors.surfaceHi : ICON_COLOR;
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

/** A plain rectangle SVG path - used only where a plain `<Rect>` element
 * won't do, i.e. as a Skia `clip` value (which takes a path/rect, not a
 * drawable element). Every error zone is a full row/column now, always
 * square-cornered, so this needs no radius parameter. */
function rectPath(x: number, y: number, w: number, h: number): string {
  return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
}

/**
 * Absolute-coordinate 45-degree stripe centrelines covering a `w`x`h` box
 * anchored at `(bx, by)`, spaced so the *true perpendicular* gap between
 * consecutive `stripeWidth`-thick strokes is also `stripeWidth` (an equal
 * stripe/gap hazard-tape look) - each line is drawn far past the box on
 * both ends and left to a clip to crop, rather than computed to the exact
 * box edges, so no per-line trimming math is needed. `phaseOffset` (in the
 * same diagonal-offset units used internally) slides every stripe along
 * the diagonal for the idle scroll.
 */
function hazardStripePaths(bx: number, by: number, w: number, h: number, stripeWidth: number, phaseOffset: number): string[] {
  const period = stripeWidth * 2 * Math.SQRT2; // consecutive stroke centres, in x-y units
  const margin = w + h;
  const dMin = -h - stripeWidth;
  const dMax = w + stripeWidth;
  const paths: string[] = [];
  const t0 = -margin;
  const t1 = w + h + margin;
  for (let d = dMin + (phaseOffset % period); d <= dMax; d += period) {
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
 * `useGemBursts`/`useMirrorFlourish` use on Mirror Maze's board. */
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
 * Plain white tray, not the warm-tan `surfaceAlt` every other board
 * uses - a coloured gutter competed with the tiles' own (now bolder)
 * colour, and empty cells disappearing seamlessly into a white tray
 * reads as cleaner than a visible tan gap around them. Cheap enough (two
 * shapes) that it doesn't need its own memo the way the tile chrome
 * below does - it just needs to render *before* the error zone, which
 * itself needs to render before the tile chrome (see `BinairoBoardView`).
 */
function renderTray(layout: BoardLayout): React.JSX.Element {
  return (
    <Group>
      <RoundedRect x={0} y={0} width={layout.boardSize} height={layout.boardSize} r={10} color={theme.colors.surfaceHi} />
      <RoundedRect
        x={1}
        y={1}
        width={layout.boardSize - 2}
        height={layout.boardSize - 2}
        r={9}
        color={theme.colors.borderStrong}
        style="stroke"
        strokeWidth={2}
      />
    </Group>
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
 * renders/sec the toggle-crossfade and error-zone layers run at, the same
 * reasoning as `MirrorMazeBoardView`'s own `StaticMazeLayer` split:
 * without it, every tile on the board was being fully rebuilt and
 * reconciled every single frame for as long as the puzzle stayed
 * unsolved, which is exactly what made a 10x10 board feel laggy even
 * while the player was just looking at it, not actively toggling
 * anything. Deliberately opaque, and rendered *after* the error zone in
 * `BinairoBoardView` - a tile's own face is meant to fully hide the
 * hazard tape behind it, leaving the tape visible only through the gaps
 * between tiles.
 */
const StaticBinairoTiles = React.memo(function StaticBinairoTilesImpl({
  puzzle,
  state,
  layout,
  flashCell,
  transitioningKeys,
}: StaticBinairoTilesProps) {
  const tileSize = Math.max(0, layout.cellSize - TILE_GAP * 2);
  const R = tileSize * 0.32;
  const skipKeys = useMemo(() => new Set(transitioningKeys ? transitioningKeys.split(',') : []), [transitioningKeys]);

  return (
    <Group>
      {/* Per-cell tile chrome: a flat offset shadow (no blur - the same
          technique `towersShadow`/`tentsShadow` already use elsewhere)
          under a raised face, so cells read as tiles sitting in the tray
          above rather than squares drawn on one shared surface. The face
          itself carries a faint per-symbol tint - a reference
          screenshot's own tiles are fully coloured, not neutral squares
          with a coloured icon on them. Given cells get both a visibly
          deeper tint *and* a heavier `borderStrong` rule; player cells
          get the lighter tint and a plain hairline `border` - two
          stacked cues, since border weight alone wasn't reading as
          clearly "these are two different kinds of cell" as it should. */}
      {state.values.map((line, r) =>
        line.map((value, c) => {
          const origin = getCellOrigin(layout, r, c);
          const tx = origin.x + TILE_GAP;
          const ty = origin.y + TILE_GAP;
          const given = isGiven(puzzle, r, c);
          const face =
            value === 1
              ? given
                ? theme.colors.binairoFilledTileGiven
                : theme.colors.binairoFilledTile
              : value === 0
                ? given
                  ? theme.colors.binairoOutlineTileGiven
                  : theme.colors.binairoOutlineTile
                : theme.colors.surfaceHi;
          return (
            <Group key={`tile-${r}-${c}`}>
              {/* A shallower, fainter shadow for player tiles reinforces
                  "flatter/matte" beyond just the icon's own missing gloss -
                  a given tile sits visibly more raised off the tray. */}
              <RoundedRect
                x={tx}
                y={ty + (given ? TILE_SHADOW_DY : TILE_SHADOW_DY * 0.5)}
                width={tileSize}
                height={tileSize}
                r={TILE_RADIUS}
                color={theme.colors.binairoTileShadow}
                opacity={given ? 1 : 0.6}
              />
              <RoundedRect x={tx} y={ty} width={tileSize} height={tileSize} r={TILE_RADIUS} color={face} />
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
            </Group>
          );
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
          since the small animated layer above this one owns those for the
          ~200ms the crossfade runs. */}
      {state.values.map((line, r) =>
        line.map((value, c) => {
          const key = `${r}:${c}`;
          if (skipKeys.has(key)) return null;
          const origin = getCellOrigin(layout, r, c);
          const cx = origin.x + TILE_GAP + tileSize / 2;
          const cy = origin.y + TILE_GAP + tileSize / 2;
          return value === null ? renderEmptyRing(key, cx, cy, R, 1) : renderSymbol(key, value, cx, cy, R, 1, 1, isGiven(puzzle, r, c));
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
}

/**
 * The Skia-drawn Binairo board: individually raised tiles rather than one
 * flat surface, a glossy 3D disc vs. a glossy 3D rounded square as the
 * two fillable symbols (told apart by shape, not colour - see
 * `bubbleBaseColor`), an empty cell reading as a faint dashed ring, and
 * one consistent hazard-tape zone - always the entire offending row or
 * column, never a tight box around a handful of cells - for whichever of
 * the three rule violations is at fault.
 */
export function BinairoBoardView({ puzzle, state, size, solved, flashCell }: BinairoBoardViewProps): React.JSX.Element {
  const layout = useMemo(() => computeBoardLayout(puzzle.size, size), [puzzle.size, size]);
  const toggles = useToggleEvents(state.values);
  const solveWave = useSolveWave(solved, toggles, puzzle.size);
  const waveActive = solveWave !== null && Date.now() - solveWave.startedAt < WAVE_TOTAL_MS;
  useAnimationClock(!solved || waveActive);
  const now = Date.now();

  const tripleGroups = useMemo(() => tripleRunGroups(state), [state]);
  const unbalanced = useMemo(() => unbalancedLines(puzzle, state), [puzzle, state]);
  const duplicateGroups = useMemo(() => duplicateLineGroups(puzzle, state), [puzzle, state]);

  const errorBoxes = useMemo(() => {
    const map = new Map<string, ErrorZoneBox>();
    const cellSize = layout.cellSize;
    const isRowComplete = (r: number): boolean => state.values[r].every(v => v !== null);
    const isColComplete = (c: number): boolean => state.values.every(row => row[c] !== null);

    // Every row/column that's wrong for any reason (a triple run
    // somewhere in it, an unequal count, or duplicating another line)
    // gets exactly one full-line zone - never a tight box around just
    // the 3 or 4 offending cells, and never before that line is actually
    // *complete*. `unbalancedLines`/`duplicateLineGroups` already only
    // flag a fully-filled line; a triple run alone can exist mid-fill
    // (the player is still working through the rest of that row), so it
    // waits for the same bar here - a run doesn't wash its line the
    // instant it forms, only once every cell alongside it is placed and
    // the line is provably still broken. This keeps the hazard tape from
    // flaring up mid-cycle on a line the player hasn't finished yet.
    const washedRows = new Set<number>([...unbalanced.rows, ...duplicateGroups.rows.flat(), ...tripleGroups.filter(g => g.orientation === 'row' && isRowComplete(g.index)).map(g => g.index)]);
    const washedCols = new Set<number>([...unbalanced.cols, ...duplicateGroups.cols.flat(), ...tripleGroups.filter(g => g.orientation === 'col' && isColComplete(g.index)).map(g => g.index)]);
    for (const r of washedRows) map.set(`line:row:${r}`, { x: 0, y: r * cellSize, w: layout.boardSize, h: cellSize });
    for (const c of washedCols) map.set(`line:col:${c}`, { x: c * cellSize, y: 0, w: cellSize, h: layout.boardSize });
    return map;
  }, [tripleGroups, unbalanced, duplicateGroups, layout, state]);

  const errorLifecycles = useErrorZoneLifecycles(errorBoxes, now);

  const violatedConstraintKeys = useMemo(() => violatedConstraints(puzzle, state), [puzzle, state]);
  const constraintKeys = useMemo(() => (puzzle.constraints ?? []).map(constraintKey), [puzzle]);
  const badgeLifecycles = useConstraintBadgeLifecycles(violatedConstraintKeys, constraintKeys, now);

  const tileSize = Math.max(0, layout.cellSize - TILE_GAP * 2);
  const R = tileSize * 0.32;

  // Which cells are still within their `TOGGLE_MS` crossfade window right
  // now - typically none. `toggles` never shrinks (finished transitions
  // just age past `TOGGLE_MS` rather than being deleted), so this is a
  // cheap linear scan over at most one entry per cell on the board, not
  // proportional to anything animation-related.
  const transitioningEntries: Array<[string, ToggleEvent]> = [];
  for (const entry of toggles) {
    if (now - entry[1].startedAt < TOGGLE_MS) transitioningEntries.push(entry);
  }
  const transitioningKeys = transitioningEntries.map(([key]) => key).join(',');

  return (
    <Group>
      {renderTray(layout)}

      {/* Error zone: one consistent hazard-tape treatment for all three
          rule violations - always the entire offending row or column
          (see `errorBoxes` above), regardless of which of the three
          rules actually broke. Rendered *behind* the tile chrome
          (`StaticBinairoTiles`, below) rather than over it: a tile's own
          opaque face fully covers the tape across its own footprint, so
          the diagonal stripes only show through the gaps between and
          around tiles in the offending line - a red seam running the
          length of the row/column, not a wash painted across the tiles
          and symbols themselves. */}
      {Array.from(errorLifecycles.entries()).map(([key, { box, firstSeenAt, removedAt }]) => {
        let opacity: number;
        let scale: number;
        if (removedAt === null) {
          const elapsed = now - firstSeenAt;
          opacity = easeOutCubic(clamp01(elapsed / ERROR_ENTER_MS));
          scale = 0.95 + easeOutBack(clamp01(elapsed / ERROR_SCALE_MS)) * 0.05;
        } else {
          const t = easeInCubic(clamp01((now - removedAt) / ERROR_EXIT_MS));
          opacity = 1 - t;
          scale = 1 - t * 0.02;
        }

        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        const w = box.w * scale;
        const h = box.h * scale;
        const x = cx - w / 2;
        const y = cy - h / 2;
        const scrollPhase = (((now - firstSeenAt) % ERROR_SCROLL_PERIOD_MS) / ERROR_SCROLL_PERIOD_MS) * (ERROR_STRIPE_WIDTH * 2 * Math.SQRT2);
        const clip = rectPath(x, y, w, h);

        return (
          <Group key={key} clip={clip}>
            {hazardStripePaths(x, y, w, h, ERROR_STRIPE_WIDTH, scrollPhase).map((d, i) => (
              <Path key={i} path={d} color={theme.colors.danger} style="stroke" strokeWidth={ERROR_STRIPE_WIDTH} opacity={opacity * ERROR_STRIPE_OPACITY} />
            ))}
            <Path path={clip} color={theme.colors.danger} style="stroke" strokeWidth={1.5} opacity={opacity * ERROR_BORDER_OPACITY} />
          </Group>
        );
      })}

      <StaticBinairoTiles puzzle={puzzle} state={state} layout={layout} flashCell={flashCell} transitioningKeys={transitioningKeys} />

      {/* Toggle crossfades: only the handful of cells actually mid-toggle
          right now (almost always zero or one), re-rendered every frame
          for their own ~200ms - everything else lives in the memoized
          static layer above and doesn't pay this cost. */}
      {transitioningEntries.map(([key, event]) => {
        const [rStr, cStr] = key.split(':');
        const r = Number(rStr);
        const c = Number(cStr);
        const origin = getCellOrigin(layout, r, c);
        const cx = origin.x + TILE_GAP + tileSize / 2;
        const cy = origin.y + TILE_GAP + tileSize / 2;
        const t = clamp01((now - event.startedAt) / TOGGLE_MS);

        if (event.from !== null && event.to !== null) {
          // Real -> real: the old symbol shrinks and fades out over the
          // first half; the new one pops in - a bigger, springier
          // `easeOutPop` overshoot on scale, the same bubble-pop energy
          // as the empty -> symbol case below - over the second, a clean
          // swap rather than two shapes ever overlapping mid-way.
          const firstHalf = t < 0.5;
          const localT = firstHalf ? t / 0.5 : (t - 0.5) / 0.5;
          const eased = easeInOutQuad(localT);
          const outOpacity = firstHalf ? 1 - eased : 0;
          const outScale = firstHalf ? 1 - eased * 0.3 : 0.7;
          const inOpacity = firstHalf ? 0 : eased;
          const inScale = firstHalf ? 0.55 : 0.55 + easeOutPop(localT) * 0.45;
          // Given cells have no `Pressable` at all, so a cell mid-toggle is
          // always a player one - `given` is hardcoded `false` throughout
          // this animated layer, never looked up.
          return (
            <Group key={key}>
              {renderSymbol(`${key}-out`, event.from, cx, cy, R, outOpacity, outScale, false)}
              {renderSymbol(`${key}-in`, event.to, cx, cy, R, inOpacity, inScale, false)}
            </Group>
          );
        }

        if (event.from === null && event.to !== null) {
          // Empty -> a symbol: a real bubble pop - opacity fades in
          // smoothly, but scale grows from small and overshoots well past
          // 1 via `easeOutPop` before settling, like a bubble snapping
          // into shape rather than just smoothly growing to size - while
          // the ring fades out.
          const fadeIn = easeOutCubic(t);
          const bounce = easeOutPop(t);
          return (
            <Group key={key}>
              {renderEmptyRing(`${key}-ring`, cx, cy, R, 1 - t)}
              {renderSymbol(`${key}-in`, event.to, cx, cy, R, fadeIn, 0.3 + bounce * 0.7, false)}
            </Group>
          );
        }

        // A symbol -> empty: fade out while the ring fades in.
        const from = event.from as 1 | 0;
        const eased = easeInOutQuad(t);
        return (
          <Group key={key}>
            {renderSymbol(`${key}-out`, from, cx, cy, R, 1 - eased, 1 - eased * 0.3, false)}
            {renderEmptyRing(`${key}-ring`, cx, cy, R, t)}
          </Group>
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
        const isViolated = violatedConstraintKeys.has(key);
        const lifecycle = badgeLifecycles.get(key);
        const elapsedSinceChange = lifecycle ? now - lifecycle.changedAt : Infinity;
        const scale =
          elapsedSinceChange < CONSTRAINT_POP_MS
            ? 0.7 + easeOutBack(clamp01(elapsedSinceChange / CONSTRAINT_POP_MS)) * 0.3
            : isViolated
              ? 1 + Math.sin((now / CONSTRAINT_PULSE_PERIOD_MS) * Math.PI * 2) * CONSTRAINT_PULSE_AMPLITUDE
              : 1;
        return renderConstraintBadge(`constraint-${key}`, cx, cy, tileSize * CONSTRAINT_BADGE_RADIUS_FACTOR * scale, constraint.kind, isViolated);
      })}

      {/* Solve wave: a ring of light on every tile in turn, radiating from
          the cell that finished the puzzle - the board's own celebration,
          on top of everything else, that `BinairoScreen`'s completion
          popup deliberately waits for rather than cutting off. */}
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
            return (
              <Circle
                key={`wave-${r}-${c}`}
                cx={cx}
                cy={cy}
                r={(tileSize / 2) * (1 + t * 0.3)}
                color={theme.colors.accent}
                style="stroke"
                strokeWidth={3}
                opacity={(1 - t) * 0.85}
              />
            );
          }),
        )}
    </Group>
  );
}
