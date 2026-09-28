import React, { useMemo, useRef } from 'react';
import { Circle, Group, RadialGradient, RoundedRect, vec } from '@shopify/react-native-skia';
import { LightsOutCell, LightsOutPuzzle, LightsOutState } from '../game/lightsout';
import { BoardLayout, computeBoardLayout, getCellCenter, getCellOrigin, useAnimationClock, useReducedMotion } from '../game/rendering';
import { theme } from '../theme';

const TILE_GAP = 6;
/** How long a light takes to cross between on and off - the spec's own
 * ~150ms, and the same beat every other board in this app uses for a
 * placement (`BinairoBoardView`'s `STAMP_IN_MS`, `TentsBoardView`'s
 * `PITCH_IN_MS`). */
const TOGGLE_MS = 150;
/** The bloom that swells and settles on a light the moment it changes -
 * a touch longer than the colour crossfade, so the glow is still
 * resolving after the colour has arrived. */
const PULSE_MS = 260;
/** The solve wave: every light fades out in reading order. Tuned so the
 * last light is out inside `SOLVE_CELEBRATION_MS`, the beat the
 * completion card waits before covering the board - at the old 45ms
 * stagger a 6x6 took very nearly two seconds, all of it behind a scrim. */
const CLEAR_STAGGER_MS = 8;
const CLEAR_MS = 320;

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/** Diffs the light grid against the previous render to find which cells
 * just changed and when - the same during-render-diff idiom
 * `BinairoBoardView`'s `useToggleEvents` and `TentsBoardView`'s
 * `useMarkChangeTimestamps` already use, so a freshly flipped light knows
 * how long it has been flipping. */
function useToggleTimestamps(lights: LightsOutState['lights']): Map<string, number> {
  const previousRef = useRef<LightsOutState['lights'] | null>(null);
  const eventsRef = useRef(new Map<string, number>());

  if (previousRef.current !== lights) {
    const previous = previousRef.current;
    const now = Date.now();
    if (previous) {
      for (let r = 0; r < lights.length; r += 1) {
        for (let c = 0; c < lights[r].length; c += 1) {
          if (previous[r][c] !== lights[r][c]) eventsRef.current.set(cellKey(r, c), now);
        }
      }
    }
    previousRef.current = lights;
  }
  return eventsRef.current;
}

/**
 * One lamp, at a given brightness (0 = fully out, 1 = fully lit), with an
 * optional extra bloom while it is mid-flip: a soft halo, the lamp face,
 * then a small bright core - the same "halo, body, core" layering the
 * Mirror Maze beam uses, which is the register this app's dark boards
 * already speak in (a cast shadow would be invisible against a night
 * panel).
 *
 * The halo is a real radial falloff rather than a flat translucent disc.
 * A disc was the first attempt and it read as a muddy brown ring, not a
 * glow: amber at low alpha over indigo desaturates into dirt, and a hard
 * circular edge reads as a plate sitting on the board. This app's
 * standing rule is depth through geometry rather than shading, with one
 * stated exception - "a single radial gradient on genuinely spherical
 * objects" - and a glowing lamp is exactly that exception.
 */
function renderLamp(key: string, cx: number, cy: number, radius: number, brightness: number, bloom: number): React.JSX.Element {
  const lit = brightness > 0.001;
  const haloRadius = radius * (1.9 + bloom * 0.6);
  const haloAlpha = 0.5 * brightness + bloom * 0.3;
  return (
    <Group key={key}>
      {lit && (
        <Circle cx={cx} cy={cy} r={haloRadius}>
          <RadialGradient
            c={vec(cx, cy)}
            r={haloRadius}
            colors={[`rgba(245, 201, 94, ${haloAlpha})`, 'rgba(245, 201, 94, 0)']}
          />
        </Circle>
      )}
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        color={lit ? theme.colors.lightsOutLit : theme.colors.lightsOutDim}
        opacity={lit ? 0.35 + 0.65 * brightness : 1}
      />
      {lit && <Circle cx={cx} cy={cy} r={radius * 0.42} color={theme.colors.lightsOutLitCore} opacity={brightness} />}
    </Group>
  );
}

interface StaticLightsProps {
  puzzle: LightsOutPuzzle;
  lights: LightsOutState['lights'];
  layout: BoardLayout;
  /** Comma-joined keys of lights currently mid-flip or mid-clear, which
   * the thin animated layer owns instead - the same
   * primitive-string-prop idiom `StaticBinairoTiles` uses so
   * `React.memo`'s shallow comparison can actually bail out between
   * clock ticks. */
  activeKeys: string;
}

/**
 * Every settled light, plus the board's own chrome. Memoized away from
 * the animation clock from the outset: a press only ever changes five
 * cells, so rebuilding all twenty-five (or thirty-six) on every frame of
 * a 150ms crossfade is exactly the waste that had to be retrofitted out
 * of Tents and Mirror Maze after the fact.
 */
const StaticLights = React.memo(function StaticLightsImpl({ puzzle, lights, layout, activeKeys }: StaticLightsProps) {
  const skip = useMemo(() => new Set(activeKeys ? activeKeys.split(',') : []), [activeKeys]);
  const tileSize = Math.max(0, layout.cellSize - TILE_GAP * 2);
  const radius = tileSize * 0.3;

  const tiles: React.JSX.Element[] = [];
  for (let r = 0; r < puzzle.size; r += 1) {
    for (let c = 0; c < puzzle.size; c += 1) {
      const origin = getCellOrigin(layout, r, c);
      const centre = getCellCenter(layout, r, c);
      tiles.push(
        <Group key={`cell-${r}-${c}`}>
          <RoundedRect
            x={origin.x + TILE_GAP}
            y={origin.y + TILE_GAP}
            width={tileSize}
            height={tileSize}
            r={tileSize * 0.22}
            color={theme.colors.lightsOutPanelCell}
          />
          <RoundedRect
            x={origin.x + TILE_GAP}
            y={origin.y + TILE_GAP}
            width={tileSize}
            height={tileSize}
            r={tileSize * 0.22}
            color={theme.colors.lightsOutPanelEdge}
            style="stroke"
            strokeWidth={1}
          />
          {!skip.has(cellKey(r, c)) && renderLamp(`lamp-${r}-${c}`, centre.x, centre.y, radius, lights[r][c] ? 1 : 0, 0)}
        </Group>,
      );
    }
  }

  return <Group>{tiles}</Group>;
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
  const layout = useMemo(() => computeBoardLayout(puzzle.size, size), [puzzle.size, size]);
  const reducedMotion = useReducedMotion();
  const toggledAt = useToggleTimestamps(state.lights);

  const solvedAtRef = useRef<number | null>(null);
  if (solved && solvedAtRef.current === null) solvedAtRef.current = Date.now();
  if (!solved && solvedAtRef.current !== null) solvedAtRef.current = null;
  const solvedAt = solvedAtRef.current;

  // The clock runs only while something is genuinely in flight - a
  // crossfade, a bloom, or the solve wave - and stops dead the rest of
  // the time. This board has no idle ambience by design: a still night
  // should be still.
  const clearWindow = solvedAt !== null ? CLEAR_MS + puzzle.size * puzzle.size * CLEAR_STAGGER_MS : 0;
  const now = Date.now();
  const animating =
    !reducedMotion &&
    ((solvedAt !== null && now - solvedAt < clearWindow) ||
      [...toggledAt.values()].some(at => now - at < PULSE_MS));
  useAnimationClock(animating, 60);

  const tileSize = Math.max(0, layout.cellSize - TILE_GAP * 2);
  const radius = tileSize * 0.3;
  const frame = Date.now();

  /** Cells the animated layer owns this frame: mid-crossfade, still
   * blooming, or being swept out by the solve wave. */
  const activeCells = useMemo(() => {
    const active: Array<{ cell: LightsOutCell; brightness: number; bloom: number }> = [];
    for (let r = 0; r < puzzle.size; r += 1) {
      for (let c = 0; c < puzzle.size; c += 1) {
        const lit = state.lights[r][c];
        const changedAt = toggledAt.get(cellKey(r, c));
        const sinceToggle = changedAt === undefined ? Infinity : frame - changedAt;

        let brightness = lit ? 1 : 0;
        let bloom = 0;

        if (!reducedMotion && sinceToggle < PULSE_MS) {
          const fade = clamp01(sinceToggle / TOGGLE_MS);
          brightness = lit ? easeOutCubic(fade) : 1 - easeOutCubic(fade);
          bloom = Math.sin(clamp01(sinceToggle / PULSE_MS) * Math.PI) * 0.6;
        }

        if (!reducedMotion && solvedAt !== null) {
          const sinceClear = frame - solvedAt - (r * puzzle.size + c) * CLEAR_STAGGER_MS;
          if (sinceClear >= 0 && sinceClear < CLEAR_MS) {
            // One last flare as each light is put out, in reading order.
            const t = clamp01(sinceClear / CLEAR_MS);
            brightness = Math.max(brightness, 1 - easeOutCubic(t));
            bloom = Math.max(bloom, Math.sin(t * Math.PI) * 0.8);
          }
        }

        const settled = brightness === (lit ? 1 : 0) && bloom === 0;
        if (!settled) active.push({ cell: { row: r, col: c }, brightness, bloom });
      }
    }
    return active;
  }, [puzzle.size, state.lights, toggledAt, frame, reducedMotion, solvedAt]);

  const activeKeys = useMemo(
    () => activeCells.map(({ cell }) => cellKey(cell.row, cell.col)).join(','),
    [activeCells],
  );

  return (
    <Group>
      {/* The night the lamps burn against. */}
      <RoundedRect x={0} y={0} width={layout.boardSize} height={layout.boardSize} r={layout.cellSize * 0.16} color={theme.colors.lightsOutPanel} />

      <StaticLights puzzle={puzzle} lights={state.lights} layout={layout} activeKeys={activeKeys} />

      {activeCells.map(({ cell, brightness, bloom }) => {
        const centre = getCellCenter(layout, cell.row, cell.col);
        return renderLamp(`active-${cell.row}-${cell.col}`, centre.x, centre.y, radius, brightness, bloom);
      })}

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

      {/* The panel's own identity-colour rim - the same move every other
          board here makes, at the higher opacity `mirrorPanel`'s frame
          already established for a dark ground. */}
      <RoundedRect
        x={1}
        y={1}
        width={layout.boardSize - 2}
        height={layout.boardSize - 2}
        r={Math.max(0, layout.cellSize * 0.16 - 1)}
        color={theme.colors.lightsOutAccent}
        style="stroke"
        strokeWidth={1.75}
        opacity={0.85}
      />
    </Group>
  );
}
