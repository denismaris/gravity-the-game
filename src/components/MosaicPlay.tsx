/* eslint-disable react-native/no-inline-styles -- every position here is derived from the board's own geometry at render time */
import React, { useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, View } from 'react-native';
import { Canvas, Group, RoundedRect } from '@shopify/react-native-skia';
import { canPlace, MosaicCell, MosaicPuzzle, MosaicState, occupancy, orient } from '../game/mosaic';
import { useAnimationClock, useReducedMotion } from '../game/rendering';
import { theme } from '../theme';
import { mosaicGeometry, MosaicBoardView, pieceColor, Tesserae } from './MosaicBoardView';

export type MosaicFeedback = 'pickup' | 'place' | 'return' | 'turn';

export interface MosaicPlayProps {
  puzzle: MosaicPuzzle;
  state: MosaicState;
  /** Width available for the board and the tray. */
  width: number;
  /** Height the board itself may take - the tray sits below it. */
  maxBoardHeight: number;
  solved: boolean;
  flashCells?: ReadonlyArray<MosaicCell> | null;
  onPlace: (index: number, row: number, col: number) => void;
  onLift: (index: number) => void;
  onRotate: (index: number) => void;
  onFeedback?: (kind: MosaicFeedback) => void;
}

const TRAY_GAP = 18;
const SLOT_GAP = 8;
/** Tray slots grow with the room they have, up to this - big enough that
 * a piece reads at a glance and is easy to take hold of. */
const MAX_SLOT = 84;
/** How far above the finger a carried piece floats, in board squares - so
 * the finger never hides the piece it is placing. */
const LIFT_SQUARES = 1.1;
/** A touch that moves less than this is a tap (turn), not a drag. */
const TAP_SLOP = 7;
/** How much bigger a piece is while held - lifted off the paper. */
const HELD_SCALE = 1.06;
const SHADOW_X = 3;
const SHADOW_Y = 7;
/** A piece flying home to the tray. */
const RETURN_MS = 260;

interface Drag {
  readonly index: number;
  readonly from: 'tray' | 'board';
  /** Oriented squares of the carried piece. */
  readonly cells: ReadonlyArray<MosaicCell>;
  readonly color: string;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The tray's layout for `looseCount` pieces across `width`: up to six per
 * row, rows kept as even as possible. Shared with the screen, so the
 * height it budgets for the tray is always the tray's real height.
 */
export function mosaicTrayLayout(looseCount: number, width: number): { rows: number; perRow: number; slot: number; height: number } {
  const count = Math.max(1, looseCount);
  const rows = Math.ceil(count / 6);
  const perRow = Math.ceil(count / rows);
  const slot = Math.min(MAX_SLOT, (width - (perRow - 1) * SLOT_GAP) / perRow);
  return { rows, perRow, slot, height: TRAY_GAP + rows * slot + (rows - 1) * SLOT_GAP };
}

function extent(cells: ReadonlyArray<MosaicCell>): { w: number; h: number } {
  return { w: Math.max(...cells.map(c => c.col)) + 1, h: Math.max(...cells.map(c => c.row)) + 1 };
}

/**
 * Mosaic's play surface: the picture, the tray of pieces under it, and the
 * piece in the player's hand.
 *
 * One PanResponder owns the whole surface and every drawn child is
 * `pointerEvents="none"`, so `locationX/Y` is always measured against this
 * view (the lesson every hand-built board here has had to learn).
 *
 * The carried piece is its own small canvas in an Animated.View. Its box is
 * the piece plus an even margin on every side (room for its shadow and for
 * growing while held), and it scales about its own centre - so wherever it
 * is sent, the arithmetic is the same: put its centre on the target's
 * centre. Its position is the finger (`base`, set on every move) plus an
 * eased `glide` that starts at wherever the piece really was - the tray
 * slot, or its square on the board - and springs to nothing, so a piece
 * never teleports into the hand. On release the glide is folded into the
 * base first, so the flight home or into place starts exactly where the
 * piece visibly is.
 */
export function MosaicPlay({ puzzle, state, width, maxBoardHeight, solved, flashCells, onPlace, onLift, onRotate, onFeedback }: MosaicPlayProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const geometry = useMemo(() => mosaicGeometry(puzzle, width, maxBoardHeight), [puzzle, width, maxBoardHeight]);
  const { cellSize } = geometry;
  const boardX = (width - geometry.width) / 2;
  const boardY = 0;
  const margin = Math.round(cellSize * 0.5);

  // --- The tray: fixed slots, so nothing reflows as pieces come and go.
  // Only loose pieces have one - a set piece never leaves the picture. ---
  const loose = useMemo(() => puzzle.pieces.map((_p, i) => i).filter(i => !puzzle.fixed[i]), [puzzle]);
  const count = Math.max(1, loose.length);
  const { rows: trayRows, perRow, slot } = mosaicTrayLayout(loose.length, width);
  const maxExtent = useMemo(
    () => Math.max(...puzzle.pieces.map(p => Math.max(extent(p.cells).w, extent(p.cells).h))),
    [puzzle.pieces],
  );
  const trayCell = (slot * 0.84) / maxExtent;
  const trayTop = geometry.height + TRAY_GAP;
  const slotOrigin = (pieceIndex: number): Point => {
    const index = Math.max(0, loose.indexOf(pieceIndex));
    const row = Math.floor(index / perRow);
    const inRow = Math.min(perRow, count - row * perRow);
    const rowWidth = inRow * slot + (inRow - 1) * SLOT_GAP;
    const col = index % perRow;
    return { x: (width - rowWidth) / 2 + col * (slot + SLOT_GAP), y: trayTop + row * (slot + SLOT_GAP) };
  };
  const height = trayTop + trayRows * slot + (trayRows - 1) * SLOT_GAP;

  // --- The piece in hand -------------------------------------------------
  const [drag, setDrag] = useState<Drag | null>(null);
  const [ghost, setGhost] = useState<{ row: number; col: number } | null>(null);
  const [landed, setLanded] = useState<{ index: number; at: number } | null>(null);
  const base = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const glide = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useMemo(() => Animated.add(base.x, glide.x), [base, glide]);
  const translateY = useMemo(() => Animated.add(base.y, glide.y), [base, glide]);

  // Everything the responder reads, kept fresh in a ref: it is created
  // once, and must never act on a stale board.
  const live = useRef({ puzzle, state, geometry, boardX, boardY, solved, slotOrigin, slot, trayCell, reducedMotion, loose, margin, onPlace, onLift, onRotate, onFeedback });
  live.current = { puzzle, state, geometry, boardX, boardY, solved, slotOrigin, slot, trayCell, reducedMotion, loose, margin, onPlace, onLift, onRotate, onFeedback };

  const gesture = useRef<{
    pending: { index: number } | null;
    drag: Drag | null;
    grab: Point;
    start: Point;
    lift: number;
    /** The finger-driven top-left of the piece, as last set. */
    base: Point;
    target: { row: number; col: number } | null;
  }>({ pending: null, drag: null, grab: { x: 0, y: 0 }, start: { x: 0, y: 0 }, lift: 0, base: { x: 0, y: 0 }, target: null });

  /** Sets the finger-driven position: the piece's top-left, as a box. */
  const setBase = (topLeft: Point) => {
    const m = live.current.margin;
    gesture.current.base = topLeft;
    base.setValue({ x: topLeft.x - m, y: topLeft.y - m });
  };

  /**
   * Picks a piece up. `topLeft` is where the finger now holds it; `from` is
   * where it visibly was, at `fromScale` - the glide carries it from there
   * into the hand.
   */
  const beginDrag = (next: Drag, topLeft: Point, grab: Point, from: Point, fromScale: number) => {
    const g = gesture.current;
    g.drag = next;
    g.grab = grab;
    setBase(topLeft);
    glide.setValue({ x: from.x - topLeft.x, y: from.y - topLeft.y });
    scale.setValue(fromScale);
    const still = live.current.reducedMotion;
    Animated.parallel([
      Animated.spring(glide, { toValue: { x: 0, y: 0 }, useNativeDriver: false, speed: still ? 100 : 22, bounciness: 0 }),
      Animated.spring(scale, { toValue: HELD_SCALE, useNativeDriver: false, speed: still ? 100 : 20, bounciness: 5 }),
    ]).start();
    setDrag(next);
    live.current.onFeedback?.('pickup');
  };

  const updateTarget = (topLeft: Point) => {
    const { puzzle: p, state: s, geometry: geo, boardX: bx, boardY: by } = live.current;
    const g = gesture.current;
    if (!g.drag) return;
    // `+ 0` turns a -0 (a piece nudged a hair left of the first square)
    // into a plain 0 before it travels anywhere as a board coordinate.
    const col = Math.round((topLeft.x - bx - geo.pad) / geo.cellSize) + 0;
    const row = Math.round((topLeft.y - by - geo.pad) / geo.cellSize) + 0;
    const fits = canPlace(p, s, g.drag.index, row, col);
    const next = fits ? { row, col } : null;
    const same = (next === null && g.target === null) || (next && g.target && next.row === g.target.row && next.col === g.target.col);
    if (!same) {
      g.target = next;
      setGhost(next);
    }
  };

  const finish = () => {
    gesture.current.drag = null;
    gesture.current.target = null;
    setGhost(null);
    setDrag(null);
  };

  /** Folds whatever is left of the pick-up glide into the base, so a
   * flight starts from exactly where the piece is on screen. */
  const settleGlide = (): Point => {
    let left = { x: 0, y: 0 };
    glide.stopAnimation(value => {
      left = value as unknown as Point;
    });
    scale.stopAnimation();
    const g = gesture.current;
    const here = { x: g.base.x + left.x, y: g.base.y + left.y };
    setBase(here);
    glide.setValue({ x: 0, y: 0 });
    return here;
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !live.current.solved,
        onMoveShouldSetPanResponder: () => !live.current.solved,
        onPanResponderGrant: evt => {
          const { puzzle: p, state: s, geometry: geo, boardX: bx, boardY: by, slotOrigin: slotAt, slot: size, loose: free } = live.current;
          const x = evt.nativeEvent.locationX;
          const y = evt.nativeEvent.locationY;
          const g = gesture.current;
          g.start = { x, y };
          g.pending = null;
          g.target = null;

          // On the board: pick up whatever piece covers that square.
          const col = Math.floor((x - bx - geo.pad) / geo.cellSize);
          const row = Math.floor((y - by - geo.pad) / geo.cellSize);
          const owner = occupancy(p, s).get(`${row}:${col}`);
          // A set piece is part of the picture: it stays where it is.
          if (owner !== undefined && p.fixed[owner]) return;
          if (owner !== undefined) {
            const piece = s.pieces[owner];
            const cells = orient(p.pieces[owner].cells, piece);
            const onBoard = { x: bx + geo.pad + piece.at!.col * geo.cellSize, y: by + geo.pad + piece.at!.row * geo.cellSize };
            g.lift = LIFT_SQUARES * geo.cellSize;
            // It rises off its square into the hand, rather than jumping.
            beginDrag(
              { index: owner, from: 'board', cells, color: pieceColor(p, owner) },
              { x: onBoard.x, y: onBoard.y - g.lift },
              { x: x - onBoard.x, y: y - onBoard.y },
              onBoard,
              1,
            );
            return;
          }
          // In the tray: wait to see whether this is a tap or a drag.
          for (const i of free) {
            if (s.pieces[i].at) continue;
            const o = slotAt(i);
            if (x >= o.x && x <= o.x + size && y >= o.y && y <= o.y + size) {
              g.pending = { index: i };
              return;
            }
          }
        },
        onPanResponderMove: (_evt, gs) => {
          const { puzzle: p, state: s, geometry: geo, slotOrigin: slotAt, slot: size, trayCell: tc } = live.current;
          const g = gesture.current;
          const x = g.start.x + gs.dx;
          const y = g.start.y + gs.dy;
          if (!g.drag && g.pending && Math.hypot(gs.dx, gs.dy) > TAP_SLOP) {
            const index = g.pending.index;
            const cells = orient(p.pieces[index].cells, s.pieces[index]);
            const { w, h } = extent(cells);
            // Held by its middle, floating above the finger...
            const grab = { x: (w * geo.cellSize) / 2, y: (h * geo.cellSize) / 2 + LIFT_SQUARES * geo.cellSize };
            g.lift = 0;
            // ...and gliding there from its slot, growing from tray size.
            const o = slotAt(index);
            const fromSlot = { x: o.x + size / 2 - (w * geo.cellSize) / 2, y: o.y + size / 2 - (h * geo.cellSize) / 2 };
            beginDrag({ index, from: 'tray', cells, color: pieceColor(p, index) }, { x: x - grab.x, y: y - grab.y }, grab, fromSlot, tc / geo.cellSize);
            g.pending = null;
          }
          if (!g.drag) return;
          const topLeft = { x: x - g.grab.x, y: y - g.grab.y - g.lift };
          setBase(topLeft);
          updateTarget(topLeft);
        },
        onPanResponderRelease: () => release(),
        onPanResponderTerminate: () => release(true),
      }),
    // Built once - everything it reads comes through `live`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function release(cancelled = false): void {
    const { geometry: geo, boardX: bx, boardY: by, slotOrigin: slotAt, trayCell: tc, slot: size, reducedMotion: still } = live.current;
    const g = gesture.current;
    if (!g.drag) {
      if (g.pending && !cancelled) {
        live.current.onRotate(g.pending.index);
        live.current.onFeedback?.('turn');
      }
      g.pending = null;
      return;
    }
    const carried = g.drag;
    const target = cancelled ? null : g.target;
    settleGlide();
    const m = live.current.margin;

    if (target) {
      // Into place: a short, firm spring to the exact square, then it is set.
      const to = { x: bx + geo.pad + target.col * geo.cellSize - m, y: by + geo.pad + target.row * geo.cellSize - m };
      Animated.parallel([
        Animated.spring(base, { toValue: to, useNativeDriver: false, speed: still ? 100 : 30, bounciness: 4 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: false, speed: still ? 100 : 30, bounciness: 6 }),
      ]).start(() => {
        live.current.onPlace(carried.index, target.row, target.col);
        live.current.onFeedback?.('place');
        setLanded({ index: carried.index, at: Date.now() });
        finish();
      });
      return;
    }

    // Home to the tray: its centre to the slot's centre, shrinking to tray
    // size about that centre - which is exactly where the tray draws it, so
    // the hand-over at the end is seamless.
    if (carried.from === 'board') live.current.onLift(carried.index);
    const { w, h } = extent(carried.cells);
    const o = slotAt(carried.index);
    const to = { x: o.x + size / 2 - (w * geo.cellSize) / 2 - m, y: o.y + size / 2 - (h * geo.cellSize) / 2 - m };
    live.current.onFeedback?.('return');
    Animated.parallel([
      Animated.timing(base, { toValue: to, duration: still ? 0 : RETURN_MS, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }),
      Animated.timing(scale, { toValue: tc / geo.cellSize, duration: still ? 0 : RETURN_MS, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }),
    ]).start(() => finish());
  }

  const ghostCells = useMemo(() => {
    if (!drag || !ghost) return null;
    return { cells: drag.cells.map(c => ({ row: c.row + ghost.row, col: c.col + ghost.col })), color: drag.color };
  }, [drag, ghost]);

  const hiddenIndex = drag?.from === 'board' ? drag.index : null;
  const carriedExtent = drag ? extent(drag.cells) : { w: 0, h: 0 };

  return (
    <View style={{ width, height }} {...responder.panHandlers}>
      <View pointerEvents="none" style={{ position: 'absolute', left: boardX, top: boardY, width: geometry.width, height: geometry.height }}>
        <Canvas style={StyleSheet.absoluteFill}>
          <MosaicBoardView
            puzzle={puzzle}
            state={state}
            geometry={geometry}
            hiddenIndex={hiddenIndex}
            ghost={ghostCells}
            solved={solved}
            flashCells={flashCells}
            landed={landed}
          />
        </Canvas>
      </View>

      <Tray
        puzzle={puzzle}
        pieces={state.pieces}
        loose={loose}
        carried={drag?.index ?? null}
        top={trayTop}
        width={width}
        height={height - trayTop}
        slot={slot}
        perRow={perRow}
        trayCell={trayCell}
        reducedMotion={reducedMotion}
      />

      {drag && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: carriedExtent.w * cellSize + margin * 2,
            height: carriedExtent.h * cellSize + margin * 2,
            transform: [{ translateX }, { translateY }, { scale }],
          }}
        >
          <Canvas style={StyleSheet.absoluteFill}>
            <Group transform={[{ translateX: margin }, { translateY: margin }]}>
              {/* A flat shadow on the paper below the lifted piece - the
                  piece is off the board, and the shadow says how far. */}
              <Group transform={[{ translateX: SHADOW_X }, { translateY: SHADOW_Y }]} opacity={0.16}>
                {drag.cells.map(c => (
                  <RoundedRect key={`sh-${c.row}-${c.col}`} x={c.col * cellSize + 2} y={c.row * cellSize + 2} width={cellSize - 4} height={cellSize - 4} r={cellSize * 0.2} color={theme.colors.primary} />
                ))}
              </Group>
              <Tesserae cells={drag.cells} color={drag.color} cellSize={cellSize} seed={drag.index} />
            </Group>
          </Canvas>
        </Animated.View>
      )}
    </View>
  );
}

const TURN_MS = 220;
const SETTLE_MS = 280;

function easeOutBack(t: number): number {
  const c = 1.5;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

/**
 * The tray: every slot and every piece still in it, in *one* canvas.
 *
 * It used to be a small canvas per slot, each in its own animated view -
 * and on a real phone those could mount without painting (several fresh
 * canvases appearing together inside the screen's entrance fade), leaving
 * a piece invisible until a tap forced it to redraw. One canvas, like the
 * board's, has no such failure mode, and is lighter besides.
 *
 * A tapped piece still swings a quarter into its new facing, and a piece
 * sent home still settles with a small give: both are short windows on
 * this canvas's own clock, which runs only while one of them is playing.
 * Memoised on the moves themselves, so dragging a piece around the board
 * never redraws the tray.
 */
const Tray = React.memo(function TrayImpl({
  puzzle,
  pieces,
  loose,
  carried,
  top,
  width,
  height,
  slot,
  perRow,
  trayCell,
  reducedMotion,
}: {
  puzzle: MosaicPuzzle;
  pieces: MosaicState['pieces'];
  loose: ReadonlyArray<number>;
  carried: number | null;
  top: number;
  width: number;
  height: number;
  slot: number;
  perRow: number;
  trayCell: number;
  reducedMotion: boolean;
}): React.JSX.Element {
  const now = Date.now();
  const turnedAt = useRef(new Map<number, number>()).current;
  const settledAt = useRef(new Map<number, number>()).current;
  const previous = useRef<{ rotation: Map<number, number>; home: Map<number, boolean> } | null>(null);

  const home = (index: number) => pieces[index].at === null && carried !== index;
  if (!previous.current) {
    previous.current = { rotation: new Map(loose.map(i => [i, pieces[i].rotation])), home: new Map(loose.map(i => [i, home(i)])) };
  } else {
    for (const i of loose) {
      if (previous.current.rotation.get(i) !== pieces[i].rotation) turnedAt.set(i, now);
      if (home(i) && previous.current.home.get(i) === false) settledAt.set(i, now);
      previous.current.rotation.set(i, pieces[i].rotation);
      previous.current.home.set(i, home(i));
    }
  }

  const within = (map: Map<number, number>, windowMs: number) => [...map.values()].some(at => now - at < windowMs);
  useAnimationClock(!reducedMotion && (within(turnedAt, TURN_MS) || within(settledAt, SETTLE_MS)), 60);

  const rows = Math.ceil(Math.max(1, loose.length) / perRow);
  const slotAt = (position: number): { x: number; y: number } => {
    const row = Math.floor(position / perRow);
    const inRow = Math.min(perRow, loose.length - row * perRow);
    const rowWidth = inRow * slot + (inRow - 1) * SLOT_GAP;
    // Local to this canvas, which starts at `trayTop` - so no TRAY_GAP here:
    // it must land on exactly the squares `slotOrigin` hit-tests.
    return { x: (width - rowWidth) / 2 + (position % perRow) * (slot + SLOT_GAP), y: row * (slot + SLOT_GAP) };
  };

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top, width, height: Math.max(height, rows * slot) }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {loose.map((index, position) => {
          if (!home(index)) return null;
          const o = slotAt(position);
          const cells = orient(puzzle.pieces[index].cells, pieces[index]);
          const { w, h } = extent(cells);
          const turnT = reducedMotion ? 1 : Math.min(1, (now - (turnedAt.get(index) ?? -Infinity)) / TURN_MS);
          const settleT = reducedMotion ? 1 : Math.min(1, (now - (settledAt.get(index) ?? -Infinity)) / SETTLE_MS);
          const angle = turnT >= 1 ? 0 : (-Math.PI / 2) * (1 - easeOutBack(turnT));
          const scale = settleT >= 1 ? 1 : 0.9 + 0.1 * easeOutBack(settleT);
          const cx = o.x + slot / 2;
          const cy = o.y + slot / 2;
          return (
            <Group key={puzzle.pieces[index].id}>
              <RoundedRect x={o.x} y={o.y} width={slot} height={slot} r={12} color={theme.colors.mosaicSlotFill} />
              <RoundedRect x={o.x + 0.5} y={o.y + 0.5} width={slot - 1} height={slot - 1} r={12} color={theme.colors.border} style="stroke" strokeWidth={1} />
              <Group
                transform={[
                  { translateX: cx },
                  { translateY: cy },
                  { rotate: angle },
                  { scale },
                  { translateX: -(w * trayCell) / 2 },
                  { translateY: -(h * trayCell) / 2 },
                ]}
              >
                <Tesserae cells={cells} color={pieceColor(puzzle, index)} cellSize={trayCell} seed={index} />
              </Group>
            </Group>
          );
        })}
      </Canvas>
    </View>
  );
});

