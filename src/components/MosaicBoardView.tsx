import React, { useMemo, useRef } from 'react';
import { Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { MosaicCell, MosaicPuzzle, MosaicState, MosaicTheme, orient } from '../game/mosaic';
import { shade, useAnimationClock, useReducedMotion } from '../game/rendering';
import { darkColors, getColorScheme, inkWash, lightColors, theme } from '../theme';
import { PaperTray } from './boardChrome';

/**
 * The glazes. Five per theme, chosen as families rather than as a
 * rainbow - a fish reads as sea because every piece of it is a blue, a
 * tulip as a garden because it is all roses and leaf - and each drawn
 * from, or tuned to sit beside, the app's own printed palette.
 */
export const MOSAIC_PALETTES: Readonly<Record<MosaicTheme, readonly string[]>> = {
  // Hearth's fifth glaze was a pale sand-ochre (#E3B774) - near enough the
  // colour of an empty socket that a set piece in it read as a hole on a
  // phone screen. Every glaze must stand clear of the sand.
  hearth: ['#C46C33', '#D9A441', '#B8503E', '#8E3B2E', '#6B4A2F'],
  garden: ['#C8506A', '#E0879A', '#D9A441', '#7A3F7E', '#A8377F'],
  sea: ['#2E5A78', '#3F8FB0', '#6FB3BE', '#1D4E6E', '#4E9AA6'],
  dusk: ['#3B1F52', '#6B4489', '#C8506A', '#D9A441', '#9C88B8'],
  meadow: ['#2C6B3C', '#6E9A45', '#A9B955', '#D9A441', '#3F7F6E'],
};

/** The grout bed the picture is set into, by day and by night: `socket`
 * is what shows between tiles and the floor of an empty square, `grout`
 * the bed itself, `slabEdge` its thickness along the bottom, `socketWall`
 * the lip an empty socket's top-left wall shows. By night the bed is dark
 * slate, so the glazed pieces are the lit thing on it, as by day. */
export const BED_DAY = { socket: lightColors.mosaicSocket, grout: lightColors.mosaicGrout, slabEdge: lightColors.mosaicSlabEdge, socketWall: lightColors.mosaicSocketWall };
export const BED_NIGHT: typeof BED_DAY = { socket: darkColors.mosaicSocket, grout: darkColors.mosaicGrout, slabEdge: darkColors.mosaicSlabEdge, socketWall: darkColors.mosaicSocketWall };
/** The day socket - what the glaze contrast test measures against by day. */
export const MOSAIC_SOCKET = BED_DAY.socket;
// Read live, so a worn Mosaic skin (a different grout bed) shows.
const bed = (): typeof BED_DAY => ({ socket: theme.colors.mosaicSocket, grout: theme.colors.mosaicGrout, slabEdge: theme.colors.mosaicSlabEdge, socketWall: theme.colors.mosaicSocketWall });

/** How much of a square the gap around a tile takes, per side. */
const GROUT_GAP = 0.07;
/** A raised tile's thickness, as a share of a square. */
const TILE_DEPTH = 0.11;
/** How far a socket (or a clue set in one) sinks below the grout. */
const RECESS_DEPTH = 0.07;
/** A raised tile's flat shadow on the grout: ink, faint, and offset the way
 * the light falls - top-left, like every object in this app. */
/** The stamp on a set tile. */
const SET_MARK = 'rgba(255, 246, 225, 0.78)';

/** A tile's own tone: each tessera a touch lighter or darker than its
 * neighbours, the way hand-cut glass never quite matches - fixed per square,
 * so a picture always looks the same. */
function tileTone(hex: string, row: number, col: number, seed: number): string {
  const h = Math.sin((row + 1) * 12.9898 + (col + 1) * 78.233 + seed * 3.17) * 43758.5453;
  const jitter = h - Math.floor(h);
  return shade(hex, 0.93 + jitter * 0.14);
}

export interface TesseraeProps {
  /** Squares in board-cell units, relative to the group's origin. */
  readonly cells: ReadonlyArray<MosaicCell>;
  readonly color: string;
  readonly cellSize: number;
  /** Folds into each tile's tone, so two pieces of one colour differ. */
  readonly seed: number;
  readonly opacity?: number;
  /** A clue piece: drawn as a placed tile, stamped with a small cream
   * tessera to say it is locked. */
  readonly set?: boolean;
  /** Cast a flat shadow on the grout (tiles standing on the board). */
  readonly shadow?: boolean;
  /** Draw only one layer of a raised piece. A board draws every piece's
   * shadow, then every piece's sides, then every top - otherwise a piece
   * drawn later lays its shadow (or its bottom face, which reaches a few
   * pixels into the square below) over a neighbour already drawn. */
  readonly part?: 'all' | 'shadow' | 'sides' | 'tops';
}

/**
 * One piece, tile by tile, as solid blocks of glass. Depth is geometry
 * only - never a gradient, never a highlight line (this app's rule, learned
 * the hard way): a raised tile shows its thickness as one darker face
 * straight below, as if lit from above.
 */
export function Tesserae({ cells, color, cellSize, seed, opacity = 1, set = false, shadow = false, part = 'all' }: TesseraeProps): React.JSX.Element {
  const gap = cellSize * GROUT_GAP;
  const size = cellSize - gap * 2;
  const r = size * 0.2;

  const depth = Math.max(2, cellSize * TILE_DEPTH);
  const bottom = shade(color, 0.55);
  const show = (layer: 'shadow' | 'sides' | 'tops') => part === 'all' || part === layer;
  return (
    <Group opacity={opacity}>
      {shadow &&
        show('shadow') &&
        cells.map(c => (
          <RoundedRect
            key={`g-${c.row}-${c.col}`}
            x={c.col * cellSize + gap}
            y={c.row * cellSize + gap + depth * 1.9}
            width={size}
            height={size}
            r={r}
            color={inkWash(0.16)}
          />
        ))}
      {/* Its thickness: one darker face straight below. A right-hand face
          as well made every tile lean, and the board read as skewed. */}
      {show('sides') &&
        cells.map(c => (
        <RoundedRect key={`b-${c.row}-${c.col}`} x={c.col * cellSize + gap} y={c.row * cellSize + gap + depth} width={size} height={size} r={r} color={bottom} />
      ))}
      {show('tops') &&
        cells.map(c => (
        <RoundedRect key={`t-${c.row}-${c.col}`} x={c.col * cellSize + gap} y={c.row * cellSize + gap} width={size} height={size} r={r} color={tileTone(color, c.row, c.col, seed)} />
      ))}
      {/* A set piece is a real placed tile like any other - it only wears a
          small cream tessera, so "already laid, and locked" still reads at
          a glance. (Sinking set pieces into their sockets was tried first;
          on a phone it read as "not placed yet".) */}
      {set &&
        show('tops') &&
        cells.map(c => {
          const cx = c.col * cellSize + gap + size / 2;
          const cy = c.row * cellSize + gap + size / 2;
          const mark = Math.max(2, size * 0.13);
          return <Path key={`m-${c.row}-${c.col}`} path={`M ${cx} ${cy - mark} L ${cx + mark} ${cy} L ${cx} ${cy + mark} L ${cx - mark} ${cy} Z`} color={SET_MARK} />;
        })}
    </Group>
  );
}

/** A piece's colour in its puzzle's glaze. */
export function pieceColor(puzzle: MosaicPuzzle, index: number): string {
  const palette = MOSAIC_PALETTES[puzzle.theme];
  return glazeFor(palette[puzzle.pieces[index].color % palette.length]);
}

/**
 * A glaze as it shows in the current palette. By night the deepest glazes
 * - a dusk violet, the harbour navies, the darker earths - would sink into
 * the dark grout bed, so their lightness is raised to a floor with hue and
 * saturation kept: the same glaze, lamp-lit, rather than a washed-out
 * pastel. By day, unchanged. (`mosaicPalette.test.ts` holds every glaze
 * clear of the socket in both palettes.)
 */
const NIGHT_GLAZE_LIGHTNESS = 0.48;
export function glazeFor(hex: string): string {
  if (getColorScheme() !== 'dark') return hex;
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (l >= NIGHT_GLAZE_LIGHTNESS) return hex;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = ((h % 6) + 6) % 6;
  // Back from hue/saturation at the raised lightness.
  const L = NIGHT_GLAZE_LIGHTNESS;
  const c = (1 - Math.abs(2 * L - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = L - c / 2;
  const sector = Math.floor(h);
  const [r1, g1, b1] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector];
  return `#${[r1, g1, b1].map(ch => Math.round((ch + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

export interface MosaicBoardGeometry {
  readonly cellSize: number;
  readonly width: number;
  readonly height: number;
  /** Paper margin between the tray's rim and the first square. */
  readonly pad: number;
}

/** Fits the picture, and a margin of paper round it, inside `maxWidth` by
 * `maxHeight`. */
export function mosaicGeometry(puzzle: MosaicPuzzle, maxWidth: number, maxHeight: number): MosaicBoardGeometry {
  const padFactor = 0.45;
  const cellSize = Math.floor(Math.min(maxWidth / (puzzle.cols + padFactor * 2), maxHeight / (puzzle.rows + padFactor * 2)));
  const pad = Math.round(cellSize * padFactor);
  return { cellSize, width: puzzle.cols * cellSize + pad * 2, height: puzzle.rows * cellSize + pad * 2, pad };
}

/** The picture's bed, as a plaque set into the paper: its thick edge
 * showing along the bottom, then the grout, then a recessed socket for
 * every square - a hole waiting for a tile, the opposite of a raised tile.
 * Never changes while a puzzle is open. */
const Bed = React.memo(function BedImpl({ puzzle, geometry }: { puzzle: MosaicPuzzle; geometry: MosaicBoardGeometry }) {
  const { cellSize, pad } = geometry;
  const gap = cellSize * GROUT_GAP;
  const socket = cellSize - gap * 2;
  const slab = Math.max(2.5, cellSize * 0.12);
  const sink = Math.max(1.5, cellSize * RECESS_DEPTH);
  const edges: React.JSX.Element[] = [];
  const beds: React.JSX.Element[] = [];
  const sockets: React.JSX.Element[] = [];
  puzzle.silhouette.forEach((line, row) =>
    line.forEach((inside, col) => {
      if (!inside) return;
      const x = pad + col * cellSize;
      const y = pad + row * cellSize;
      edges.push(<RoundedRect key={`e-${row}-${col}`} x={x - 0.5} y={y - 0.5 + slab} width={cellSize + 1} height={cellSize + 1} r={2} color={bed().slabEdge} />);
      beds.push(<RoundedRect key={`b-${row}-${col}`} x={x - 0.5} y={y - 0.5} width={cellSize + 1} height={cellSize + 1} r={2} color={bed().grout} />);
      sockets.push(
        <Group key={`s-${row}-${col}`}>
          <RoundedRect x={x + gap} y={y + gap} width={socket} height={socket} r={socket * 0.2} color={bed().socketWall} />
          <RoundedRect x={x + gap + sink * 0.5} y={y + gap + sink * 0.8} width={socket - sink * 0.5} height={socket - sink * 0.8} r={socket * 0.18} color={bed().socket} />
          {/* By night a socket also wears a faint rim, so an empty place to
              fill can never be mistaken for the dark ground around it. */}
          {getColorScheme() === 'dark' && (
            <RoundedRect x={x + gap + 0.75} y={y + gap + 0.75} width={socket - 1.5} height={socket - 1.5} r={socket * 0.2} color="rgba(239,227,204,0.22)" style="stroke" strokeWidth={1.2} />
          )}
        </Group>,
      );
    }),
  );
  return (
    <Group>
      <PaperTray width={geometry.width} height={geometry.height} accent={theme.colors.mosaicAccent} />
      {edges}
      {beds}
      {sockets}
    </Group>
  );
});

interface PlacedProps {
  puzzle: MosaicPuzzle;
  state: MosaicState;
  geometry: MosaicBoardGeometry;
  hiddenIndex: number | null;
}

/** Every piece on the board except one being carried, painted in layers
 * across the whole board - every shadow, then every side, then every top. Re-renders only
 * on a move, never per frame. */
const Placed = React.memo(function PlacedImpl({ puzzle, state, geometry, hiddenIndex }: PlacedProps) {
  const { cellSize, pad } = geometry;
  const pieces = state.pieces
    .map((piece, index) => {
      if (!piece.at || index === hiddenIndex) return null;
      const cells = orient(puzzle.pieces[index].cells, piece).map(c => ({ row: c.row + piece.at!.row, col: c.col + piece.at!.col }));
      return { index, cells, color: pieceColor(puzzle, index), set: puzzle.fixed[index] };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  return (
    <Group transform={[{ translateX: pad }, { translateY: pad }]}>
      {(['shadow', 'sides', 'tops'] as const).map(part =>
        pieces.map(p => <Tesserae key={`${part}-${p.index}`} cells={p.cells} color={p.color} cellSize={cellSize} seed={p.index} shadow set={p.set} part={part} />),
      )}
    </Group>
  );
});

/** The finish: a band of light sweeping the finished picture on the
 * diagonal, each tile catching it in turn - the glaze coming out of the
 * kiln. Lands well inside the shared `SOLVE_CELEBRATION_MS` beat. */
const WAVE_MS = 520;
const WAVE_TILE_MS = 200;

export interface MosaicBoardViewProps {
  puzzle: MosaicPuzzle;
  state: MosaicState;
  geometry: MosaicBoardGeometry;
  /** A piece currently in the player's hand, not drawn on the board. */
  hiddenIndex?: number | null;
  /** Where a carried piece would land, drawn as a tinted outline. */
  ghost?: { cells: ReadonlyArray<MosaicCell>; color: string } | null;
  solved: boolean;
  /** A hinted piece, briefly ringed. */
  flashCells?: ReadonlyArray<MosaicCell> | null;
  /** The piece that has just been set, and when - it catches the light as
   * it lands. */
  landed?: { index: number; at: number } | null;
}

/** How long a freshly set piece glints. */
const LANDED_MS = 320;

export function MosaicBoardView({ puzzle, state, geometry, hiddenIndex = null, ghost = null, solved, flashCells = null, landed = null }: MosaicBoardViewProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const { cellSize, pad } = geometry;

  const solvedAtRef = useRef<number | null>(null);
  if (solved && solvedAtRef.current === null) solvedAtRef.current = Date.now();
  if (!solved) solvedAtRef.current = null;
  const now = Date.now();
  const span = puzzle.rows + puzzle.cols;
  const waving = !reducedMotion && solvedAtRef.current !== null && now - solvedAtRef.current < WAVE_MS + WAVE_TILE_MS;
  const glinting = !reducedMotion && landed !== null && now - landed.at < LANDED_MS;
  useAnimationClock(waving || glinting, 60);

  // A band of light crossing the piece that has just been set, left to
  // right - the glaze catching the light as it presses into the grout.
  const glint = useMemo(() => {
    if (!glinting || !landed) return null;
    const piece = state.pieces[landed.index];
    if (!piece?.at) return null;
    const cells = orient(puzzle.pieces[landed.index].cells, piece).map(c => ({ row: c.row + piece.at!.row, col: c.col + piece.at!.col }));
    const minCol = Math.min(...cells.map(c => c.col));
    const width = Math.max(...cells.map(c => c.col)) - minCol + 1;
    const t = (now - landed.at) / LANDED_MS;
    const gapPx = cellSize * GROUT_GAP;
    return cells.map(c => {
      // Each column lights as the band passes it.
      const local = t * (width + 1) - (c.col - minCol);
      const light = local > 0 && local < 1.4 ? Math.sin((local / 1.4) * Math.PI) : 0;
      if (light <= 0.01) return null;
      return (
        <RoundedRect
          key={`gl-${c.row}-${c.col}`}
          x={c.col * cellSize + gapPx}
          y={c.row * cellSize + gapPx}
          width={cellSize - gapPx * 2}
          height={cellSize - gapPx * 2}
          r={cellSize * 0.16}
          color="#FFFFFF"
          opacity={0.42 * light}
        />
      );
    });
    // `now` drives the glint frame by frame while it plays.
  }, [glinting, landed, now, state, puzzle, cellSize]);

  const sheen = useMemo(() => {
    if (!waving) return null;
    const elapsed = now - solvedAtRef.current!;
    const lights: React.JSX.Element[] = [];
    puzzle.silhouette.forEach((line, row) =>
      line.forEach((inside, col) => {
        if (!inside) return;
        const t = (elapsed - ((row + col) / span) * WAVE_MS) / WAVE_TILE_MS;
        if (t <= 0 || t >= 1) return;
        const gap = cellSize * GROUT_GAP;
        lights.push(
          <RoundedRect
            key={`l-${row}-${col}`}
            x={col * cellSize + gap}
            y={row * cellSize + gap}
            width={cellSize - gap * 2}
            height={cellSize - gap * 2}
            r={cellSize * 0.16}
            color="#FFFFFF"
            opacity={0.55 * Math.sin(t * Math.PI)}
          />,
        );
      }),
    );
    return lights;
    // `now` drives the wave frame by frame while `waving`.
  }, [waving, now, puzzle, cellSize, span]);

  const gap = cellSize * GROUT_GAP;
  return (
    <Group>
      <Bed puzzle={puzzle} geometry={geometry} />
      {ghost && (
        <Group transform={[{ translateX: pad }, { translateY: pad }]}>
          {/* Where the piece will land: its own glaze, faint, with a crisp
              edge - so the target reads at a glance under a moving hand. */}
          {ghost.cells.map(c => (
            <Group key={`g-${c.row}-${c.col}`}>
              <RoundedRect x={c.col * cellSize + gap} y={c.row * cellSize + gap} width={cellSize - gap * 2} height={cellSize - gap * 2} r={cellSize * 0.16} color={ghost.color} opacity={0.22} />
              <RoundedRect
                x={c.col * cellSize + gap + 0.75}
                y={c.row * cellSize + gap + 0.75}
                width={cellSize - gap * 2 - 1.5}
                height={cellSize - gap * 2 - 1.5}
                r={cellSize * 0.16}
                color={ghost.color}
                opacity={0.7}
                style="stroke"
                strokeWidth={1.5}
              />
            </Group>
          ))}
        </Group>
      )}
      <Placed puzzle={puzzle} state={state} geometry={geometry} hiddenIndex={hiddenIndex} />
      {flashCells && (
        <Group transform={[{ translateX: pad }, { translateY: pad }]}>
          {flashCells.map(c => (
            <RoundedRect
              key={`f-${c.row}-${c.col}`}
              x={c.col * cellSize + 1}
              y={c.row * cellSize + 1}
              width={cellSize - 2}
              height={cellSize - 2}
              r={cellSize * 0.2}
              color={theme.colors.accent}
              style="stroke"
              strokeWidth={2.5}
            />
          ))}
        </Group>
      )}
      {glint && <Group transform={[{ translateX: pad }, { translateY: pad }]}>{glint}</Group>}
      {sheen && <Group transform={[{ translateX: pad }, { translateY: pad }]}>{sheen}</Group>}
    </Group>
  );
}
