import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { ArukonePuzzle, ArukoneState, beginDraw, extendDraw, isArukoneSolved, isPathComplete, mirrorPairOf, pairFor } from '../../game/arukone';
import { MosaicPuzzle, MosaicState, initialMosaicState, isMosaicSolved, placePiece, placedCells, rotatePiece } from '../../game/mosaic';
import { Direction, GameState, StaticCellType, applyGravity, isPuzzleSolved } from '../../game/engine';
import { AdjacentCoord, AdjacentPuzzle, AdjacentState, applyTap, groupAt } from '../../game/adjacent';
import { BridgesPuzzle, BridgesState, bridgeLinks, cycleBridge, isBridgesSolved } from '../../game/bridges';
import { TowersPuzzle, TowersState, setCell } from '../../game/towers';
import { accentColorForKind } from '../../game/journey';
import { theme, themedStyles } from '../../theme';
import { AdjacentBoard } from '../AdjacentBoard';
import { ArukoneBoard } from '../ArukoneBoard';
import { AdjacentAnimation } from '../AdjacentBoardView';
import { BridgesBoard } from '../BridgesBoard';
import { GravityBoard } from '../GravityBoard';
import { GravityHintArrow } from '../GravityHintArrow';
import { useSwipeGesture } from '../useSwipeGesture';
import { MosaicPlay } from '../MosaicPlay';
import { PressableScale } from '../PressableScale';
import { TowersBoard } from '../TowersBoard';
import { LessonShell, LessonStepCopy, useLessonFlow } from './LessonShell';

type Cell = { row: number; col: number };

// --- Skyscrapers --------------------------------------------------------------------

/** Solution 1 2 3 / 2 3 1 / 3 1 2. */
const TOWERS: TowersPuzzle = {
  id: 'lesson-towers',
  difficulty: 'easy',
  size: 3,
  topClues: [3, 2, 1],
  bottomClues: [1, 2, 2],
  leftClues: [3, 2, 1],
  rightClues: [1, 2, 2],
};
const TOWERS_START: TowersState = {
  values: [
    [1, 2, 0],
    [0, 3, 1],
    [0, 1, 2],
  ],
};
interface TowerStep extends LessonStepCopy {
  readonly cell: Cell;
  readonly height: number;
}
const TOWER_STEPS: ReadonlyArray<TowerStep> = [
  {
    title: 'Every height once',
    say: 'Each row and column holds every height once, like a sudoku. The top row already has a 1 and a 2.',
    hint: 'Tap the glowing square, then the height it needs.',
    praise: 'Only the 3 was missing from that row.',
    cell: { row: 0, col: 2 },
    height: 3,
  },
  {
    title: 'A 1 clue sees one tower',
    say: 'Clues count the towers you see from that side, and a tall tower hides the shorter ones behind it. A 1 means the tallest stands right next to the clue.',
    hint: 'Tap the glowing square beside the 1, then its height.',
    praise: 'The tallest tower, hiding the rest of its row.',
    cell: { row: 2, col: 0 },
    height: 3,
  },
  {
    title: 'A 3 clue sees them all',
    say: 'On a board of three, a 3 clue sees every tower, so from that side they climb 1, 2, 3 in order.',
    hint: 'Tap the glowing square, then its height.',
    praise: 'One, two, three: the clue can see every tower.',
    cell: { row: 1, col: 0 },
    height: 2,
  },
];

export function SkyscrapersLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState(TOWERS_START);
  const [selected, setSelected] = useState<Cell | null>(null);
  // The demo: the square chosen, then its height set.
  const flow = useLessonFlow(TOWER_STEPS.length, () => setSelected(null), 2);
  const step = TOWER_STEPS[flow.index];
  const shownState = flow.demoFrame === 1 ? setCell(state, step.cell.row, step.cell.col, step.height) : state;
  const shownSelected = flow.demoFrame === 0 ? step.cell : selected;
  // Steady while the player watches and acts: blinking it meant redrawing
  // the whole board twice a second.
  const glow = (flow.phase === 'doing' || flow.phase === 'watch') && !shownSelected && flow.demoFrame === null;

  const select = useCallback(
    (row: number, col: number) => {
      if (flow.phase !== 'doing') return;
      if (row !== step.cell.row || col !== step.cell.col) return flow.wrong();
      setSelected({ row, col });
    },
    [flow, step],
  );
  const choose = (height: number) => {
    if (flow.phase !== 'doing' || !selected) return;
    if (height !== step.height) return flow.wrong();
    setState(s => setCell(s, selected.row, selected.col, height));
    setSelected(null);
    flow.succeed();
  };

  return (
    <LessonShell
      gameName="Skyscrapers"
      accent={accentColorForKind('towers')}
      steps={TOWER_STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => (
        <View style={styles.towers}>
          <TowersBoard puzzle={TOWERS} state={shownState} size={size - 64} selected={shownSelected} onSelectCell={select} flashCell={glow ? step.cell : null} solved={flow.phase === 'done'} />
          <View style={styles.pad}>
            {[1, 2, 3].map(h => (
              <PressableScale
                key={h}
                accessibilityRole="button"
                accessibilityLabel={`Height ${h}`}
                onPress={() => choose(h)}
                style={({ pressed }) => [styles.key, shownSelected && styles.keyLive, flow.demoFrame === 1 && h === step.height && styles.keyPicked, pressed && styles.pressed]}
              >
                <Text style={styles.keyText}>{h}</Text>
              </PressableScale>
            ))}
          </View>
        </View>
      )}
    />
  );
}

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
    title: 'Tap a run',
    say: 'Tap any tile touching another of its own colour, and the whole connected run clears. Start with the pair in the bottom left.',
    hint: 'Tap a glowing tile.',
    praise: 'Cleared, and the tiles above fell straight down into the gap.',
    from: { row: 3, col: 0 },
  },
  {
    title: 'Big runs score big',
    say: 'Look what fell together: four of one colour in a row. Bigger runs are worth far more per tile, so it pays to build them.',
    hint: 'Tap the glowing run of four.',
    praise: 'A run of four scores much more than two pairs would.',
    from: { row: 3, col: 0 },
  },
];

export function AdjacentLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState<AdjacentState>({ grid: ADJ.initial, score: 0, cascades: 0 });
  const [animation, setAnimation] = useState<AdjacentAnimation | null>(null);
  const flow = useLessonFlow(ADJ_STEPS.length, undefined, 1);
  const step = ADJ_STEPS[flow.index];
  const live = flow.phase === 'doing' || (flow.phase === 'watch' && flow.demoFrame === null);
  const group = useMemo<ReadonlyArray<AdjacentCoord>>(() => (live ? groupAt(state.grid, step.from.row, step.from.col) : []), [live, state.grid, step]);
  // The demo: the run cleared, tiles falling, then the board put back.
  const demoMove = useMemo(() => applyTap(state, step.from.row, step.from.col), [state, step]);
  const showingDemo = flow.demoFrame === 0 && demoMove !== null;
  useEffect(() => {
    if (flow.demoFrame === 0 && demoMove) {
      setAnimation({ at: Date.now(), removed: demoMove.removed.map(c => ({ ...c, colour: state.grid[c.row][c.col] as number })), falls: demoMove.falls });
    } else if (flow.demoFrame === null) {
      setAnimation(null);
    }
    // Only when the demo frame comes up, or goes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.demoFrame]);
  // Steady while the player watches and acts: blinking it meant redrawing
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
          state={showingDemo ? demoMove.state : state}
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
    say: 'Islands join with straight bridges. Tap the water between two islands to build one. The 1 needs exactly one bridge.',
    hint: 'Tap the glowing water between the two top islands.',
    praise: 'The 1 has its bridge, and raises its flag.',
    link: TOP,
    count: 1,
  },
  {
    title: 'Doubles count twice',
    say: 'Two islands can share two bridges. The 2 below has only one neighbour, so it needs a double bridge to it.',
    hint: 'Tap the glowing water twice for a double bridge.',
    praise: 'Every number met and every island joined. Solved.',
    link: SIDE,
    count: 2,
  },
];

export function BridgesLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState<BridgesState>({ bridges: linksOf.map(() => 0) });
  const [stepIndex, setStepIndex] = useState(0);
  // The demo: one tap per bridge, from the board as it stands.
  const demo = useMemo(() => {
    const frames: BridgesState[] = [];
    let s = state;
    while (s.bridges[BRIDGE_STEPS[stepIndex].link] < BRIDGE_STEPS[stepIndex].count && frames.length < 3) {
      s = cycleBridge(BRIDGES, s, BRIDGE_STEPS[stepIndex].link);
      frames.push(s);
    }
    return frames;
  }, [state, stepIndex]);
  const flow = useLessonFlow(BRIDGE_STEPS.length, setStepIndex, demo.length);
  const step = BRIDGE_STEPS[flow.index];
  const shown = flow.demoFrame !== null && demo[flow.demoFrame] ? demo[flow.demoFrame] : state;
  // Steady while the player watches and acts: blinking it meant redrawing
  // the whole board twice a second.
  const glow = flow.phase === 'doing' || flow.phase === 'watch';
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
          state={shown}
          size={size}
          solved={flow.demoFrame === null && isBridgesSolved(BRIDGES, state)}
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
const TWIN_STEPS: ReadonlyArray<LessonStepCopy & { readonly value: number; readonly drag: ReadonlyArray<Cell> }> = [
  {
    title: 'Draw, and it mirrors',
    say: 'Join each pair of matching numbers with a path. The board is folded down the middle, so whatever you draw on one side is drawn on the other for you.',
    hint: 'Drag from the top 1 down to the other 1.',
    praise: 'One path drawn, two on the board. The 2s joined themselves.',
    value: 1,
    drag: [C(0, 1), C(1, 1), C(2, 1)],
  },
  {
    title: 'Meet in the middle',
    say: 'The two 3s mirror each other, so you only draw half: reach the fold and the reflection closes the path. Solved means every square is filled.',
    hint: 'Drag from the top left 3 down the side and along the bottom.',
    praise: 'Every pair joined and every square filled. Solved.',
    value: 3,
    drag: [C(0, 0), C(1, 0), C(2, 0), C(3, 0), C(3, 1)],
  },
];

export function TwinpathLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState<ArukoneState>({ paths: {} });
  const [short, setShort] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  // The demo: the path drawn square by square, with its mirror following.
  const demo = useMemo(() => {
    const cells = TWIN_STEPS[stepIndex].drag;
    const begun = beginDraw(TWIN, state, cells[0]);
    if (!begun) return [];
    const frames = [begun.state];
    for (const cell of cells.slice(1)) frames.push(extendDraw(TWIN, frames[frames.length - 1], begun.value, cell));
    return frames;
  }, [state, stepIndex]);
  const flow = useLessonFlow(
    TWIN_STEPS.length,
    i => {
      setStepIndex(i);
      setShort(false);
    },
    demo.length,
  );
  const step = TWIN_STEPS[flow.index];
  const shown = flow.demoFrame !== null && demo[flow.demoFrame] ? demo[flow.demoFrame] : state;
  const steps = useMemo(
    () => TWIN_STEPS.map((s, i) => (i === flow.index && short ? { ...s, hint: 'Joined, but squares are still empty. Drag back and go round the outside.' } : s)),
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
      renderBoard={size => <ArukoneBoard puzzle={TWIN} state={shown} size={size} solved={flow.demoFrame === null && isArukoneSolved(TWIN, state)} onChange={change} onReject={flow.wrong} />}
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
    say: 'Every picture is a set of empty squares, and the pieces in the tray fill it exactly. Drag a piece up and let it go where it fits.',
    hint: 'Drag the square into the glowing corner.',
    praise: 'It snaps in place. One piece down.',
    piece: 0,
  },
  {
    title: 'Turn to fit',
    say: 'Pieces can turn. Tap one in the tray for a quarter turn, as often as you like, then drag it in.',
    hint: 'Tap the long piece to stand it up, then drag it to the glowing column.',
    praise: 'Turned, and in.',
    piece: 1,
  },
  {
    title: 'The last gap',
    say: 'When only one piece is left there is only one place for it. Fill every square and the picture is finished.',
    hint: 'Drag the last piece into the gap.',
    praise: 'Every square filled. Solved.',
    piece: 2,
  },
];

export function MosaicLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState<MosaicState>(() => initialMosaicState(MOSAIC_LESSON));
  const [stepIndex, setStepIndex] = useState(0);
  // The demo: the piece turned as it needs to be, then set in its place.
  const demo = useMemo(() => {
    const piece = MOSAIC_STEPS[stepIndex].piece;
    const goal = MOSAIC_LESSON.solution[piece];
    const frames: MosaicState[] = [];
    let s = state;
    while (s.pieces[piece].rotation !== goal.rotation && frames.length < 3) {
      s = rotatePiece(MOSAIC_LESSON, s, piece);
      frames.push(s);
    }
    frames.push(placePiece(MOSAIC_LESSON, s, piece, goal.row, goal.col));
    return frames;
  }, [state, stepIndex]);
  const flow = useLessonFlow(MOSAIC_STEPS.length, setStepIndex, demo.length);
  const step = MOSAIC_STEPS[flow.index];
  const shown = flow.demoFrame !== null && demo[flow.demoFrame] ? demo[flow.demoFrame] : state;
  // Steady while the player watches and acts: blinking it meant redrawing
  // the whole board twice a second.
  const glow = flow.phase === 'doing' || flow.phase === 'watch';

  const place = useCallback(
    (index: number, row: number, col: number) => {
      if (flow.phase !== 'doing') return;
      if (index !== step.piece) return flow.wrong();
      const next = placePiece(MOSAIC_LESSON, state, index, row, col);
      const landed = placedCells(MOSAIC_LESSON, index, { ...next.pieces[index], row, col });
      const goal = goalCells(index);
      // Only where it belongs: the lesson leaves no room for a wrong turn later.
      if (next === state || !goal.every(g => landed.some(c => c.row === g.row && c.col === g.col))) return flow.wrong();
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
          state={shown}
          width={size}
          maxBoardHeight={size * 0.56}
          solved={flow.demoFrame === null && isMosaicSolved(MOSAIC_LESSON, state)}
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
    say: 'Swipe the board and gravity pulls that way. Pieces slide until something stops them. Bring the piece home to its ring.',
    hint: 'Swipe down anywhere on the board.',
    praise: 'Down it went, all the way to the ring.',
    board: gravityBoard(['..o..', '.....', '.....', '.....', '..x..']),
    direction: 'down',
  },
  {
    title: 'Walls stop a slide',
    say: 'A piece never stops halfway on its own. It slides to the edge, or until a wall gets in the way. Here the wall is what parks it on the ring.',
    hint: 'Swipe right.',
    praise: 'The wall caught it, right on the ring.',
    board: gravityBoard(['.....', '.....', 'o..x#', '.....', '.....']),
    direction: 'right',
  },
  {
    title: 'Everything falls at once',
    say: 'Every swipe moves every piece. Each one stops at whatever is in its own way, so plan for all of them together.',
    hint: 'Swipe down and watch both pieces.',
    praise: 'One swipe, two pieces home. That is the whole game.',
    board: gravityBoard(['.o.o.', '.....', '...x.', '...#.', '.x...']),
    direction: 'down',
  },
];

export function GravityLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState<GameState>(GRAVITY_STEPS[0].board);
  const [arrow, setArrow] = useState(0);
  const [animating, setAnimating] = useState(false);
  // The demo: the board as it is (with the arrow), then the slide.
  const flow = useLessonFlow(GRAVITY_STEPS.length, i => setState(GRAVITY_STEPS[i].board), 2);
  const step = GRAVITY_STEPS[flow.index];
  const shown = useMemo(() => (flow.demoFrame === 1 ? applyGravity(state, step.direction) : state), [flow.demoFrame, state, step]);

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
    () => new Set(shown.movables.filter(m => shown.staticGrid[m.row][m.col] === StaticCellType.Target).map(m => m.id)),
    [shown],
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
          {/* Keyed by step and by demo, so the board snaps back after the
            demo (and between steps) rather than sliding in reverse. */}
          <GravityBoard
            key={`${flow.index}-${flow.demoFrame === null ? 'live' : 'demo'}`}
            state={shown}
            instant={false}
            size={size}
            onTargetIds={onTarget}
            solved={flow.demoFrame === null && isPuzzleSolved(state) && !animating}
            onAnimatingChange={setAnimating}
          />
          {(doing || flow.demoFrame === 0) && <GravityHintArrow key={`${flow.index}-${arrow}`} size={size} direction={step.direction} onDone={() => {}} />}
        </View>
      )}
    />
  );
}

const styles = themedStyles(() => ({
  towers: { alignItems: 'center', gap: 14 },
  pad: { flexDirection: 'row', gap: 12 },
  key: { width: 56, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  keyPicked: { borderColor: theme.colors.accent, borderWidth: 2 },
  keyLive: { borderColor: theme.colors.goldRim, backgroundColor: theme.colors.surfaceHi },
  keyText: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  pressed: { opacity: 0.8 },
}));
