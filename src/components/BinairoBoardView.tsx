import React, { useMemo, useRef } from 'react';
import { Circle, DashPathEffect, Group, LinearGradient, Path, RoundedRect, vec } from '@shopify/react-native-skia';
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

/** How long a placed (or cleared) symbol takes to settle - see the
 * toggle-flip block in `BinairoBoardView` for what actually animates over
 * this window. A real flip needs enough time to actually read as turning
 * (not just a flicker), but still quick enough that cycling through
 * several cells in a row feels snappy, not delayed. */
const TOGGLE_MS = 220;
/** A card flip via horizontal `scaleX`, not a real `rotateY`+`perspective`
 * 3D transform - a true perspective projection needs proper z-clipping to
 * stay smooth right around the 90deg edge-on point, which this Skia
 * version's `Group` transform doesn't do, so it visibly stuttered/warped
 * there instead of reading as a clean turn. `scaleX` faking the same
 * silhouette (squish flat, swap face, unsquish) is the standard technique
 * 2D card-flip UIs use for exactly this reason, and stays perfectly smooth
 * since it's just a linear scale, no projection math to go wrong. The
 * width itself is driven by `cos` of a linearly-advancing turn angle
 * (`flipScaleX` below), not a hand-picked easing curve - that's the exact
 * silhouette a flat object held at that angle actually projects to, so it
 * decelerates approaching full width and accelerates through the middle
 * the same way a real turning card would, without needing a real 3D
 * transform to get there. A real->real swap is two quarter-flips back to
 * back: the old symbol squishes from full width to nothing, then the new
 * one unsquishes from nothing back to full width - only one face is ever
 * showing, like an actual flipped card. Placing into an empty cell or
 * clearing one only has a single face to animate, so those get one
 * quarter-flip each. */
const FLIP_MIN_SCALE = 0.001;
function flipScaleX(turnFraction: number): number {
  return Math.max(FLIP_MIN_SCALE, Math.abs(Math.cos(turnFraction * (Math.PI / 2))));
}
/** The empty-ring's own fade is timed independently of the flip's own
 * duration, not tied 1:1 to the same `t` the shape's scale uses - the
 * ring reaching zero opacity in lockstep with the shape reaching full
 * width would leave a visibly stale, ghostly ring hanging over an
 * already-formed symbol, since a `scaleX` shape reads as "basically
 * there" well before it's actually at 100% width. Fading the ring out (or
 * in) over a much shorter window at the very start (or end) of the
 * transition clears it before the shape becomes visually prominent. */
const FLIP_RING_FADE_FRACTION = 0.4;

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
/** A violation has to hold steady for this long before it's allowed to
 * start entering (see `useDelayedKeys` below) - it used to flag the
 * instant a line went bad, which read as too quick/twitchy while still
 * mid-move. Clearing is never delayed: fixing a line drops its tape/badge
 * immediately, only the *onset* waits. */
const ERROR_DELAY_MS = 450;
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
 * Both fillable symbols are clean "tokens" - a disc ("1") and rounded
 * square ("0") - coloured with the exact same hue family their own tile
 * face already uses (see `bubbleBaseColor`) so a token and the tile it
 * sits in are always one coordinated colour. A given cell's token and a
 * player's own entry share the exact same colour and shading now - only
 * the tile chrome beneath them (a heavier border, a deeper shadow) still
 * tells the two apart, not the symbol itself. Real depth from just two
 * moves: a wide-contrast diagonal gradient (corner-lit, not a flat tint)
 * plus a solid, hard-edged "step" underneath offset a few pixels down -
 * a duplicate of the same shape in a darker shade, peeking out as a
 * crescent along the bottom edge, the same un-blurred offset-shadow trick
 * modern flat-with-depth UI (Duolingo's own buttons, for one) uses to
 * make a flat shape read as a raised physical piece. Not a third attempt
 * at the earlier four-layer glass-marble treatment (a vignette, a broad
 * ambient highlight, a tight specular hot-spot, a separate occlusion
 * glow) - that read as glossy "bubblewrap" - and not last round's single
 * gentle linear gradient either, which lost the marble's depth without
 * replacing it with anything and read as flat/bland. Proven out in an
 * actual rendered HTML/CSS comparison of the gradient-contrast-plus-step-
 * shadow combination against a higher-contrast radial sphere, a crisp
 * two-tone bevel, and a classic glossy button band before porting the
 * winner here: real contrast plus a hard step shadow gave the strongest
 * "raised piece" read without tipping back into looking spherical/glossy.
 */
const TILE_GRADIENT_MID_STOP = 0.46;
const BUBBLE_RIM_COLOR = 'rgba(42, 37, 31, 0.4)';
const BUBBLE_RIM_STROKE_FACTOR = 0.045;
/** The step shadow's own offset, as a fraction of the shape's own radius
 * (a circle) or half-width (a square) - how far the darker duplicate
 * shape sits below the visible one, which is exactly how much of it
 * peeks out as the bottom crescent. Kept small and semi-transparent (see
 * `TILE_STEP_OPACITY`) rather than a large fully-opaque duplicate - at
 * full strength it read as a stray hard-edged patch of a different colour
 * stuck to the tile rather than an actual shadow. */
const TILE_STEP_OFFSET_FACTOR = 0.065;
const TILE_STEP_OPACITY = 0.6;

/** The gradient's own light/dark ends and the step shadow's own solid
 * colour, per symbol - hand-tuned against the actual tile colour, not
 * computed by a generic lighten/darken formula (a uniform blend-toward-
 * white-or-black desaturates unevenly across these two different hues;
 * picking each pair by eye against a real rendered swatch reads better
 * than a formula that isn't hue-aware). Keyed by `value` (1 = filled/
 * circle, 0 = outline/square). */
const TILE_GRADIENT: Record<'filled' | 'outline', { light: string; dark: string; step: string }> = {
  filled: { light: '#FBE2A0', dark: '#B67F12', step: '#8C6110' },
  outline: { light: '#9AB2DE', dark: '#253A67', step: '#1B2745' },
};

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
/** The tile-matching flat colour a bubble is built on top of - the same
 * token its own tile face already fills with, so bubble and tile are one
 * coordinated colour by construction rather than two independently-tuned
 * ones that could drift apart later. */
function bubbleBaseColor(value: 1 | 0): string {
  return value === 1 ? theme.colors.binairoFilledTile : theme.colors.binairoOutlineTile;
}

/**
 * A clean satin token: a single top-to-bottom linear gradient (light at
 * the top, the tile-matching hue at the middle, darker at the bottom) for
 * quiet, believable dimension, plus a thin ink rim so the token stays
 * legible even where its own hue nearly matches its tile. `topY`/`bottomY`
 * are the shape's own top/bottom edge in canvas space - a circle's
 * `cy - r`/`cy + r`, a square's `y`/`y + side` - so the gradient always
 * runs edge-to-edge on the shape it's painting, whatever that shape is.
 */
function renderTileFace(shape: (children: React.ReactNode) => React.JSX.Element, start: ReturnType<typeof vec>, end: ReturnType<typeof vec>, value: 1 | 0): React.JSX.Element {
  const grad = TILE_GRADIENT[value === 1 ? 'filled' : 'outline'];
  return shape(<LinearGradient start={start} end={end} colors={[grad.light, bubbleBaseColor(value), grad.dark]} positions={[0, TILE_GRADIENT_MID_STOP, 1]} />);
}

function renderCircleBubble(key: string, cx: number, cy: number, r: number): React.JSX.Element {
  const step = TILE_GRADIENT.filled.step;
  const layer = (gradient: React.ReactNode): React.JSX.Element => (
    <Circle cx={cx} cy={cy} r={r}>
      {gradient}
    </Circle>
  );
  return (
    <Group key={key}>
      {/* The step shadow: a full duplicate circle offset down, visible
          only as the crescent that peeks out past the main circle's own
          bottom edge - see `TILE_STEP_OFFSET_FACTOR`. */}
      <Circle cx={cx} cy={cy + r * TILE_STEP_OFFSET_FACTOR} r={r} color={step} opacity={TILE_STEP_OPACITY} />
      {renderTileFace(layer, vec(cx - r * 0.5, cy - r), vec(cx + r * 0.5, cy + r), 1)}
      <Circle cx={cx} cy={cy} r={r} color={BUBBLE_RIM_COLOR} style="stroke" strokeWidth={Math.max(1, r * BUBBLE_RIM_STROKE_FACTOR)} />
    </Group>
  );
}

/** The circle's counterpart: the exact same treatment applied to a
 * rounded square instead - a genuinely different silhouette, so the two
 * fillable states are still told apart by shape alone. */
function renderSquareBubble(key: string, cx: number, cy: number, R: number): React.JSX.Element {
  const half = R * SQUARE_HALF_FACTOR;
  const x = cx - half;
  const y = cy - half;
  const side = half * 2;
  const cr = half * SQUARE_CORNER_FACTOR;
  const step = TILE_GRADIENT.outline.step;
  const layer = (gradient: React.ReactNode): React.JSX.Element => (
    <RoundedRect x={x} y={y} width={side} height={side} r={cr}>
      {gradient}
    </RoundedRect>
  );
  return (
    <Group key={key}>
      <RoundedRect x={x} y={y + half * TILE_STEP_OFFSET_FACTOR} width={side} height={side} r={cr} color={step} opacity={TILE_STEP_OPACITY} />
      {renderTileFace(layer, vec(x, y), vec(x + side, y + side), 0)}
      <RoundedRect x={x} y={y} width={side} height={side} r={cr} color={BUBBLE_RIM_COLOR} style="stroke" strokeWidth={Math.max(1, half * BUBBLE_RIM_STROKE_FACTOR)} />
    </Group>
  );
}

function renderSymbol(key: string, value: 1 | 0, cx: number, cy: number, R: number): React.JSX.Element {
  return value === 1 ? renderCircleBubble(key, cx, cy, R) : renderSquareBubble(key, cx, cy, R);
}

/** The resting state's own icon: a faint dashed ring, distinct in kind
 * (not just colour) from both fillable symbols. */
function renderEmptyRing(key: string, cx: number, cy: number, R: number): React.JSX.Element {
  return (
    <Group key={key}>
      {/* A faint recessed disc behind the dashed ring - a shallow "socket"
          waiting for a bubble, rather than a plain outline floating flat
          on the tile. Deliberately subtle: this cell is about to be the
          least visually interesting thing on the board once filled, so
          it only needs a hint of depth, not its own competing detail. */}
      <Circle cx={cx} cy={cy} r={R * 0.86} color="rgba(42, 37, 31, 0.05)" />
      <Circle cx={cx} cy={cy} r={R} color={theme.colors.textTertiary} style="stroke" strokeWidth={1.5}>
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

/** The tile's own background tint for a given cell value - shared between
 * the static per-cell chrome and the animated overlay that takes over a
 * cell's chrome for the duration of its toggle (see `renderTileChrome`),
 * so both always agree on what colour a given value paints. */
function tileFaceColor(value: BinairoValue): string {
  return value === 1 ? theme.colors.binairoFilledTile : value === 0 ? theme.colors.binairoOutlineTile : theme.colors.surfaceHi;
}

/** One tile's full chrome - offset shadow, tinted face, border - the same
 * three shapes whether drawn by the static layer (the common case) or, for
 * a cell mid-toggle, by the animated overlay instead (see the toggle-flip
 * block in `BinairoBoardView`). Keeping this in one place is what makes a
 * mid-flip tile's background swap to its new colour in lockstep with the
 * flip's own crossover point, rather than jumping to its final colour the
 * instant the tap lands while the old symbol is still visibly turning on
 * top of it - the static layer used to always paint the *current* state's
 * colour regardless of what the animation on top of it was showing, which
 * read as the tile's colour changing before its own symbol did. */
function renderTileChrome(tx: number, ty: number, tileSize: number, given: boolean, face: string): React.JSX.Element {
  return (
    <>
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
const StaticBinairoTiles = React.memo(function StaticBinairoTilesImpl({ puzzle, state, layout, flashCell, transitioningKeys }: StaticBinairoTilesProps) {
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
          with a coloured icon on them - the *same* tint for a given cell
          and a player's own entry (see `bubbleBaseColor`); a given cell
          is told apart by a heavier `borderStrong` rule and a deeper
          shadow instead, not by a different colour. */}
      {state.values.map((line, r) =>
        line.map((value, c) => {
          // A transitioning cell's whole chrome - not just its symbol - is
          // owned by the animated overlay instead, for exactly as long as
          // that overlay needs to keep showing the *old* colour while the
          // old symbol is still visibly turning (see `renderTileChrome`).
          if (skipKeys.has(`${r}:${c}`)) return null;
          const origin = getCellOrigin(layout, r, c);
          const tx = origin.x + TILE_GAP;
          const ty = origin.y + TILE_GAP;
          const given = isGiven(puzzle, r, c);
          return <Group key={`tile-${r}-${c}`}>{renderTileChrome(tx, ty, tileSize, given, tileFaceColor(value))}</Group>;
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
          const cx = origin.x + TILE_GAP + tileSize / 2;
          const cy = origin.y + TILE_GAP + tileSize / 2;
          return value === null ? renderEmptyRing(key, cx, cy, R) : renderSymbol(key, value, cx, cy, R);
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
  const tileSize = Math.max(0, layout.cellSize - TILE_GAP * 2);
  const R = tileSize * 0.32;

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

      {/* Toggle placement: a card flip via `scaleX` - see `flipScaleX` for
          why this fakes the turn instead of using a real `rotateY`
          projection. Scaling via each `Group`'s own `transform`/`origin`
          rather than the bubble's own size keeps every gradient
          underneath at the fixed centre/radius it was already drawn
          with - only the already-composited pixels squish - which is why
          this stays cheap per frame despite looking like real motion
          (the old size-driven pop animation measurably janked:
          `dumpsys gfxinfo` showed over half the frames missing their
          deadline while toggling). */}
      {transitioningEntries.map(([key, event]) => {
        const [rStr, cStr] = key.split(':');
        const r = Number(rStr);
        const c = Number(cStr);
        const origin = getCellOrigin(layout, r, c);
        const tx = origin.x + TILE_GAP;
        const ty = origin.y + TILE_GAP;
        const cx = tx + tileSize / 2;
        const cy = ty + tileSize / 2;
        const centre = vec(cx, cy);
        const t = clamp01((now - event.startedAt) / TOGGLE_MS);
        const given = isGiven(puzzle, r, c);
        const chrome = (face: BinairoValue): React.JSX.Element => <Group>{renderTileChrome(tx, ty, tileSize, given, tileFaceColor(face))}</Group>;

        if (event.from !== null && event.to !== null) {
          // A real->real swap: two quarter-flips back to back, like an
          // actual card flipping - the old face squishes away to nothing
          // (never both faces on screen at once), then the new one
          // unsquishes the rest of the way to full width. The tile's own
          // background swaps at the exact same crossover point as the
          // symbol does, not a moment before it.
          const firstHalf = t < 0.5;
          if (firstHalf) {
            const scaleX = flipScaleX(t / 0.5);
            return (
              <Group key={key}>
                {chrome(event.from)}
                <Group transform={[{ scaleX }]} origin={centre}>
                  {renderSymbol(`${key}-out`, event.from, cx, cy, R)}
                </Group>
              </Group>
            );
          }
          const scaleX = flipScaleX(1 - (t - 0.5) / 0.5);
          return (
            <Group key={key}>
              {chrome(event.to)}
              <Group transform={[{ scaleX }]} origin={centre}>
                {renderSymbol(`${key}-in`, event.to, cx, cy, R)}
              </Group>
            </Group>
          );
        }

        if (event.from === null && event.to !== null) {
          // Empty -> a symbol: one quarter-flip unsquishing into view -
          // there's no first face to squish away, just the ring fading
          // out (on its own, faster schedule - see `FLIP_RING_FADE_FRACTION`)
          // as the new symbol turns into view. The background swaps to
          // the new colour on that same faster schedule, once the ring
          // has mostly cleared, rather than the instant the tap lands.
          const scaleX = flipScaleX(1 - t);
          const ringT = clamp01(t / FLIP_RING_FADE_FRACTION);
          const ringOpacity = 1 - easeOutCubic(ringT);
          return (
            <Group key={key}>
              {chrome(ringT < 1 ? null : event.to)}
              <Group opacity={ringOpacity}>{renderEmptyRing(`${key}-ring`, cx, cy, R)}</Group>
              <Group transform={[{ scaleX }]} origin={centre}>
                {renderSymbol(`${key}-in`, event.to, cx, cy, R)}
              </Group>
            </Group>
          );
        }

        // A symbol -> empty: the mirror image - one quarter-flip
        // squishing away while the ring fades in behind it, again on its
        // own faster schedule rather than growing in lockstep with the
        // squish - and the background only turns back to blank once that
        // fade-in schedule actually starts, not before.
        const from = event.from as 1 | 0;
        const scaleX = flipScaleX(t);
        const ringT = clamp01((t - (1 - FLIP_RING_FADE_FRACTION)) / FLIP_RING_FADE_FRACTION);
        const eased = easeInCubic(ringT);
        return (
          <Group key={key}>
            {chrome(ringT > 0 ? null : from)}
            <Group transform={[{ scaleX }]} origin={centre}>
              {renderSymbol(`${key}-out`, from, cx, cy, R)}
            </Group>
            <Group opacity={eased}>{renderEmptyRing(`${key}-ring`, cx, cy, R)}</Group>
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
        const isViolated = readyViolatedKeys.has(key);
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
    </Group>
  );
}
