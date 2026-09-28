import React, { useMemo, useRef } from 'react';
import { Circle, Group, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import {
  isRowSatisfied,
  isColSatisfied,
  isTreeCell,
  TentsTreesCell,
  TentsTreesPuzzle,
  TentsTreesState,
  touchingTentCells,
} from '../game/tents';
import { IDLE_MOTION_FPS, useAnimationClock, useReducedMotion } from '../game/rendering';
import { theme } from '../theme';
import { CellWell, PaperTray } from './boardChrome';

/** Ground shadow: shared by both objects (`tentsShadow`'s own rationale -
 * "one visual concept in this palette, not several"), sized off a fixed
 * reference rather than either object's own, very different footprint. */
const SHADOW_BASE = 0.16;
const SHADOW_WIDTH_RATIO = 1.8;
const SHADOW_HEIGHT_RATIO = 0.35;

/** Tree canopy: one rounded, lumpy blob rather than three overlapping flat
 * circles - the original three-circle silhouette had no shading and no
 * separation between the lobes, so at a board icon's actual size it just
 * read as one solid black smudge, not a tree. A single softly-scalloped
 * path reads as foliage at a glance and is cheaper to draw besides.
 * Flat fill plus a soft offset shadow underneath (the same technique
 * `BinairoBoardView.tsx`'s own marks use), not a gradient bevel - this
 * board's other tokens (the tent, the ground shadow) are all flat too,
 * and a lone glossy-bevel canopy was the one spot in this app that still
 * looked like a moulded game token rather than a printed piece. Shape (a
 * round puff vs. the tent's sharp A-frame) is what tells a tree and a
 * tent apart at a glance, exactly as elsewhere in this app - the canopy's
 * own green is just a second, redundant cue on top of that. */
export const CANOPY_COLOR = '#425237';
export const CANOPY_OUTLINE = 'rgba(24, 30, 18, 0.5)';
const CANOPY_SHADOW_OFFSET_FACTOR = 0.05;
const CANOPY_SHADOW_ALPHA = 0.22;
export const TRUNK_COLOR = '#5A4632';

const TRUNK_BASE = 0.16;
const TRUNK_TOP_RATIO = 0.6;
export const TRUNK_HEIGHT = 0.22;

const TENT_HEIGHT = 0.3;
const TENT_HALF_BASE = 0.44;
const NOTCH_WIDTH = 0.1;
const NOTCH_HEIGHT_RATIO = 0.35; // of the tent's own height
/** The tent's two canvas faces, lit from the same upper-right direction
 * the tree's own canopy highlight comes from - a flat single-colour A-frame
 * read as a cardboard cutout with no volume; splitting it at the ridge
 * into a lighter (sun-facing) and darker (shadowed) triangle, plus a small
 * cream entrance flap where the two faces meet at the base, is enough to
 * read as a real three-dimensional tent without needing a full gradient.
 * `TENT_LIGHT`/`TENT_DARK` are a different, more muted green family than
 * the canopy's own - two adjacent objects sharing one exact green would
 * blur back together at a glance. */
export const TENT_LIGHT = '#557A5D';
export const TENT_DARK = '#345140';
export const TENT_DOOR_COLOR = theme.colors.background;

/** The "definitely not a tent" pencil mark - a small quiet cross, faint
 * enough to read as bookkeeping (it never affects solving) rather than a
 * third token competing with the tree/tent pair. Deliberately not the
 * `danger` red every violation on this board's own tents already uses -
 * ruling a cell out isn't a mistake, so it shouldn't borrow that
 * vocabulary. `textTertiary` is this app's own "quiet ink" outside any
 * board's functional colours. */
export const MARK_COLOR = theme.colors.textTertiary;
const MARK_RADIUS_FACTOR = 0.16;
const MARK_STROKE_FACTOR = 0.045;

/** A tent doesn't fade in, it pitches: it springs up a touch tall and
 * settles to its resting height in one quick, decelerating motion - the
 * same "struck a beat heavier, then settled" shape Binairo's own stamp
 * uses (`BinairoBoardView.tsx`'s `STAMP_IN_MS`), reused verbatim rather
 * than re-tuned so placing something feels the same weight across every
 * board in this app, even though the metaphor differs (a stamp striking
 * paper vs. a tent's canvas snapping taut). The pencil mark gets the same
 * treatment, just smaller and quieter, matching its own visual weight. */
const PITCH_IN_MS = 150;
const PITCH_OVERSHOOT_SCALE = 1.3;
const MARK_FADE_IN_MS = 120;
/** The longest placement animation - how long a fresh mark needs full-rate frames. */
const PLACE_ANIMATION_MS = Math.max(PITCH_IN_MS, MARK_FADE_IN_MS);

/** `0,-3,3,-2,2,0` over 220ms, linear per 44ms segment - Skyscrapers'
 * exact conflict shake, reused for a touching-tents violation. Skia has no
 * `Animated.Value` to drive this the way `TowersBoard` does, so it's a
 * plain function of elapsed time instead, sampled every animation-clock
 * tick. */
const SHAKE_KEYFRAMES = [0, -3, 3, -2, 2, 0];
const SHAKE_SEGMENT_MS = 220 / (SHAKE_KEYFRAMES.length - 1);
function shakeOffsetAt(elapsedMs: number): number {
  if (elapsedMs >= 220 || elapsedMs < 0) return 0;
  const segment = Math.min(SHAKE_KEYFRAMES.length - 2, Math.floor(elapsedMs / SHAKE_SEGMENT_MS));
  const t = (elapsedMs - segment * SHAKE_SEGMENT_MS) / SHAKE_SEGMENT_MS;
  return SHAKE_KEYFRAMES[segment] + (SHAKE_KEYFRAMES[segment + 1] - SHAKE_KEYFRAMES[segment]) * t;
}

const GLOW_CROSSFADE_MS = 140;
const SPARK_MS = 520;
const SPARK_STAGGER_MS = 60;
const FLARE_MS = 320;
/** Staggered by *cell* index, not by tent, so on a big board the last
 * cell's delay is `rows * cols` steps out - at the old 40ms that was two
 * and a half seconds for an 8x8, far past the beat the completion card
 * waits (`SOLVE_CELEBRATION_MS`). */
const FLARE_STAGGER_MS = 4;

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}
function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

export function trunkPath(cx: number, topY: number, cellSize: number): string {
  const base = cellSize * TRUNK_BASE;
  const top = base * TRUNK_TOP_RATIO;
  const bottomY = topY + cellSize * TRUNK_HEIGHT;
  return `M ${cx - top / 2} ${topY} L ${cx + top / 2} ${topY} L ${cx + base / 2} ${bottomY} L ${cx - base / 2} ${bottomY} Z`;
}

/** The canopy's own lumpy silhouette - one continuous scalloped path, not
 * stacked circles - hand-tuned as a set of cubic Beziers against a
 * `cellSize`-square reference box (this exact curve is the one that read
 * best in the SVG comparison mentioned above). `cx`/`topRefY` anchor
 * roughly where the blob's own centre falls, not its top-left corner. */
export function canopyPath(cx: number, topRefY: number, cellSize: number): string {
  const ox = cx - cellSize * 0.5;
  const oy = topRefY - cellSize * 0.4;
  const p = (px: number, py: number): string => `${ox + (px / 100) * cellSize} ${oy + (py / 100) * cellSize}`;
  return [
    `M ${p(22, 46)}`,
    `C ${p(20, 30)}, ${p(36, 18)}, ${p(50, 22)}`,
    `C ${p(58, 12)}, ${p(76, 16)}, ${p(78, 30)}`,
    `C ${p(92, 32)}, ${p(92, 52)}, ${p(78, 54)}`,
    `C ${p(76, 66)}, ${p(56, 68)}, ${p(50, 58)}`,
    `C ${p(34, 66)}, ${p(18, 58)}, ${p(22, 46)}`,
    'Z',
  ].join(' ');
}

/** True A-frame with an inverted-V entrance notch cut into the base, not
 * "the tree without a trunk" - a different silhouette family entirely.
 * Computed once as a handful of points and shared by the left/right face
 * paths and the door path below, so all three always agree on exactly
 * where the notch sits. */
export interface TentGeometry {
  apex: { x: number; y: number };
  leftBase: { x: number; y: number };
  rightBase: { x: number; y: number };
  leftNotch: { x: number; y: number };
  rightNotch: { x: number; y: number };
  notchTop: { x: number; y: number };
}
export function tentGeometry(cx: number, baseY: number, cellSize: number): TentGeometry {
  const height = cellSize * TENT_HEIGHT;
  const halfBase = cellSize * TENT_HALF_BASE;
  const notchWidth = cellSize * NOTCH_WIDTH;
  const notchTopY = baseY - height * NOTCH_HEIGHT_RATIO;
  return {
    apex: { x: cx, y: baseY - height },
    leftBase: { x: cx - halfBase, y: baseY },
    rightBase: { x: cx + halfBase, y: baseY },
    leftNotch: { x: cx - notchWidth / 2, y: baseY },
    rightNotch: { x: cx + notchWidth / 2, y: baseY },
    notchTop: { x: cx, y: notchTopY },
  };
}
/** The shadowed, left-facing side of the A-frame - lit from the upper
 * right, the same direction the canopy's own highlight comes from. */
export function tentLeftFacePath(g: TentGeometry): string {
  return `M ${g.apex.x} ${g.apex.y} L ${g.leftBase.x} ${g.leftBase.y} L ${g.leftNotch.x} ${g.leftNotch.y} L ${g.notchTop.x} ${g.notchTop.y} Z`;
}
/** The sun-facing, right side - lighter than its left-hand counterpart. */
export function tentRightFacePath(g: TentGeometry): string {
  return `M ${g.apex.x} ${g.apex.y} L ${g.notchTop.x} ${g.notchTop.y} L ${g.rightNotch.x} ${g.rightNotch.y} L ${g.rightBase.x} ${g.rightBase.y} Z`;
}
/** A small cream flap right where the two faces meet at the base - the
 * tent's own entrance, not just a notch cut out of the silhouette. */
export function tentDoorPath(g: TentGeometry): string {
  return `M ${g.leftNotch.x} ${g.leftNotch.y} L ${g.notchTop.x} ${g.notchTop.y} L ${g.rightNotch.x} ${g.rightNotch.y} Z`;
}

/** Diffs a boolean-per-key map against the previous render, returning the
 * timestamp of the most recent false->true transition for each key that
 * has ever fired - the same during-render-diff idiom used throughout this
 * app's Skia boards (`useGemBursts` on Mirror Maze, the toggle/error
 * trackers on Binairo), generalised once here since Tents and Trees needs
 * three independent instances of it (violations, line-satisfied, solve). */
function useTransitionTimestamps(current: ReadonlySet<string>, now: number): Map<string, number> {
  const prevRef = useRef<ReadonlySet<string>>(new Set());
  const eventsRef = useRef(new Map<string, number>());
  for (const key of current) {
    if (!prevRef.current.has(key)) eventsRef.current.set(key, now);
  }
  prevRef.current = current;
  return eventsRef.current;
}

/** Tracks when a strictly-binary per-key value last flipped, so a caller
 * can crossfade from the opposite extreme toward whichever state is
 * current - used for the lantern glow's on/off transition rather than
 * letting it snap instantly (which would read as a glitch, not a cue). */
function useBooleanTransitions(current: ReadonlyMap<string, boolean>, now: number): Map<string, { value: boolean; changedAt: number }> {
  const stateRef = useRef(new Map<string, { value: boolean; changedAt: number }>());
  for (const [key, value] of current) {
    const existing = stateRef.current.get(key);
    if (!existing || existing.value !== value) stateRef.current.set(key, { value, changedAt: now });
  }
  return stateRef.current;
}

/** Diffs `marks` against the previous render to find cells that just
 * changed and when - the same during-render-diff idiom `useToggleEvents`
 * uses on Binairo's own board, needed here so a freshly-pitched tent (or
 * a freshly-drawn pencil mark) knows how long it's been standing, to
 * animate its own entrance (see `PITCH_IN_MS`/`MARK_FADE_IN_MS`) rather
 * than snapping into place the instant the tap lands. */
function useMarkChangeTimestamps(marks: TentsTreesState['marks']): Map<string, number> {
  const prevRef = useRef<TentsTreesState['marks'] | null>(null);
  const eventsRef = useRef(new Map<string, number>());
  if (prevRef.current !== marks) {
    const prev = prevRef.current;
    const now = Date.now();
    for (let r = 0; r < marks.length; r += 1) {
      for (let c = 0; c < marks[r].length; c += 1) {
        const from = prev ? prev[r][c] : marks[r][c];
        const to = marks[r][c];
        if (from !== to) eventsRef.current.set(cellKey(r, c), now);
      }
    }
    prevRef.current = marks;
  }
  return eventsRef.current;
}

/**
 * The board's fixed chrome - floor, accent border, hairline grid, hint
 * flash. Depends only on `puzzle`/`cellSize`/`flashCell`, never on the
 * animation clock, so it is memoized away from the continuous idle
 * clock the rest of this board runs (firefly/lantern-glow ambience) - the
 * same reasoning as `BinairoBoardView`'s own `StaticBinairoTiles` split,
 * applied here because this file had none of it: every tick was
 * rebuilding this fixed-cost, board-size-scaling geometry regardless of
 * `rows*cols`, which is exactly what made a large Tents board feel
 * laggy even while nobody was touching it.
 */
const StaticTentsChrome = React.memo(function StaticTentsChromeImpl({
  puzzle,
  cellSize,
  flashCell,
}: {
  puzzle: TentsTreesPuzzle;
  cellSize: number;
  flashCell?: TentsTreesCell | null;
}) {
  const boardW = puzzle.cols * cellSize;
  const boardH = puzzle.rows * cellSize;
  // Framed wells rather than a ruled grid: the board is mostly empty
  // cells, and a hairline grid on flat paper read as a blank form next to
  // every other board's inset wells. The inset is kept tight so a tree's
  // canopy still fills its cell.
  const inset = Math.max(2, cellSize * 0.06);
  const well = cellSize - inset * 2;
  const wellR = well * 0.22;
  return (
    <Group>
      <PaperTray width={boardW} height={boardH} accent={theme.colors.tentsAccent} />
      {Array.from({ length: puzzle.rows }, (_v, r) =>
        Array.from({ length: puzzle.cols }, (_v2, c) => (
          <CellWell key={`w-${r}-${c}`} x={c * cellSize + inset} y={r * cellSize + inset} size={well} r={wellR} />
        )),
      )}
      {flashCell && (
        <RoundedRect
          x={flashCell.col * cellSize + inset}
          y={flashCell.row * cellSize + inset}
          width={well}
          height={well}
          r={wellR}
          color={theme.colors.accent}
          opacity={0.4}
        />
      )}
    </Group>
  );
});

/**
 * Every tree's canopy/trunk/shadow, without its firefly - a tree's
 * geometry depends only on `puzzle` (where the trees *are*, fixed the
 * instant the puzzle is generated), never on `state` and never on the
 * clock, so this is the cheapest possible memo boundary: it re-renders
 * only if a genuinely different puzzle mounts. The firefly is drawn by a
 * separate, unmemoized, deliberately tiny loop in `TentsBoardView` itself
 * - the one piece of a tree that actually needs `now` - so the expensive
 * part (hand-tuned Bezier canopy paths, on every tree, every tick) stops
 * being recomputed for a light nobody is even looking at 7/8ths of the
 * time.
 */
const StaticTentsTrees = React.memo(function StaticTentsTreesImpl({ puzzle, cellSize }: { puzzle: TentsTreesPuzzle; cellSize: number }) {
  const shadowW = cellSize * SHADOW_BASE * SHADOW_WIDTH_RATIO;
  const shadowH = cellSize * SHADOW_BASE * SHADOW_HEIGHT_RATIO;
  return (
    <Group>
      {Array.from({ length: puzzle.rows }, (_v, r) => r).map(r =>
        Array.from({ length: puzzle.cols }, (_v2, c) => c).map(c => {
          if (!isTreeCell(puzzle, r, c)) return null;
          const cx = c * cellSize + cellSize / 2;
          const cy = r * cellSize + cellSize / 2;
          const canopyY = cy - cellSize * 0.1;
          const trunkTopY = canopyY + cellSize * 0.12;
          const trunkBottomY = trunkTopY + cellSize * TRUNK_HEIGHT;
          return (
            <Group key={cellKey(r, c)}>
              <Path path={ellipsePath(cx, trunkBottomY + shadowH * 0.3, shadowW / 2, shadowH / 2)} color={theme.colors.tentsShadow} />
              <Path
                path={canopyPath(cx + cellSize * CANOPY_SHADOW_OFFSET_FACTOR, canopyY + cellSize * CANOPY_SHADOW_OFFSET_FACTOR, cellSize)}
                color={`rgba(59,31,82,${CANOPY_SHADOW_ALPHA})`}
              />
              <Path path={canopyPath(cx, canopyY, cellSize)} color={CANOPY_COLOR} />
              <Path path={canopyPath(cx, canopyY, cellSize)} color={CANOPY_OUTLINE} style="stroke" strokeWidth={Math.max(1, cellSize * 0.012)} />
              <Path path={trunkPath(cx, trunkTopY, cellSize)} color={TRUNK_COLOR} />
            </Group>
          );
        }),
      )}
    </Group>
  );
});

export interface TentsBoardViewProps {
  puzzle: TentsTreesPuzzle;
  state: TentsTreesState;
  /** Pixel size of one square cell - the grid is `puzzle.cols * cellSize`
   * wide and `puzzle.rows * cellSize` tall; the clue gutters live outside
   * this canvas, in plain RN text. */
  cellSize: number;
  solved: boolean;
  flashCell?: TentsTreesCell | null;
}

/**
 * A campsite at dusk, not a rule-checker: every correctly-spaced tent
 * carries its own small, gently breathing lantern glow rather than a flat
 * colour halo: the reward for getting it right is warmth, and the
 * punishment for touching another tent is that warmth visibly going out
 * (plus the existing shake). A newly-satisfied row/column sends a few
 * sparks up from its tents; trees get a rare, subtle firefly near the
 * canopy for ambient life; solving lights every lantern in a short
 * sequential wave before the usual card appears.
 */
export function TentsBoardView({ puzzle, state, cellSize, solved, flashCell }: TentsBoardViewProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const now = Date.now();

  const touching = useMemo(() => touchingTentCells(puzzle, state), [puzzle, state]);
  const shakeStarts = useTransitionTimestamps(touching, now);

  const glowValidity = useMemo(() => {
    const map = new Map<string, boolean>();
    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        if (state.marks[r][c] === 'tent') map.set(cellKey(r, c), !touching.has(cellKey(r, c)));
      }
    }
    return map;
  }, [puzzle, state, touching]);
  const glowTransitions = useBooleanTransitions(glowValidity, now);

  const satisfiedLines = useMemo(() => {
    const set = new Set<string>();
    for (let r = 0; r < puzzle.rows; r += 1) if (isRowSatisfied(puzzle, state, r)) set.add(`row:${r}`);
    for (let c = 0; c < puzzle.cols; c += 1) if (isColSatisfied(puzzle, state, c)) set.add(`col:${c}`);
    return set;
  }, [puzzle, state]);
  const lineSatisfiedAt = useTransitionTimestamps(satisfiedLines, now);

  const solvedSet = useMemo(() => (solved ? new Set(['solved']) : new Set<string>()), [solved]);
  const solvedAtMap = useTransitionTimestamps(solvedSet, now);
  const solvedAt = solvedAtMap.get('solved');

  /**
   * The clock, declared *after* `solvedAt` because it depends on it.
   *
   * This used to read `useAnimationClock(!solved && ...)`, which switched
   * the clock off at the exact moment the board was solved - so the
   * lantern wave below, which needs a frame per step to advance, never
   * got a single one after the first. The animation existed, was
   * correct, and was invisible in every game ever finished. Same
   * chicken-and-egg shape as the Binairo error-timing bug: the "is
   * anything animating" test has to already know about the thing it is
   * meant to drive.
   *
   * Two rates on purpose: idle decoration (a firefly, a breathing glow)
   * is throttled, and the solve wave gets real frames for the short
   * moment it runs.
   */
  const flareWindowMs = puzzle.rows * puzzle.cols * FLARE_STAGGER_MS + FLARE_MS;
  const flaring = solvedAt !== undefined && now - solvedAt < flareWindowMs;

  // Stable per-tree seed for the firefly's duty cycle, so trees don't blink
  // in lockstep - derived from the cell position, not randomised per
  // render (a given puzzle always looks the same).
  const fireflySeed = (row: number, col: number): number => ((row * 928371 + col * 152267) % 10000) / 10000;

  const allTentCells: TentsTreesCell[] = useMemo(() => {
    const cells: TentsTreesCell[] = [];
    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        if (state.marks[r][c] === 'tent') cells.push({ row: r, col: c });
      }
    }
    return cells;
  }, [puzzle, state]);

  const allMarkedCells: TentsTreesCell[] = useMemo(() => {
    const cells: TentsTreesCell[] = [];
    for (let r = 0; r < puzzle.rows; r += 1) {
      for (let c = 0; c < puzzle.cols; c += 1) {
        if (state.marks[r][c] === 'marked') cells.push({ row: r, col: c });
      }
    }
    return cells;
  }, [puzzle, state]);

  const markChangedAt = useMarkChangeTimestamps(state.marks);

  // A tent being pitched (or a mark fading in) is real motion, 150ms long:
  // on the 12fps idle clock it got two frames and read as lag. So a
  // placement still in flight gets the full rate, and the clock drops back
  // to idle the frame it lands. Declared after \`markChangedAt\` for the
  // same reason the flare needs \`solvedAt\`: it has to see the animation
  // it is meant to drive.
  let placing = false;
  for (const at of markChangedAt.values()) {
    if (now - at < PLACE_ANIMATION_MS) {
      placing = true;
      break;
    }
  }
  // Every *event* animation gets real frames, not just the pitch-in: a
  // row/column completing sends sparks up for SPARK_MS plus a stagger per
  // tent (well over a second on a big board), a violation shakes, a
  // lantern crossfades. All of those ran on the 12fps idle clock and read
  // as lag. Only the slow ambient breathing and fireflies stay throttled.
  const sparkWindowMs = SPARK_MS + (puzzle.rows + puzzle.cols) * SPARK_STAGGER_MS;
  const within = (map: ReadonlyMap<string, number>, windowMs: number): boolean => {
    for (const at of map.values()) if (now - at < windowMs) return true;
    return false;
  };
  let crossfading = false;
  for (const transition of glowTransitions.values()) {
    if (now - transition.changedAt < GLOW_CROSSFADE_MS) {
      crossfading = true;
      break;
    }
  }
  const eventful = placing || flaring || within(lineSatisfiedAt, sparkWindowMs) || within(shakeStarts, 220) || crossfading;
  useAnimationClock(!reducedMotion && (!solved || eventful), eventful ? 60 : IDLE_MOTION_FPS);

  return (
    <Group>
      <StaticTentsChrome puzzle={puzzle} cellSize={cellSize} flashCell={flashCell} />
      <StaticTentsTrees puzzle={puzzle} cellSize={cellSize} />

      {/* Fireflies alone - the one part of a tree that actually needs
          `now`. Visible ~1/8th of an 8s cycle, per-tree phase-shifted;
          skipped entirely (not even a zero-opacity Circle) outside its
          window rather than rendered and hidden, so a tick where nothing
          is lit costs nothing here either. */}
      {Array.from({ length: puzzle.rows }, (_v, r) => r).map(r =>
        Array.from({ length: puzzle.cols }, (_v2, c) => c).map(c => {
          if (!isTreeCell(puzzle, r, c)) return null;
          const cx = c * cellSize + cellSize / 2;
          const cy = r * cellSize + cellSize / 2;
          const canopyY = cy - cellSize * 0.1;

          const seed = fireflySeed(r, c);
          const cyclePhase = ((now / 1000 + seed * 8000) % 8) / 8; // 8s cycle
          const inWindow = cyclePhase < 0.12; // ~1s visible out of 8s
          if (!inWindow) return null;
          const fireflyT = cyclePhase / 0.12;
          const fireflyOpacity = Math.sin(fireflyT * Math.PI) * 0.5;
          if (fireflyOpacity <= 0.01) return null;
          // The brief fade-in/out itself isn't a vestibular trigger, but the
          // continuous orbit is - frozen at a fixed per-tree angle under
          // reduced motion, so a firefly still appears and fades, it just
          // doesn't circle while it's visible.
          const fireflyAngle = seed * Math.PI * 2 + (reducedMotion ? 0 : now / 900);
          const fireflyX = cx + Math.cos(fireflyAngle) * cellSize * 0.22;
          const fireflyY = canopyY - cellSize * 0.08 + Math.sin(fireflyAngle) * cellSize * 0.1;
          return <Circle key={cellKey(r, c)} cx={fireflyX} cy={fireflyY} r={Math.max(1, cellSize * 0.025)} color={theme.colors.accent} opacity={fireflyOpacity} />;
        }),
      )}

      {/* Tents: A-frame + notch + guy-line + shadow + lantern glow, shaking
          on a fresh violation */}
      {allTentCells.map(({ row: r, col: c }) => {
        const cx = c * cellSize + cellSize / 2;
        const baseY = r * cellSize + cellSize * 0.72;
        const shadowW = cellSize * SHADOW_BASE * SHADOW_WIDTH_RATIO;
        const shadowH = cellSize * SHADOW_BASE * SHADOW_HEIGHT_RATIO;

        const key = cellKey(r, c);
        const isTouching = touching.has(key);
        const shakeStart = shakeStarts.get(key);
        const shakeElapsed = shakeStart !== undefined ? now - shakeStart : Infinity;
        const dx = shakeOffsetAt(shakeElapsed);

        // Pitching in: springs up a touch tall and settles, rather than
        // snapping straight to full height - see `PITCH_IN_MS`'s own
        // comment. Anchored at the tent's own base (not the cell's
        // centre) so it reads as rising from the ground, not scaling
        // from nowhere.
        const pitchedAt = markChangedAt.get(key);
        const pitchElapsed = pitchedAt !== undefined ? now - pitchedAt : Infinity;
        const pitchT = clamp01(pitchElapsed / PITCH_IN_MS);
        const pitchScale = pitchElapsed < PITCH_IN_MS ? 1 + (PITCH_OVERSHOOT_SCALE - 1) * (1 - easeOutCubic(pitchT)) : 1;
        const pitchOpacity = pitchElapsed < PITCH_IN_MS ? easeOutCubic(clamp01(pitchElapsed / (PITCH_IN_MS * 0.5))) : 1;

        // Crossfades from the opposite extreme over GLOW_CROSSFADE_MS
        // rather than snapping - "the warmth going out" should read as a
        // deliberate cue, not a flicker.
        const glowTransition = glowTransitions.get(key);
        const crossfadeT = glowTransition ? clamp01((now - glowTransition.changedAt) / GLOW_CROSSFADE_MS) : 1;
        const glowLevel = glowTransition?.value ? crossfadeT : 1 - crossfadeT;
        // Frozen at its own midpoint under reduced motion (still lit, just
        // not breathing) - `now / 1100` is a ~0.14Hz idle oscillation,
        // inside the slow-loop band motion-sensitive users are most
        // bothered by.
        const breathe = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now / 1100 + (r * 7 + c * 13));
        const glowOpacity = glowLevel * (0.55 + 0.35 * breathe);

        // Solve-wave flare: a brief brightness boost, staggered by reading
        // order, only for tents that are actually valid (touching tents
        // never "win" a flare).
        let flareBoost = 0;
        if (solvedAt !== undefined && !isTouching) {
          const index = r * puzzle.cols + c;
          const localElapsed = now - solvedAt - index * FLARE_STAGGER_MS;
          if (localElapsed >= 0 && localElapsed < FLARE_MS) {
            flareBoost = Math.sin(clamp01(localElapsed / FLARE_MS) * Math.PI) * 0.6;
          }
        }

        return (
          <Group key={key} transform={[{ translateX: dx }, { scale: pitchScale }]} origin={vec(cx, baseY)} opacity={pitchOpacity}>
            {glowOpacity + flareBoost > 0.02 && (
              <Group>
                <Circle cx={cx} cy={baseY - cellSize * 0.14} r={cellSize * 0.42} color={theme.colors.accent} opacity={(glowOpacity + flareBoost) * 0.28} />
                <Circle cx={cx} cy={baseY - cellSize * 0.14} r={cellSize * 0.22} color={theme.colors.accent} opacity={(glowOpacity + flareBoost) * 0.5} />
              </Group>
            )}
            <Path path={ellipsePath(cx, baseY + shadowH * 0.3, shadowW / 2, shadowH / 2)} color={theme.colors.tentsShadow} />
            {/* A violation collapses both faces to one flat danger red -
                the same "this is wrong" language every other board in this
                app uses, rather than a two-tone error nobody else has. The
                valid A-frame keeps its two shaded faces plus a small cream
                entrance flap where they meet, so it reads as a real tent
                rather than a flat triangle cutout. */}
            {(() => {
              const g = tentGeometry(cx, baseY, cellSize);
              if (isTouching) {
                return <Path path={`${tentLeftFacePath(g)} ${tentRightFacePath(g)}`} color={theme.colors.danger} />;
              }
              return (
                <>
                  <Path path={tentLeftFacePath(g)} color={TENT_DARK} />
                  <Path path={tentRightFacePath(g)} color={TENT_LIGHT} />
                  <Path path={tentDoorPath(g)} color={TENT_DOOR_COLOR} />
                </>
              );
            })()}
          </Group>
        );
      })}

      {/* Pencil marks: a player's own "definitely not a tent" note - see
          `MARK_COLOR`'s own comment for why this is a quiet cross rather
          than borrowing the tent's violation red or any other vocabulary
          already spoken for on this board. Fades in rather than
          appearing instantly, the same `MARK_FADE_IN_MS` beat every other
          quiet appearance on this app's boards uses (Binairo's own empty-
          ring fade is the closest cousin). */}
      {allMarkedCells.map(({ row: r, col: c }) => {
        const cx = c * cellSize + cellSize / 2;
        const cy = r * cellSize + cellSize / 2;
        const key = cellKey(r, c);
        const markedAt = markChangedAt.get(key);
        const elapsed = markedAt !== undefined ? now - markedAt : Infinity;
        const opacity = elapsed < MARK_FADE_IN_MS ? easeOutCubic(clamp01(elapsed / MARK_FADE_IN_MS)) : 1;
        const d = cellSize * MARK_RADIUS_FACTOR;
        const strokeWidth = Math.max(1, cellSize * MARK_STROKE_FACTOR);
        return (
          <Path
            key={`mark-${key}`}
            path={`M ${cx - d} ${cy - d} L ${cx + d} ${cy + d} M ${cx + d} ${cy - d} L ${cx - d} ${cy + d}`}
            color={MARK_COLOR}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
            opacity={opacity}
          />
        );
      })}

      {/* Sparks: a few motes rising from a newly-satisfied line's tents */}
      {allTentCells.map(({ row: r, col: c }) => {
        const rowStart = lineSatisfiedAt.get(`row:${r}`);
        const colStart = lineSatisfiedAt.get(`col:${c}`);
        const start = rowStart !== undefined && colStart !== undefined ? Math.max(rowStart, colStart) : rowStart ?? colStart;
        if (start === undefined) return null;
        const stagger = (c + r) * SPARK_STAGGER_MS;
        const elapsed = now - start - stagger;
        if (elapsed < 0 || elapsed >= SPARK_MS) return null;

        const cx = c * cellSize + cellSize / 2;
        const baseY = r * cellSize + cellSize * 0.72;
        const t = clamp01(elapsed / SPARK_MS);
        const eased = easeOutCubic(t);
        return (
          <Group key={`spark-${cellKey(r, c)}`}>
            {[0, 1, 2].map(i => {
              const spread = (i - 1) * cellSize * 0.14;
              const rise = eased * cellSize * 0.5 + i * cellSize * 0.06;
              const opacity = (1 - t) * 0.8;
              return (
                <Circle
                  key={i}
                  cx={cx + spread}
                  cy={baseY - cellSize * 0.35 - rise}
                  r={Math.max(1, cellSize * 0.03)}
                  color={theme.colors.accent}
                  opacity={opacity}
                />
              );
            })}
          </Group>
        );
      })}
    </Group>
  );
}
