import React, { useMemo, useRef } from 'react';
import { Circle, Group, Path } from '@shopify/react-native-skia';
import {
  isRowSatisfied,
  isColSatisfied,
  isTreeCell,
  TentsTreesCell,
  TentsTreesPuzzle,
  TentsTreesState,
  touchingTentCells,
} from '../game/tents';
import { useAnimationClock } from '../game/rendering';
import { theme } from '../theme';

/** Ground shadow: shared by both objects (`tentsShadow`'s own rationale -
 * "one visual concept in this palette, not several"), sized off a fixed
 * reference rather than either object's own, very different footprint. */
const SHADOW_BASE = 0.16;
const SHADOW_WIDTH_RATIO = 1.8;
const SHADOW_HEIGHT_RATIO = 0.35;

/** Tree canopy: three overlapping lobes. The literal spec formula
 * (`~40%-of-smaller-radius overlap`, i.e. distance = r1+r2-0.4*min(r1,r2))
 * was checked against these radii and produces a canopy ~1.38x the cell's
 * own width - it overflows badly. These centre-to-centre distances were
 * tuned by hand instead for a contained, still-lumpy silhouette (~1.1x
 * cell width, a normal amount of foliage "spillover" for this style of
 * icon), keeping the radii themselves as specified. */
const LOBE_RADII = [0.3, 0.22, 0.26]; // left, middle, right - as specified
const LOBE_DISTANCE = [0.28, 0.26]; // tuned: mid-to-left, mid-to-right

const TRUNK_BASE = 0.16;
const TRUNK_TOP_RATIO = 0.6;
const TRUNK_HEIGHT = 0.22;

const TENT_HEIGHT = 0.3;
const TENT_HALF_BASE = 0.44;
const NOTCH_WIDTH = 0.1;
const NOTCH_HEIGHT_RATIO = 0.35; // of the tent's own height
const GUY_LENGTH = 0.22;
const GUY_ANGLE_DEG = 35;

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
const FLARE_STAGGER_MS = 40;

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}
function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

function trunkPath(cx: number, topY: number, cellSize: number): string {
  const base = cellSize * TRUNK_BASE;
  const top = base * TRUNK_TOP_RATIO;
  const bottomY = topY + cellSize * TRUNK_HEIGHT;
  return `M ${cx - top / 2} ${topY} L ${cx + top / 2} ${topY} L ${cx + base / 2} ${bottomY} L ${cx - base / 2} ${bottomY} Z`;
}

/** True A-frame with an inverted-V entrance notch cut into the base, not
 * "the tree without a trunk" - a different silhouette family entirely. */
function tentPath(cx: number, baseY: number, cellSize: number): string {
  const height = cellSize * TENT_HEIGHT;
  const halfBase = cellSize * TENT_HALF_BASE;
  const apexY = baseY - height;
  const notchWidth = cellSize * NOTCH_WIDTH;
  const notchTopY = baseY - height * NOTCH_HEIGHT_RATIO;
  return [
    `M ${cx - halfBase} ${baseY}`,
    `L ${cx - notchWidth / 2} ${baseY}`,
    `L ${cx} ${notchTopY}`,
    `L ${cx + notchWidth / 2} ${baseY}`,
    `L ${cx + halfBase} ${baseY}`,
    `L ${cx} ${apexY}`,
    'Z',
  ].join(' ');
}

function guyLinePath(cx: number, baseY: number, cellSize: number): string {
  const startX = cx + cellSize * TENT_HALF_BASE;
  const angle = (GUY_ANGLE_DEG * Math.PI) / 180;
  const length = cellSize * GUY_LENGTH;
  return `M ${startX} ${baseY} L ${startX + length * Math.cos(angle)} ${baseY + length * Math.sin(angle)}`;
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
  useAnimationClock(!solved);
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

  return (
    <Group>
      {/* Hairline grid + hint flash */}
      {Array.from({ length: puzzle.cols - 1 }, (_v, i) => i + 1).map(i => (
        <Path
          key={`gv-${i}`}
          path={`M ${i * cellSize} 0 L ${i * cellSize} ${puzzle.rows * cellSize}`}
          color={theme.colors.border}
          style="stroke"
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: puzzle.rows - 1 }, (_v, i) => i + 1).map(i => (
        <Path
          key={`gh-${i}`}
          path={`M 0 ${i * cellSize} L ${puzzle.cols * cellSize} ${i * cellSize}`}
          color={theme.colors.border}
          style="stroke"
          strokeWidth={1}
        />
      ))}
      {flashCell && (
        <Path
          path={`M ${flashCell.col * cellSize} ${flashCell.row * cellSize} h ${cellSize} v ${cellSize} h ${-cellSize} Z`}
          color={theme.colors.accent}
          opacity={0.4}
        />
      )}

      {/* Trees: canopy + trunk + shadow + the rare firefly */}
      {Array.from({ length: puzzle.rows }, (_v, r) => r).map(r =>
        Array.from({ length: puzzle.cols }, (_v2, c) => c).map(c => {
          if (!isTreeCell(puzzle, r, c)) return null;
          const cx = c * cellSize + cellSize / 2;
          const cy = r * cellSize + cellSize / 2;
          const canopyY = cy - cellSize * 0.1;
          const trunkTopY = canopyY + cellSize * 0.12;
          const trunkBottomY = trunkTopY + cellSize * TRUNK_HEIGHT;
          const shadowW = cellSize * SHADOW_BASE * SHADOW_WIDTH_RATIO;
          const shadowH = cellSize * SHADOW_BASE * SHADOW_HEIGHT_RATIO;

          // Firefly: visible for a short window once every several seconds,
          // per-tree phase-shifted so the whole board never blinks at once.
          const seed = fireflySeed(r, c);
          const cyclePhase = ((now / 1000 + seed * 8000) % 8) / 8; // 8s cycle
          const inWindow = cyclePhase < 0.12; // ~1s visible out of 8s
          const fireflyT = inWindow ? cyclePhase / 0.12 : 0;
          const fireflyOpacity = inWindow ? Math.sin(fireflyT * Math.PI) * 0.5 : 0;
          const fireflyAngle = seed * Math.PI * 2 + now / 900;
          const fireflyX = cx + Math.cos(fireflyAngle) * cellSize * 0.22;
          const fireflyY = canopyY - cellSize * 0.08 + Math.sin(fireflyAngle) * cellSize * 0.1;

          return (
            <Group key={cellKey(r, c)}>
              <Path path={ellipsePath(cx, trunkBottomY + shadowH * 0.3, shadowW / 2, shadowH / 2)} color={theme.colors.tentsShadow} />
              {LOBE_RADII.map((radius, i) => {
                const lobeX = i === 0 ? cx - cellSize * LOBE_DISTANCE[0] : i === 2 ? cx + cellSize * LOBE_DISTANCE[1] : cx;
                return <Circle key={`lobe-${i}`} cx={lobeX} cy={canopyY} r={cellSize * radius} color={theme.colors.primary} />;
              })}
              <Path path={trunkPath(cx, trunkTopY, cellSize)} color={theme.colors.primary} />
              {fireflyOpacity > 0.01 && <Circle cx={fireflyX} cy={fireflyY} r={Math.max(1, cellSize * 0.025)} color={theme.colors.accent} opacity={fireflyOpacity} />}
            </Group>
          );
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

        // Crossfades from the opposite extreme over GLOW_CROSSFADE_MS
        // rather than snapping - "the warmth going out" should read as a
        // deliberate cue, not a flicker.
        const glowTransition = glowTransitions.get(key);
        const crossfadeT = glowTransition ? clamp01((now - glowTransition.changedAt) / GLOW_CROSSFADE_MS) : 1;
        const glowLevel = glowTransition?.value ? crossfadeT : 1 - crossfadeT;
        const breathe = 0.5 + 0.5 * Math.sin(now / 1100 + (r * 7 + c * 13));
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
          <Group key={key} transform={[{ translateX: dx }]}>
            {glowOpacity + flareBoost > 0.02 && (
              <Group>
                <Circle cx={cx} cy={baseY - cellSize * 0.14} r={cellSize * 0.42} color={theme.colors.accent} opacity={(glowOpacity + flareBoost) * 0.28} />
                <Circle cx={cx} cy={baseY - cellSize * 0.14} r={cellSize * 0.22} color={theme.colors.accent} opacity={(glowOpacity + flareBoost) * 0.5} />
              </Group>
            )}
            <Path path={ellipsePath(cx, baseY + shadowH * 0.3, shadowW / 2, shadowH / 2)} color={theme.colors.tentsShadow} />
            <Path
              path={guyLinePath(cx, baseY, cellSize)}
              color={isTouching ? theme.colors.danger : theme.colors.tentsAccent}
              style="stroke"
              strokeWidth={1.5}
            />
            <Path path={tentPath(cx, baseY, cellSize)} color={isTouching ? theme.colors.danger : theme.colors.tentsAccent} />
          </Group>
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
