import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { Circle, DashPathEffect, Group, Line, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { FolioFold, FolioInk, FolioPuzzle, FolioSheet, flatSheet, foldingSide, sheetOf, topInks, underInks } from '../game/folio';
import { DealClock, DealIn, dealDelay, DEAL_TOTAL_MS, useDealing, useReducedMotion } from '../game/rendering';
import { theme } from '../theme';
import { curve } from '../theme/motion';
import { mix } from './GameEmblem';

/** One fold, start to finish. */
export const FOLD_MS = 380;
/** The sheet's glide back to the middle of its bed, alongside the fold. */
const GLIDE_MS = 420;
/** The finish: the folded sheet lifts once its last fold lands. */
const LIFT_DELAY_MS = FOLD_MS - 30;
const LIFT_MS = 420;
/** A fold's curve: it lifts quickly, then lays down gently. */
const FOLD_EASING = Easing.bezier(0.42, 0, 0.2, 1);

export function inkColor(ink: FolioInk): string {
  switch (ink) {
    case 'paper':
      return theme.colors.folioPaper;
    case 'vermilion':
      return theme.colors.folioVermilion;
    case 'indigo':
      return theme.colors.folioIndigo;
    case 'saffron':
      return theme.colors.folioSaffron;
  }
}

/** The pressed-paper edge under a face: the same ink, in shadow. */
export function edgeColor(ink: FolioInk): string {
  return mix(inkColor(ink), theme.colors.shadow, ink === 'paper' ? 0.24 : 0.34);
}

export interface FolioGeometry {
  /** One square's pitch. */
  readonly cell: number;
  /** Room between squares. */
  readonly gap: number;
  /** The bed the sheet lies on, sized for the flat sheet. */
  readonly bedWidth: number;
  readonly bedHeight: number;
  /** Where a sheet of this shape lies, centred on the bed. */
  readonly originOf: (sheet: Pick<FolioSheet, 'width' | 'height'>) => { x: number; y: number };
}

/** Shared by the drawing and the touch layer (`FolioBoard`), so the creases
 * a finger finds are the creases drawn. */
export function folioGeometry(puzzle: Pick<FolioPuzzle, 'width' | 'height'>, width: number, height: number): FolioGeometry {
  const pad = Math.max(18, Math.min(26, Math.round(width * 0.06)));
  const cell = Math.max(24, Math.floor(Math.min((width - pad * 2) / puzzle.width, (height - pad * 2) / puzzle.height, 96)));
  const gap = Math.max(5, Math.round(cell * 0.085));
  const bedWidth = cell * puzzle.width + pad * 2;
  const bedHeight = cell * puzzle.height + pad * 2;
  return {
    cell,
    gap,
    bedWidth,
    bedHeight,
    originOf: sheet => ({ x: (bedWidth - sheet.width * cell) / 2, y: (bedHeight - sheet.height * cell) / 2 - 2 }),
  };
}

/** How thick a stack of `layers` squares stands. */
function lipOf(layers: number, size: number): number {
  return Math.min(Math.round(size * 0.11), 3 + (layers - 1) * 2);
}

/** A square's turned-up corner, worked out once per square: the strings
 * stay the same, so a square that is not touched by a move is not redrawn. */
function cornerPaths(x: number, y: number, size: number) {
  const ear = size * 0.28;
  const right = x + size;
  const fold = `M ${right - ear} ${y} L ${right} ${y + ear}`;
  return {
    // The bed showing where the corner left the paper.
    gone: `M ${right - ear - 0.5} ${y - 0.5} L ${right + 0.5} ${y - 0.5} L ${right + 0.5} ${y + ear + 0.5} Z`,
    // The corner's soft shadow on the face below it.
    shadow: `M ${right - ear} ${y + 1} L ${right} ${y + ear + 1} L ${right - ear * 0.55} ${y + ear * 1.12} Q ${right - ear * 1.08} ${y + ear * 1.1} ${right - ear * 1.04} ${y + ear * 0.5} Z`,
    // The turned corner itself, curling a little at its tip.
    flap: `M ${right - ear} ${y} L ${right} ${y + ear} L ${right - ear * 0.62} ${y + ear * 0.98} Q ${right - ear * 1.0} ${y + ear * 0.98} ${right - ear} ${y + ear * 0.6} Z`,
    crease: fold,
  };
}

interface SquareProps {
  x: number;
  y: number;
  size: number;
  ink: FolioInk;
  /** What turning it over would show: drawn on its turned-up corner. */
  under: FolioInk | null;
  layers: number;
  /** Drawn by the fold in flight instead, for now. */
  hidden?: boolean;
}

/**
 * One square of the sheet: a painted face on its own pressed edge, which
 * grows a page line for every square folded under it, and a corner turned
 * up to show the colour on its back.
 */
// No animated transform on a square of its own: under one, Skia dropped
// the turned corners (paths) for as long as anything else on the board
// moved. Everything that moves the sheet moves it as a whole.
const Square = React.memo(function SquareImpl({ x, y, size, ink, under, layers, hidden = false }: SquareProps) {
  const r = size * 0.1;
  const lip = lipOf(layers, size);
  const face = inkColor(ink);
  const edge = edgeColor(ink);
  const paths = useMemo(() => cornerPaths(x, y, size), [x, y, size]);
  const pages: React.JSX.Element[] = [];
  const shown = Math.min(layers, 5);
  for (let i = 1; i < shown; i += 1) {
    const py = y + size + (lip * i) / shown;
    pages.push(<Line key={`p-${i}`} p1={vec(x + r * 0.6, py)} p2={vec(x + size - r * 0.6, py)} color={mix(edge, theme.colors.folioPaper, 0.5)} strokeWidth={1} />);
  }
  return (
    <Group opacity={hidden ? 0 : 1}>
      <RoundedRect x={x} y={y + lip} width={size} height={size} r={r} color={edge} />
      {pages}
      <RoundedRect x={x} y={y} width={size} height={size} r={r} color={face} />
      {under && (
        <Group>
          <Path path={paths.gone} color={theme.colors.folioBed} />
          <Path path={paths.shadow} color={theme.colors.shadow} opacity={0.14} />
          <Path path={paths.flap} color={inkColor(under)} />
          <Path path={paths.crease} color={mix(inkColor(under), theme.colors.shadow, 0.28)} style="stroke" strokeWidth={1} />
        </Group>
      )}
    </Group>
  );
});

/**
 * Where the square at (`row`, `col`) of `sheet` sits on the flat sheet.
 * Everything is drawn in these coordinates under the sheet's one glide, so
 * a square keeps its place (and its component) for the whole board, and a
 * fold only redraws the squares it touches.
 */
function flatSpot(sheet: FolioSheet, row: number, col: number): { row: number; col: number } {
  return { row: sheet.top + row, col: sheet.left + col };
}

/** Which squares of `sheet` turn over along `fold`. */
function flapTest(sheet: FolioSheet, fold: FolioFold): (row: number, col: number) => boolean {
  const low = foldingSide(sheet, fold) === 'low';
  return fold.axis === 'v' ? (_r, c) => (low ? c < fold.at : c >= fold.at) : (r, _c) => (low ? r < fold.at : r >= fold.at);
}

interface Motion {
  readonly key: number;
  /** The bigger of the two sheets: the one the flap belongs to. */
  readonly open: FolioSheet;
  readonly fold: FolioFold;
  /** Folding (the flap goes over) or opening out (the flap comes back). */
  readonly closing: boolean;
}

/**
 * The move between the board as it was drawn and the board as it is: one
 * fold added plays as a fold, one taken back as the fold opening out;
 * anything else (a restart, a hint that unfolds first) is simply drawn.
 */
function useFoldMotion(puzzle: FolioPuzzle, folds: ReadonlyArray<FolioFold>, still: boolean): [Motion | null, (key: number) => void] {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const ref = useRef<{ folds: ReadonlyArray<FolioFold>; motion: Motion | null; seq: number }>({ folds, motion: null, seq: 0 });
  if (ref.current.folds !== folds) {
    const before = ref.current.folds;
    ref.current.folds = folds;
    ref.current.motion = null;
    const same = (n: number) => before.slice(0, n).every((f, i) => f.axis === folds[i].axis && f.at === folds[i].at);
    if (!still && folds.length === before.length + 1 && same(before.length)) {
      ref.current.seq += 1;
      ref.current.motion = { key: ref.current.seq, open: sheetOf(puzzle, { folds: before }), fold: folds[folds.length - 1], closing: true };
    } else if (!still && before.length === folds.length + 1 && same(folds.length)) {
      ref.current.seq += 1;
      ref.current.motion = { key: ref.current.seq, open: sheetOf(puzzle, { folds }), fold: before[before.length - 1], closing: false };
    }
  }
  const finish = useCallback((key: number) => {
    if (ref.current.motion?.key !== key) return;
    ref.current.motion = null;
    redraw();
  }, []);
  return [ref.current.motion, finish];
}

/**
 * The flap in flight: the turning side of the open sheet, scaled about the
 * crease from flat (1) through edge-on (0) to laid over (-1). It shows its
 * faces until it stands up and its backs after, comes up toward the eye a
 * little as it turns, and casts a shadow on the paper it is about to cover.
 * Mounted fresh for every move, so its clock always starts at the start.
 */
function FlapFlight({ puzzle, geometry, motion, onDone }: { puzzle: FolioPuzzle; geometry: FolioGeometry; motion: Motion; onDone: (key: number) => void }): React.JSX.Element {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: FOLD_MS, easing: FOLD_EASING });
    const timer = setTimeout(() => onDone(motion.key), FOLD_MS + 16);
    return () => clearTimeout(timer);
    // One flight per mount (it is keyed on the move).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { cell, gap } = geometry;
  const { open, fold, closing } = motion;
  const flap = flapTest(open, fold);
  const vertical = fold.axis === 'v';
  const crease = ((vertical ? open.left : open.top) + fold.at) * cell;
  const low = foldingSide(open, fold) === 'low';
  // The flap's own middle, across the crease: what it swells about.
  const span = vertical ? open.height : open.width;
  const across = ((vertical ? open.top : open.left) + span / 2) * cell;

  const turn = useDerivedValue(() => Math.cos(Math.PI * (closing ? progress.value : 1 - progress.value)));
  const transform = useDerivedValue(() => {
    const up = Math.sqrt(Math.max(0, 1 - turn.value * turn.value));
    const swell = 1 + 0.07 * up;
    return vertical
      ? [{ translateX: crease }, { scaleX: turn.value }, { translateX: -crease }, { translateY: across }, { scaleY: swell }, { translateY: -across }]
      : [{ translateY: crease }, { scaleY: turn.value }, { translateY: -crease }, { translateX: across }, { scaleX: swell }, { translateX: -across }];
  });
  const front = useDerivedValue(() => (turn.value >= 0 ? 1 : 0));
  const back = useDerivedValue(() => (turn.value < 0 ? 1 : 0));
  // Light on the flap: a little darker the more it stands edge-on.
  const dim = useDerivedValue(() => 0.2 * Math.sqrt(Math.max(0, 1 - turn.value * turn.value)));
  // The shadow it throws on the side it lands on: strongest just before
  // it lands, gone once it lies flat.
  const shadow = useDerivedValue(() => (turn.value < 0 ? 0.22 * Math.sin(Math.PI * Math.min(1, -turn.value)) : 0));
  const shadowTransform = useDerivedValue(() => {
    const t = Math.max(0, -turn.value);
    return vertical ? [{ translateX: crease }, { scaleX: -t }, { translateX: -crease }] : [{ translateY: crease }, { scaleY: -t }, { translateY: -crease }];
  });

  const tops = topInks(puzzle.squares, open);
  const unders = underInks(puzzle.squares, open);
  const faces: React.JSX.Element[] = [];
  const backs: React.JSX.Element[] = [];
  const shades: React.JSX.Element[] = [];
  const size = cell - gap;
  for (let r = 0; r < open.height; r += 1) {
    for (let c = 0; c < open.width; c += 1) {
      if (!flap(r, c)) continue;
      const spot = flatSpot(open, r, c);
      const x = spot.col * cell + gap / 2;
      const y = spot.row * cell + gap / 2;
      const i = r * open.width + c;
      faces.push(<Square key={`f${i}`} x={x} y={y} size={size} ink={tops[i]} under={null} layers={open.stacks[i].length} />);
      // The stack it lands on: its corner shows through on the flap's back,
      // drawn mirrored so that it lands the right way round.
      const mr = vertical ? r : 2 * fold.at - 1 - r;
      const mc = vertical ? 2 * fold.at - 1 - c : c;
      const below = mr >= 0 && mr < open.height && mc >= 0 && mc < open.width ? unders[mr * open.width + mc] : null;
      backs.push(<FlapBack key={`b${i}`} x={x} y={y} size={size} ink={unders[i]} corner={below} mirror={vertical ? 'x' : 'y'} />);
      shades.push(<RoundedRect key={`s${i}`} x={x} y={y} width={size} height={size} r={size * 0.1} color={theme.colors.shadow} />);
    }
  }
  // The flap's shadow falls a touch away from the crease, on the far side.
  const nudge = (low ? 1 : -1) * 3;

  return (
    <Group>
      <Group transform={shadowTransform} opacity={shadow}>
        <Group transform={vertical ? [{ translateX: -nudge }, { translateY: 3 }] : [{ translateY: -nudge + 3 }]}>{shades}</Group>
      </Group>
      <Group transform={transform}>
        <Group opacity={front}>{faces}</Group>
        <Group opacity={back}>{backs}</Group>
        <Group opacity={dim}>{shades}</Group>
      </Group>
    </Group>
  );
}

/** One square of a flap seen from behind, with the corner of the stack it
 * will land on - mirrored, since the flap turns it over on the way. */
function FlapBack({ x, y, size, ink, corner, mirror }: { x: number; y: number; size: number; ink: FolioInk; corner: FolioInk | null; mirror: 'x' | 'y' }): React.JSX.Element {
  const paths = useMemo(() => cornerPaths(x, y, size), [x, y, size]);
  const flip = mirror === 'x' ? [{ translateX: x + size / 2 }, { scaleX: -1 }, { translateX: -(x + size / 2) }] : [{ translateY: y + size / 2 }, { scaleY: -1 }, { translateY: -(y + size / 2) }];
  return (
    <Group>
      <RoundedRect x={x} y={y} width={size} height={size} r={size * 0.1} color={inkColor(ink)} />
      {corner && (
        <Group transform={flip}>
          <Path path={paths.gone} color={theme.colors.folioBed} />
          <Path path={paths.shadow} color={theme.colors.shadow} opacity={0.14} />
          <Path path={paths.flap} color={inkColor(corner)} />
        </Group>
      )}
    </Group>
  );
}

/** The creases still open on `sheet`: dashed folds with a pip off each end.
 * Mounted once a sheet has settled, and faded in. */
const Creases = React.memo(function CreasesImpl({ sheet, cell, preview, highlight, dealing }: { sheet: FolioSheet; cell: number; preview: FolioFold | null; highlight: FolioFold | null; dealing: DealClock }) {
  const fade = useSharedValue(0);
  // On a board just opened, not before its squares have been dealt.
  const opacity = useDerivedValue(() => fade.value * Math.max(0, Math.min(1, (dealing.value - (DEAL_TOTAL_MS - 220)) / 220)));
  useEffect(() => {
    fade.value = withTiming(1, { duration: 200, easing: curve.arrive });
    // Once, as the settled sheet's creases arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ox = sheet.left * cell;
  const oy = sheet.top * cell;
  const reach = 10;
  const ink = theme.colors.folioCrease;
  const lines: React.JSX.Element[] = [];
  const draw = (axis: 'v' | 'h', at: number) => {
    const lit = (preview?.axis === axis && preview.at === at) || (highlight?.axis === axis && highlight.at === at);
    const color = lit ? theme.colors.accent : ink;
    const [a, b] = axis === 'v' ? [vec(ox + at * cell, oy + 3), vec(ox + at * cell, oy + sheet.height * cell - 3)] : [vec(ox + 3, oy + at * cell), vec(ox + sheet.width * cell - 3, oy + at * cell)];
    const [p1, p2] = axis === 'v' ? [vec(a.x, oy - reach), vec(a.x, oy + sheet.height * cell + reach)] : [vec(ox - reach, a.y), vec(ox + sheet.width * cell + reach, a.y)];
    lines.push(
      <Group key={`${axis}${at}`}>
        <Line p1={a} p2={b} color={color} strokeWidth={lit ? 2.4 : 1.5} opacity={lit ? 1 : 0.4} strokeCap="round">
          <DashPathEffect intervals={[5, 5]} />
        </Line>
        <Circle c={p1} r={lit ? 4.5 : 3.6} color={color} opacity={lit ? 1 : 0.55} />
        <Circle c={p2} r={lit ? 4.5 : 3.6} color={color} opacity={lit ? 1 : 0.55} />
      </Group>,
    );
  };
  for (let at = 1; at < sheet.width; at += 1) draw('v', at);
  for (let at = 1; at < sheet.height; at += 1) draw('h', at);
  return <Group opacity={opacity}>{lines}</Group>;
});

/** The side a press is about to fold, lifted in shadow while the finger is down. */
function PreviewShade({ sheet, fold, cell, gap }: { sheet: FolioSheet; fold: FolioFold; cell: number; gap: number }): React.JSX.Element {
  const flap = flapTest(sheet, fold);
  let r0 = Infinity;
  let c0 = Infinity;
  let r1 = -Infinity;
  let c1 = -Infinity;
  for (let r = 0; r < sheet.height; r += 1) {
    for (let c = 0; c < sheet.width; c += 1) {
      if (!flap(r, c)) continue;
      r0 = Math.min(r0, r);
      c0 = Math.min(c0, c);
      r1 = Math.max(r1, r);
      c1 = Math.max(c1, c);
    }
  }
  const x = (sheet.left + c0) * cell + gap / 2 - 3;
  const y = (sheet.top + r0) * cell + gap / 2 - 3;
  return <RoundedRect x={x} y={y} width={(c1 - c0 + 1) * cell - gap + 6} height={(r1 - r0 + 1) * cell - gap + 6} r={cell * 0.14} color={theme.colors.accent} style="stroke" strokeWidth={2} opacity={0.9} />;
}

export interface FolioBoardViewProps {
  puzzle: FolioPuzzle;
  folds: ReadonlyArray<FolioFold>;
  geometry: FolioGeometry;
  solved: boolean;
  /** A crease to light (a hint, or a lesson step). */
  highlight?: FolioFold | null;
  /** The crease under the finger right now, if any. */
  preview?: FolioFold | null;
}

export function FolioBoardView({ puzzle, folds, geometry, solved, highlight = null, preview = null }: FolioBoardViewProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const dealing = useDealing();
  const [motion, finish] = useFoldMotion(puzzle, folds, reducedMotion);
  const sheet = useMemo(() => sheetOf(puzzle, { folds }), [puzzle, folds]);
  const { cell, gap, bedWidth, bedHeight } = geometry;
  const flat = useMemo(() => flatSheet(puzzle), [puzzle]);
  const flatOrigin = geometry.originOf(flat);

  // The whole sheet, in flat-sheet coordinates, glides as one so the
  // folded sheet always settles in the middle of its bed.
  const origin = geometry.originOf(sheet);
  const targetX = origin.x - sheet.left * cell;
  const targetY = origin.y - sheet.top * cell;
  const glideX = useSharedValue(targetX);
  const glideY = useSharedValue(targetY);
  useEffect(() => {
    if (reducedMotion) {
      glideX.value = targetX;
      glideY.value = targetY;
      return;
    }
    glideX.value = withTiming(targetX, { duration: GLIDE_MS, easing: curve.glide });
    glideY.value = withTiming(targetY, { duration: GLIDE_MS, easing: curve.glide });
    // Only a new resting place starts a glide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetX, targetY]);
  const lift = useSharedValue(0);
  const rim = useSharedValue(0);
  // The lift scales about the resting sheet's middle.
  const midX = origin.x + (sheet.width * cell) / 2;
  const midY = origin.y + (sheet.height * cell) / 2;
  const glide = useDerivedValue(() => {
    const k = 1 + 0.05 * lift.value;
    return [{ translateX: midX }, { translateY: midY }, { scale: k }, { translateX: glideX.value - midX }, { translateY: glideY.value - midY }];
  });

  // The finish: the folded sheet lifts toward the eye and settles, and a
  // gilt edge comes up round it, once the last fold has landed.
  useEffect(() => {
    if (!solved) {
      lift.value = 0;
      rim.value = 0;
      return;
    }
    if (reducedMotion) {
      rim.value = 1;
      return;
    }
    lift.value = withDelay(LIFT_DELAY_MS, withSequence(withTiming(1, { duration: LIFT_MS * 0.4, easing: curve.arrive }), withTiming(0, { duration: LIFT_MS * 0.6, easing: curve.glide })));
    rim.value = withDelay(LIFT_DELAY_MS + 60, withTiming(1, { duration: 260, easing: curve.arrive }));
    // Only the solve itself starts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  // What the resting layer shows: during a move, the open sheet with its
  // turning side left to the flap; otherwise the sheet as it is.
  const shown = motion ? motion.open : sheet;
  const hiddenTest = motion ? flapTest(motion.open, motion.fold) : null;
  const tops = topInks(puzzle.squares, shown);
  const unders = underInks(puzzle.squares, shown);
  const size = cell - gap;
  const farthest = puzzle.width + puzzle.height - 2;
  const squares: React.JSX.Element[] = [];
  for (let r = 0; r < shown.height; r += 1) {
    for (let c = 0; c < shown.width; c += 1) {
      const i = r * shown.width + c;
      const spot = flatSpot(shown, r, c);
      const x = spot.col * cell + gap / 2;
      const y = spot.row * cell + gap / 2;
      squares.push(
        <DealIn key={`${spot.row}:${spot.col}`} x={x + size / 2} y={y + size / 2} delay={dealDelay(spot.row + spot.col, farthest)} dealing={dealing}>
          <Square x={x} y={y} size={size} ink={tops[i]} under={unders[i]} layers={shown.stacks[i].length} hidden={hiddenTest ? hiddenTest(r, c) : false} />
        </DealIn>,
      );
    }
  }
  const deepest = Math.max(...sheet.stacks.map(s => s.length));

  return (
    <Group>
      {/* The bed: a sunk board the sheet lies on, edged like the trays. */}
      <RoundedRect x={0} y={2} width={bedWidth} height={bedHeight} r={24} color={theme.colors.folioBedEdge} />
      <RoundedRect x={0} y={0} width={bedWidth} height={bedHeight} r={24} color={theme.colors.folioBed} />
      {/* Where the flat sheet lay: a faint print of its outline, so a
          folded sheet is seen against the sheet it was. */}
      <RoundedRect x={flatOrigin.x + gap / 2 - 2} y={flatOrigin.y + gap / 2 - 2} width={flat.width * cell - gap + 4} height={flat.height * cell - gap + 4} r={cell * 0.13} color={theme.colors.folioBedEdge} style="stroke" strokeWidth={1.2} opacity={folds.length > 0 ? 0.7 : 0}>
        <DashPathEffect intervals={[2, 4]} />
      </RoundedRect>

      <Group transform={glide}>
        {squares}
        {motion && <FlapFlight key={motion.key} puzzle={puzzle} geometry={geometry} motion={motion} onDone={finish} />}
        {!motion && preview && !solved && <PreviewShade sheet={sheet} fold={preview} cell={cell} gap={gap} />}
        {!motion && !solved && <Creases key={`${sheet.left}:${sheet.top}:${sheet.width}x${sheet.height}`} sheet={sheet} cell={cell} preview={preview} highlight={highlight} dealing={dealing} />}
        {solved && !motion && (
          <RoundedRect
            x={sheet.left * cell + gap / 2 - 6}
            y={sheet.top * cell + gap / 2 - 6}
            width={sheet.width * cell - gap + 12}
            height={sheet.height * cell - gap + 12 + lipOf(deepest, size)}
            r={cell * 0.17}
            color={theme.colors.goldRim}
            style="stroke"
            strokeWidth={2.5}
            opacity={rim}
          />
        )}
      </Group>
    </Group>
  );
}
