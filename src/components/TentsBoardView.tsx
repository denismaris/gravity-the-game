import React, { useMemo, useRef } from 'react';
import { Circle, Group, Path, RadialGradient, vec } from '@shopify/react-native-skia';
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

/** Tree canopy: one rounded, lumpy blob rather than three overlapping flat
 * circles - the original three-circle silhouette had no shading and no
 * separation between the lobes, so at a board icon's actual size it just
 * read as one solid black smudge, not a tree. A single softly-scalloped
 * path plus a real radial gradient (see `CANOPY_LIGHT`/`CANOPY_DARK`) reads
 * as foliage at a glance and is cheaper to draw besides - one gradient
 * fill instead of three. Proven out in an actual rendered SVG comparison
 * against a shaded three-lobe-with-outlines version and a layered-pine
 * silhouette before picking this one: it read as the cleanest single
 * shape without needing separator strokes to hold together. The canopy
 * moved off plain ink to a real forest green in the same pass - shape
 * (a round puff vs. the tent's sharp A-frame) is still what tells a tree
 * and a tent apart at a glance, exactly as elsewhere in this app, so nudging
 * the tree toward its own green doesn't blur that: the two greens are
 * deliberately different (a darker, more muted one for the tree). */
const CANOPY_LIGHT = '#5C7150';
const CANOPY_DARK = '#28331F';
const CANOPY_OUTLINE = 'rgba(24, 30, 18, 0.5)';
const TRUNK_COLOR = '#5A4632';

const TRUNK_BASE = 0.16;
const TRUNK_TOP_RATIO = 0.6;
const TRUNK_HEIGHT = 0.22;

const TENT_HEIGHT = 0.3;
const TENT_HALF_BASE = 0.44;
const NOTCH_WIDTH = 0.1;
const NOTCH_HEIGHT_RATIO = 0.35; // of the tent's own height
const GUY_LENGTH = 0.22;
const GUY_ANGLE_DEG = 35;
/** The tent's two canvas faces, lit from the same upper-right direction
 * the tree's own canopy highlight comes from - a flat single-colour A-frame
 * read as a cardboard cutout with no volume; splitting it at the ridge
 * into a lighter (sun-facing) and darker (shadowed) triangle, plus a small
 * cream entrance flap where the two faces meet at the base, is enough to
 * read as a real three-dimensional tent without needing a full gradient.
 * `TENT_LIGHT`/`TENT_DARK` are a different, more muted green family than
 * the canopy's own - two adjacent objects sharing one exact green would
 * blur back together at a glance. */
const TENT_LIGHT = '#557A5D';
const TENT_DARK = '#345140';
const TENT_DOOR_COLOR = theme.colors.background;

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

/** The canopy's own lumpy silhouette - one continuous scalloped path, not
 * stacked circles - hand-tuned as a set of cubic Beziers against a
 * `cellSize`-square reference box (this exact curve is the one that read
 * best in the SVG comparison mentioned above). `cx`/`topRefY` anchor
 * roughly where the blob's own centre falls, not its top-left corner. */
function canopyPath(cx: number, topRefY: number, cellSize: number): string {
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
interface TentGeometry {
  apex: { x: number; y: number };
  leftBase: { x: number; y: number };
  rightBase: { x: number; y: number };
  leftNotch: { x: number; y: number };
  rightNotch: { x: number; y: number };
  notchTop: { x: number; y: number };
}
function tentGeometry(cx: number, baseY: number, cellSize: number): TentGeometry {
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
function tentLeftFacePath(g: TentGeometry): string {
  return `M ${g.apex.x} ${g.apex.y} L ${g.leftBase.x} ${g.leftBase.y} L ${g.leftNotch.x} ${g.leftNotch.y} L ${g.notchTop.x} ${g.notchTop.y} Z`;
}
/** The sun-facing, right side - lighter than its left-hand counterpart. */
function tentRightFacePath(g: TentGeometry): string {
  return `M ${g.apex.x} ${g.apex.y} L ${g.notchTop.x} ${g.notchTop.y} L ${g.rightNotch.x} ${g.rightNotch.y} L ${g.rightBase.x} ${g.rightBase.y} Z`;
}
/** A small cream flap right where the two faces meet at the base - the
 * tent's own entrance, not just a notch cut out of the silhouette. */
function tentDoorPath(g: TentGeometry): string {
  return `M ${g.leftNotch.x} ${g.leftNotch.y} L ${g.notchTop.x} ${g.notchTop.y} L ${g.rightNotch.x} ${g.rightNotch.y} Z`;
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
              <Path path={canopyPath(cx, canopyY, cellSize)} style="fill">
                <RadialGradient c={vec(cx - cellSize * 0.12, canopyY - cellSize * 0.12)} r={cellSize * 0.65} colors={[CANOPY_LIGHT, CANOPY_DARK]} />
              </Path>
              <Path path={canopyPath(cx, canopyY, cellSize)} color={CANOPY_OUTLINE} style="stroke" strokeWidth={Math.max(1, cellSize * 0.012)} />
              <Path path={trunkPath(cx, trunkTopY, cellSize)} color={TRUNK_COLOR} />
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
              color={isTouching ? theme.colors.danger : TENT_DARK}
              style="stroke"
              strokeWidth={1.5}
            />
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
