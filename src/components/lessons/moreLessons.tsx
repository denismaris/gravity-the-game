import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { ArukonePuzzle, ArukoneState, isArukoneSolved, isPathComplete, mirrorPairOf, pairFor } from '../../game/arukone';
import { MosaicPuzzle, MosaicState, initialMosaicState, isMosaicSolved, placePiece, placedCells, rotatePiece } from '../../game/mosaic';
import { Direction, GameState, StaticCellType, applyGravity, isPuzzleSolved } from '../../game/engine';
import { AdjacentCoord, AdjacentPuzzle, AdjacentState, applyTap, groupAt } from '../../game/adjacent';
import { BridgesPuzzle, BridgesState, bridgeLinks, cycleBridge, isBridgesSolved } from '../../game/bridges';
import { accentColorForKind } from '../../game/journey';
import { AdjacentBoard } from '../AdjacentBoard';
import { ArukoneBoard } from '../ArukoneBoard';
import { AdjacentAnimation } from '../AdjacentBoardView';
import { BridgesBoard } from '../BridgesBoard';
import { GravityBoard } from '../GravityBoard';
import { GravityHintArrow } from '../GravityHintArrow';
import { useSwipeGesture } from '../useSwipeGesture';
import { MosaicPlay } from '../MosaicPlay';
import { LessonShell, LessonStepCopy, useLessonFlow } from './LessonShell';

type Cell = { row: number; col: number };

// --- Adjacent ------------------------------------------------------------------------

const ADJ: AdjacentPuzzle = {
  id: 'lesson-adjacent',
  difficulty: 'easy',
  size: 4,
  colors: 3,
  initial: [
    [2, 1, 0, 0],
    [1, 2, 1, 1],
    [0, 0, 2, 2],
    [1, 1, 0, 0],
  ],
  targetScore: 100,
};
const ADJ_STEPS: ReadonlyArray<LessonStepCopy & { readonly from: Cell }> = [
  {
    title: 'Tap a group',
    say: 'Tap a tile that touches another tile of the same colour. The whole group disappears. Start with the pair at the bottom left.',
    hint: 'Tap a glowing tile.',
    praise: 'Gone! The tiles above fell down into the gap.',
    from: { row: 3, col: 0 },
  },
  {
    title: 'Big groups score big',
    say: 'Look, four of the same colour are together now. Big groups give you lots more points.',
    hint: 'Tap the glowing group of four.',
    praise: 'Four together scores much more than two pairs.',
    from: { row: 3, col: 0 },
  },
];

export function AdjacentLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState<AdjacentState>({ grid: ADJ.initial, score: 0, cascades: 0 });
  const [animation, setAnimation] = useState<AdjacentAnimation | null>(null);
  const flow = useLessonFlow(ADJ_STEPS.length);
  const step = ADJ_STEPS[flow.index];
  const live = flow.phase === 'doing';
  const group = useMemo<ReadonlyArray<AdjacentCoord>>(() => (live ? groupAt(state.grid, step.from.row, step.from.col) : []), [live, state.grid, step]);
  // Steady while the player is meant to act: blinking it meant redrawing
  // the whole board twice a second.
  const glow = live;

  const tap = useCallback(
    (row: number, col: number) => {
      if (flow.phase !== 'doing') return;
      if (!group.some(c => c.row === row && c.col === col)) return flow.wrong();
      const move = applyTap(state, row, col);
      if (!move) return;
      setAnimation({ at: Date.now(), removed: move.removed.map(c => ({ ...c, colour: state.grid[c.row][c.col] as number })), falls: move.falls });
      setState(move.state);
      flow.succeed();
    },
    [flow, group, state],
  );

  return (
    <LessonShell
      gameName="Adjacent"
      accent={accentColorForKind('adjacent')}
      steps={ADJ_STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => (
        <AdjacentBoard
          puzzle={ADJ}
          state={state}
          maxWidth={size}
          maxHeight={size}
          solved={false}
          preview={glow ? group : null}
          animation={animation}
          popups={[]}
          disabled={flow.phase !== 'doing'}
          onPressInCell={() => {}}
          onPressCell={tap}
          onPressCancel={() => {}}
        />
      )}
    />
  );
}

// --- Bridges -------------------------------------------------------------------------

const ISLANDS = [
  { row: 0, col: 0, need: 1 },
  { row: 0, col: 2, need: 3 },
  { row: 2, col: 2, need: 2 },
];
const linksOf = bridgeLinks({ rows: 3, cols: 3, islands: ISLANDS });
const linkBetween = (a: number, b: number) => linksOf.findIndex(l => (l.a === a && l.b === b) || (l.a === b && l.b === a));
const TOP = linkBetween(0, 1);
const SIDE = linkBetween(1, 2);
const BRIDGES: BridgesPuzzle = {
  id: 'lesson-bridges',
  difficulty: 'easy',
  rows: 3,
  cols: 3,
  islands: ISLANDS,
  solution: linksOf.map((_l, i) => (i === TOP ? 1 : i === SIDE ? 2 : 0)),
};
const BRIDGE_STEPS: ReadonlyArray<LessonStepCopy & { readonly link: number; readonly count: number }> = [
  {
    title: 'Build a bridge',
    say: 'Bridges join islands in straight lines. Tap the water between two islands to build one. The 1 needs one bridge.',
    hint: 'Tap the glowing water between the two top islands.',
    praise: 'The 1 has its bridge, so it raises a flag.',
    link: TOP,
    count: 1,
  },
  {
    title: 'Doubles count twice',
    say: 'Two islands can share two bridges. The 2 has only one neighbour, so both its bridges go there.',
    hint: 'Tap the glowing water two times.',
    praise: 'Every island has its bridges, and they are all joined. You did it!',
    link: SIDE,
    count: 2,
  },
];

export function BridgesLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState<BridgesState>({ bridges: linksOf.map(() => 0) });
  const flow = useLessonFlow(BRIDGE_STEPS.length);
  const step = BRIDGE_STEPS[flow.index];
  // Steady while the player is meant to act: blinking it meant redrawing
  // the whole board twice a second.
  const glow = flow.phase === 'doing';
  const build = useCallback(
    (link: number) => {
      if (flow.phase !== 'doing') return;
      if (link !== step.link) return flow.wrong();
      const next = cycleBridge(BRIDGES, state, link);
      setState(next);
      if (next.bridges[link] === step.count) flow.succeed();
    },
    [flow, step, state],
  );
  return (
    <LessonShell
      gameName="Bridges"
      accent={accentColorForKind('bridges')}
      steps={BRIDGE_STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => (
        <BridgesBoard
          puzzle={BRIDGES}
          state={state}
          size={size}
          solved={isBridgesSolved(BRIDGES, state)}
          onLane={link => build(link)}
          onTapLane={link => build(link)}
          flashLink={glow ? step.link : null}
        />
      )}
    />
  );
}

// --- Twinpath -----------------------------------------------------------------------

const C = (row: number, col: number) => ({ row, col });
/** Folded down the middle: the 1s and their twin 2s inside, and the 3s
 * (each other's mirror image) wrapped round the outside. */
const TWIN: ArukonePuzzle = {
  id: 'lesson-twinpath',
  difficulty: 'easy',
  size: 4,
  axis: 'vertical',
  obstacles: [],
  pairs: [
    { value: 1, a: C(0, 1), b: C(2, 1) },
    { value: 2, a: C(0, 2), b: C(2, 2) },
    { value: 3, a: C(0, 0), b: C(0, 3) },
  ],
  solution: {
    1: [C(0, 1), C(1, 1), C(2, 1)],
    2: [C(0, 2), C(1, 2), C(2, 2)],
    3: [C(0, 0), C(1, 0), C(2, 0), C(3, 0), C(3, 1), C(3, 2), C(3, 3), C(2, 3), C(1, 3), C(0, 3)],
  },
};
const TWIN_STEPS: ReadonlyArray<LessonStepCopy & { readonly value: number }> = [
  {
    title: 'Draw, and it mirrors',
    say: 'Join each pair of matching numbers with a path. The board is a mirror, so when you draw on one side, the other side copies it.',
    hint: 'Drag from the top 1 down to the other 1.',
    praise: 'You drew one path and got two. The 2s joined by themselves.',
    value: 1,
  },
  {
    title: 'Meet in the middle',
    say: 'The two 3s copy each other, so you only draw half. Reach the middle and the path joins up. Every square must be filled.',
    hint: 'Drag from the top left 3 down the side and along the bottom.',
    praise: 'Every pair joined and every square filled. You did it!',
    value: 3,
  },
];

export function TwinpathLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState<ArukoneState>({ paths: {} });
  const [short, setShort] = useState(false);
  const flow = useLessonFlow(TWIN_STEPS.length, () => setShort(false));
  const step = TWIN_STEPS[flow.index];
  const steps = useMemo(
    () => TWIN_STEPS.map((s, i) => (i === flow.index && short ? { ...s, hint: 'Joined, but some squares are still empty. Go back and go around the outside.' } : s)),
    [flow.index, short],
  );

  const change = useCallback(
    (next: ArukoneState) => {
      if (flow.phase !== 'doing') return;
      const pair = pairFor(TWIN, step.value);
      const twin = pair && mirrorPairOf(TWIN, pair);
      // Only the pair this step is about may move.
      const moved = Object.keys(next.paths).map(Number).filter(v => next.paths[v] !== state.paths[v]);
      if (moved.some(v => v !== step.value && v !== twin?.value)) return flow.wrong();
      setState(next);
      if (!pair || !isPathComplete(pair, next.paths[step.value] ?? [])) return setShort(false);
      if (flow.index === TWIN_STEPS.length - 1 && !isArukoneSolved(TWIN, next)) return setShort(true);
      flow.succeed();
    },
    [flow, step, state],
  );

  return (
    <LessonShell
      gameName="Twinpath"
      accent={accentColorForKind('arukone')}
      steps={steps}
      {...flow}
      onDone={onDone}
      renderBoard={size => <ArukoneBoard puzzle={TWIN} state={state} size={size} solved={isArukoneSolved(TWIN, state)} onChange={change} onReject={flow.wrong} />}
    />
  );
}

// --- Mosaic -------------------------------------------------------------------------

const MOSAIC_LESSON: MosaicPuzzle = {
  id: 'lesson-mosaic',
  difficulty: 'easy',
  subject: 'lesson',
  theme: 'garden',
  rows: 3,
  cols: 3,
  silhouette: [
    [true, true, true],
    [true, true, true],
    [true, true, true],
  ],
  pieces: [
    { id: 'square', cells: [C(0, 0), C(0, 1), C(1, 0), C(1, 1)], color: 0 },
    { id: 'bar', cells: [C(0, 0), C(0, 1), C(0, 2)], color: 1 },
    { id: 'pair', cells: [C(0, 0), C(0, 1)], color: 2 },
  ],
  solution: [
    { row: 0, col: 0, rotation: 0, flipped: false },
    { row: 0, col: 2, rotation: 1, flipped: false },
    { row: 2, col: 0, rotation: 0, flipped: false },
  ],
  start: [
    { rotation: 0, flipped: false },
    { rotation: 0, flipped: false },
    { rotation: 0, flipped: false },
  ],
  allowFlip: false,
  fixed: [false, false, false],
};
/** Where piece `index` belongs, as board squares. */
const goalCells = (index: number) => placedCells(MOSAIC_LESSON, index, MOSAIC_LESSON.solution[index]);
const MOSAIC_STEPS: ReadonlyArray<LessonStepCopy & { readonly piece: number }> = [
  {
    title: 'Fill the picture',
    say: 'Fill the empty squares of the picture with the pieces from the tray. Drag a piece up and let go where it fits.',
    hint: 'Drag the square into the glowing corner.',
    praise: 'It clicks into place. One piece done.',
    piece: 0,
  },
  {
    title: 'Turn to fit',
    say: 'You can turn pieces. Tap a piece in the tray to turn it, then drag it in.',
    hint: 'Tap the long piece to stand it up, then drag it to the glowing column.',
    praise: 'Turned, and in.',
    piece: 1,
  },
  {
    title: 'The last gap',
    say: 'Only one piece is left, so there is only one place for it. Fill every square to finish.',
    hint: 'Drag the last piece into the gap.',
    praise: 'Every square filled. You did it!',
    piece: 2,
  },
];

export function MosaicLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState<MosaicState>(() => initialMosaicState(MOSAIC_LESSON));
  const flow = useLessonFlow(MOSAIC_STEPS.length);
  const step = MOSAIC_STEPS[flow.index];
  // Steady while the player is meant to act: blinking it meant redrawing
  // the whole board twice a second.
  const glow = flow.phase === 'doing';

  const place = useCallback(
    (index: number, row: number, col: number) => {
      if (flow.phase !== 'doing') return;
      if (index !== step.piece) return flow.wrong();
      // Only where it belongs - but a drop within a square of it snaps in:
      // landing a piece exactly was the fiddly part.
      const goal = MOSAIC_LESSON.solution[index];
      const turnedRight = state.pieces[index].rotation % 2 === goal.rotation % 2;
      if (!turnedRight || Math.abs(row - goal.row) > 1 || Math.abs(col - goal.col) > 1) return flow.wrong();
      const next = placePiece(MOSAIC_LESSON, { pieces: state.pieces.map((p, i) => (i === index ? { ...p, rotation: goal.rotation } : p)) }, index, goal.row, goal.col);
      if (next === state) return flow.wrong();
      setState(next);
      flow.succeed();
    },
    [flow, step, state],
  );
  const rotate = useCallback(
    (index: number) => {
      if (flow.phase !== 'doing' || index !== step.piece) return flow.wrong();
      setState(s => rotatePiece(MOSAIC_LESSON, s, index));
    },
    [flow, step],
  );

  return (
    <LessonShell
      gameName="Mosaic"
      accent={accentColorForKind('mosaic')}
      steps={MOSAIC_STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => (
        <MosaicPlay
          puzzle={MOSAIC_LESSON}
          state={state}
          width={size}
          maxBoardHeight={size * 0.56}
          solved={isMosaicSolved(MOSAIC_LESSON, state)}
          flashCells={glow ? goalCells(step.piece) : null}
          onPlace={place}
          onLift={() => {}}
          onRotate={rotate}
        />
      )}
    />
  );
}

// --- Gravity ------------------------------------------------------------------------

/** A 5 by 5 board from a picture: o a piece, x a target, # a wall. */
function gravityBoard(rows: ReadonlyArray<string>): GameState {
  const movables: GameState['movables'][number][] = [];
  const staticGrid = rows.map((line, row) =>
    [...line].map((ch, col) => {
      if (ch === 'o') movables.push({ id: `p${row}${col}`, row, col });
      return ch === 'x' ? StaticCellType.Target : ch === '#' ? StaticCellType.Obstacle : StaticCellType.Empty;
    }),
  );
  return { rows: rows.length, cols: rows[0].length, staticGrid, movables, portals: [], zone: null };
}
const GRAVITY_STEPS: ReadonlyArray<LessonStepCopy & { readonly board: GameState; readonly direction: Direction }> = [
  {
    title: 'Swipe to tilt',
    say: 'Swipe the board and the ball rolls that way. It keeps rolling until something stops it. Roll the ball onto its ring.',
    hint: 'Swipe down anywhere on the board.',
    praise: 'Down it rolled, right onto the ring.',
    board: gravityBoard(['..o..', '.....', '.....', '.....', '..x..']),
    direction: 'down',
  },
  {
    title: 'Walls stop a slide',
    say: 'A ball never stops by itself. It rolls to the edge, or until it hits a wall. Here, the wall stops it right on the ring.',
    hint: 'Swipe right.',
    praise: 'The wall stopped it right on the ring.',
    board: gravityBoard(['.....', '.....', 'o..x#', '.....', '.....']),
    direction: 'right',
  },
  {
    title: 'Everything rolls at once',
    say: 'One swipe moves every ball. Each ball stops at whatever is in its way. Think about all of them together.',
    hint: 'Swipe down and watch both balls.',
    praise: 'One swipe, two balls home. That is the whole game!',
    board: gravityBoard(['.o.o.', '.....', '...x.', '...#.', '.x...']),
    direction: 'down',
  },
];

export function GravityLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState<GameState>(GRAVITY_STEPS[0].board);
  const [arrow, setArrow] = useState(0);
  const [animating, setAnimating] = useState(false);
  const flow = useLessonFlow(GRAVITY_STEPS.length, i => setState(GRAVITY_STEPS[i].board));
  const step = GRAVITY_STEPS[flow.index];

  // The arrow pulses the way to swipe, again every couple of seconds.
  const doing = flow.phase === 'doing';
  useEffect(() => {
    if (!doing) return;
    const id = setInterval(() => setArrow(n => n + 1), 2200);
    return () => clearInterval(id);
  }, [doing]);

  const swipe = useCallback(
    (direction: Direction) => {
      if (flow.phase !== 'doing') return;
      if (direction !== step.direction) return flow.wrong();
      setAnimating(true);
      setState(applyGravity(state, direction));
      flow.succeed();
    },
    [flow, step, state],
  );
  const handlers = useSwipeGesture(swipe);
  const onTarget = useMemo(
    () => new Set(state.movables.filter(m => state.staticGrid[m.row][m.col] === StaticCellType.Target).map(m => m.id)),
    [state],
  );

  return (
    <LessonShell
      gameName="Gravity"
      accent={accentColorForKind('gravity')}
      steps={GRAVITY_STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => (
        <View style={{ width: size, height: size }} {...handlers}>
          {/* Keyed by step, so a new board appears rather than sliding in. */}
          <GravityBoard
            key={flow.index}
            state={state}
            instant={false}
            size={size}
            onTargetIds={onTarget}
            solved={isPuzzleSolved(state) && !animating}
            onAnimatingChange={setAnimating}
          />
          {doing && <GravityHintArrow key={`${flow.index}-${arrow}`} size={size} direction={step.direction} onDone={() => {}} />}
        </View>
      )}
    />
  );
}
