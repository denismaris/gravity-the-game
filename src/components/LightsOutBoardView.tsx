import React, { useEffect, useMemo, useRef } from 'react';
import { Circle, Group, Path, RadialGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { LightsOutCell, LightsOutPuzzle, LightsOutState } from '../game/lightsout';
import { BoardLayout, computeBoardLayout, getCellOrigin, useReducedMotion, DealIn, dealDelay, useDealing } from '../game/rendering';
import { theme } from '../theme';

const TILE_GAP = 6;
/** The light spreads from the lamp that was pressed to its neighbours,
 * this much later per square. */
const SPREAD_MS = 55;
/** The solve: a warm ripple out from the middle of the board, one ring of
 * lamps this much after the last - over well inside `SOLVE_CELEBRATION_MS`. */
const RIPPLE_STEP_MS = 70;

/**
 * The board's squares inside a margin of one tile gap, so the outer
 * tiles sit as far from the frame as from each other. The tap layer
 * (`LightsOutBoard`) uses the same numbers.
 */
export function lanternGrid(cells: number, size: number): { layout: BoardLayout; margin: number; outer: number } {
  const outer = Math.max(0, Math.floor(size));
  return { layout: computeBoardLayout(cells, outer - TILE_GAP * 2), margin: TILE_GAP, outer };
}

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/**
 * When each lamp that just changed should start: the pressed lamp first,
 * the rest a beat later the further they are from it, so the light visibly
 * travels. Worked out during the render that brings the change, from the
 * grid before it.
 */
function useChangeDelays(lights: LightsOutState['lights']): ReadonlyMap<string, number> {
  const previousRef = useRef<LightsOutState['lights'] | null>(null);
  const delaysRef = useRef<ReadonlyMap<string, number>>(new Map());
  if (previousRef.current !== lights) {
    const previous = previousRef.current;
    const delays = new Map<string, number>();
    if (previous) {
      const changed: LightsOutCell[] = [];
      for (let r = 0; r < lights.length; r += 1) {
        for (let c = 0; c < lights[r].length; c += 1) {
          if (previous[r][c] !== lights[r][c]) changed.push({ row: r, col: c });
        }
      }
      // The pressed lamp: the changed one with the most changed neighbours.
      const isChanged = new Set(changed.map(cell => cellKey(cell.row, cell.col)));
      const neighbours = (cell: LightsOutCell) =>
        [cellKey(cell.row - 1, cell.col), cellKey(cell.row + 1, cell.col), cellKey(cell.row, cell.col - 1), cellKey(cell.row, cell.col + 1)].filter(key => isChanged.has(key)).length;
      const origin = changed.reduce<LightsOutCell | null>((best, cell) => (best === null || neighbours(cell) > neighbours(best) ? cell : best), null);
      for (const cell of changed) {
        const distance = origin ? Math.abs(cell.row - origin.row) + Math.abs(cell.col - origin.col) : 0;
        delays.set(cellKey(cell.row, cell.col), Math.min(distance, 4) * SPREAD_MS);
      }
    }
    previousRef.current = lights;
    delaysRef.current = delays;
  }
  return delaysRef.current;
}

interface LampProps {
  lit: boolean;
  /** When this lamp's change starts, after the press (see `useChangeDelays`). */
  delay: number;
  /** Set once the board is solved: when this lamp's part of the ripple starts. */
  rippleDelay: number | null;
  /** The tile the lamp sits in. */
  x: number;
  y: number;
  size: number;
  reducedMotion: boolean;
}

/**
 * One lantern, animating itself on the UI thread - so a press costs the
 * board one render, and the light moves on every frame however busy the
 * phone is (it used to be redrawn from the JS clock, which stuttered).
 *
 * Three values drive it: `level`, how lit the glass is; `ember`, the flame
 * at its heart, which catches a moment before the glass and lingers after
 * it as the lamp goes out; and `bloom`, a swell of the halo past its
 * resting size as a lamp catches. Lit, the lamp also warms its own tile.
 */
const Lamp = React.memo(function LampImpl({ lit, delay, rippleDelay, x, y, size, reducedMotion }: LampProps) {
  const level = useSharedValue(lit ? 1 : 0);
  const ember = useSharedValue(lit ? 1 : 0);
  const bloom = useSharedValue(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reducedMotion) {
      level.value = lit ? 1 : 0;
      ember.value = lit ? 1 : 0;
      bloom.value = 0;
      return;
    }
    if (lit) {
      // Catching: the flame first, the glass after it with one small dip,
      // and the halo swelling over and settling back.
      ember.value = withDelay(delay, withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }));
      level.value = withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }),
          withTiming(0.8, { duration: 70, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
        ),
      );
      bloom.value = withDelay(delay, withSequence(withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 520, easing: Easing.inOut(Easing.cubic) })));
    } else {
      // Going out: a small puff, the glass dims, and the ember fades last.
      bloom.value = withDelay(delay, withSequence(withTiming(0.35, { duration: 110 }), withTiming(0, { duration: 260 })));
      level.value = withDelay(delay, withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) }));
      ember.value = withDelay(delay + 40, withTiming(0, { duration: 340, easing: Easing.in(Easing.quad) }));
    }
    // A lamp's own change is the only thing that restarts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lit]);

  // The solve: one warm flare passing over every lamp, out from the middle.
  useEffect(() => {
    if (rippleDelay === null || reducedMotion) return;
    const rest = lit ? 1 : 0;
    level.value = withDelay(rippleDelay, withSequence(withTiming(0.75, { duration: 180, easing: Easing.out(Easing.quad) }), withTiming(rest, { duration: 520, easing: Easing.inOut(Easing.cubic) })));
    ember.value = withDelay(rippleDelay, withSequence(withTiming(0.9, { duration: 160 }), withTiming(rest, { duration: 620, easing: Easing.in(Easing.quad) })));
    bloom.value = withDelay(rippleDelay, withSequence(withTiming(0.8, { duration: 200 }), withTiming(0, { duration: 560 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rippleDelay]);

  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.33;
  const haloMax = r * 3.1;

  const tileWash = useDerivedValue(() => level.value * 0.2);
  const haloOpacity = useDerivedValue(() => Math.min(1, level.value * 0.75 + bloom.value * 0.45));
  const haloR = useDerivedValue(() => r * (2.0 + bloom.value * 1.1));
  const coreR = useDerivedValue(() => r * (0.2 + 0.28 * ember.value + 0.06 * bloom.value));
  // The flame dims with the glass around it, so a lamp going out leaves a
  // fading warm ember, not a bright pinpoint on dark glass.
  const coreOpacity = useDerivedValue(() => ember.value * (0.35 + 0.65 * level.value));
  const glint = useDerivedValue(() => 0.18 + 0.4 * level.value);

  return (
    <Group>
      {/* The tile, warmed by its own lamp. */}
      <RoundedRect x={x} y={y} width={size} height={size} r={size * 0.22} color={theme.colors.lightsOutLit} opacity={tileWash} />
      {/* The halo: the one radial falloff, on a genuinely round light. */}
      <Circle cx={cx} cy={cy} r={haloR} opacity={haloOpacity}>
        <RadialGradient c={vec(cx, cy)} r={haloMax} colors={['rgba(255, 214, 120, 0.85)', 'rgba(245, 201, 94, 0.32)', 'rgba(245, 201, 94, 0)']} positions={[0, 0.45, 1]} />
      </Circle>
      {/* The glass, unlit, and the same glass lit over it. */}
      <Circle cx={cx} cy={cy} r={r} color={theme.colors.lightsOutDim} />
      <Circle cx={cx} cy={cy} r={r} color={theme.colors.lightsOutLit} opacity={level} />
      {/* The flame. */}
      <Circle cx={cx} cy={cy} r={coreR} color={theme.colors.lightsOutLitCore} opacity={coreOpacity} />
      {/* A glint on the glass, upper left. */}
      <Circle cx={cx - r * 0.38} cy={cy - r * 0.4} r={r * 0.16} color="#FFFFFF" opacity={glint} />
    </Group>
  );
});

export interface LightsOutBoardViewProps {
  puzzle: LightsOutPuzzle;
  state: LightsOutState;
  /** Pixel width (and height - always square) available for the grid. */
  size: number;
  solved: boolean;
  /** Cell to ring briefly - a hint reveal. */
  flashCell?: LightsOutCell | null;
}

export function LightsOutBoardView({ puzzle, state, size, solved, flashCell }: LightsOutBoardViewProps): React.JSX.Element {
  const { layout, margin, outer } = useMemo(() => lanternGrid(puzzle.size, size), [puzzle.size, size]);
  const dealing = useDealing();
  const reducedMotion = useReducedMotion();
  const delays = useChangeDelays(state.lights);
  const tileSize = Math.max(0, layout.cellSize - TILE_GAP * 2);
  const middle = (puzzle.size - 1) / 2;

  return (
    <Group>
      {/* The night the lamps burn against. */}
      <RoundedRect x={0} y={0} width={outer} height={outer} r={layout.cellSize * 0.16} color={theme.colors.lightsOutPanel} />
      <Group transform={[{ translateX: margin }, { translateY: margin }]}>
      <BoardTiles size={puzzle.size} layout={layout} tileSize={tileSize} />
      {/* Twins: a thread tied from one to the other, under the lamps. */}
      {(puzzle.twins ?? []).map(([a, b], i) => {
        const pa = getCellOrigin(layout, a.row, a.col);
        const pb = getCellOrigin(layout, b.row, b.col);
        const h = layout.cellSize / 2;
        const ax = pa.x + h;
        const ay = pa.y + h;
        const bx = pb.x + h;
        const by = pb.y + h;
        const sag = Math.min(layout.cellSize * 0.6, Math.hypot(bx - ax, by - ay) * 0.18);
        return (
          <Group key={`twin-${i}`}>
            <Path path={`M ${ax} ${ay} Q ${(ax + bx) / 2} ${(ay + by) / 2 + sag} ${bx} ${by}`} color={theme.colors.lightsOutLit} style="stroke" strokeWidth={2} strokeCap="round" opacity={0.55} />
            {[pa, pb].map((p, k) => (
              <Circle key={k} cx={p.x + h} cy={p.y + h + tileSize * 0.36} r={2.5} color={theme.colors.lightsOutLit} opacity={0.8} />
            ))}
          </Group>
        );
      })}

      {state.lights.map((line, r) =>
        line.map((lit, c) => {
          const origin = getCellOrigin(layout, r, c);
          const ring = Math.round(Math.max(Math.abs(r - middle), Math.abs(c - middle)));
          // Dealt onto the board as it opens, corner to corner.
          return (
            <DealIn key={cellKey(r, c)} x={origin.x + TILE_GAP + tileSize / 2} y={origin.y + TILE_GAP + tileSize / 2} delay={dealDelay(Math.max(r, c), puzzle.size - 1)} dealing={dealing}>
              <Lamp
                lit={lit}
                delay={delays.get(cellKey(r, c)) ?? 0}
                rippleDelay={solved ? ring * RIPPLE_STEP_MS : null}
                x={origin.x + TILE_GAP}
                y={origin.y + TILE_GAP}
                size={tileSize}
                reducedMotion={reducedMotion}
              />
            </DealIn>
          );
        }),
      )}

      {flashCell && (
        <RoundedRect
          x={flashCell.col * layout.cellSize + TILE_GAP - 2}
          y={flashCell.row * layout.cellSize + TILE_GAP - 2}
          width={tileSize + 4}
          height={tileSize + 4}
          r={tileSize * 0.22 + 2}
          color={theme.colors.accent}
          style="stroke"
          strokeWidth={2.5}
        />
      )}

      </Group>

      {/* The panel's own identity-colour rim. */}
      <RoundedRect
        x={1}
        y={1}
        width={outer - 2}
        height={outer - 2}
        r={Math.max(0, layout.cellSize * 0.16 - 1)}
        color={theme.colors.lightsOutAccent}
        style="stroke"
        strokeWidth={1.75}
        opacity={0.85}
      />
    </Group>
  );
}


/** The empty tiles, drawn once: they never change. */
const BoardTiles = React.memo(function BoardTilesImpl({ size, layout, tileSize }: { size: number; layout: BoardLayout; tileSize: number }) {
  const tiles: React.JSX.Element[] = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const origin = getCellOrigin(layout, r, c);
      tiles.push(
        <Group key={`cell-${r}-${c}`}>
          <RoundedRect x={origin.x + TILE_GAP} y={origin.y + TILE_GAP} width={tileSize} height={tileSize} r={tileSize * 0.22} color={theme.colors.lightsOutPanelCell} />
          <RoundedRect x={origin.x + TILE_GAP} y={origin.y + TILE_GAP} width={tileSize} height={tileSize} r={tileSize * 0.22} color={theme.colors.lightsOutPanelEdge} style="stroke" strokeWidth={1} />
        </Group>,
      );
    }
  }
  return <Group>{tiles}</Group>;
});
