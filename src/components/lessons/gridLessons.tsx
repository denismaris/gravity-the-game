import React, { useCallback, useState } from 'react';
import { BinairoPuzzle, BinairoState, nextValue, setValue } from '../../game/binairo';
import { BloomPuzzle, BloomState } from '../../game/bloom';
import { FillaPixPuzzle, FillaPixState, toggleCell } from '../../game/fillapix';
import { LightsOutPuzzle, LightsOutState, press } from '../../game/lightsout';
import { MirrorMazePuzzle, MirrorMazeState, isMirrorMazeSolved, nextMirror, setMirror, traceBeam } from '../../game/mirror';
import { nextMark, setMark, TentsTreesPuzzle, TentsTreesState } from '../../game/tents';
import { accentColorForKind } from '../../game/journey';
import { BinairoBoard } from '../BinairoBoard';
import { BloomBoard } from '../BloomBoard';
import { FillaPixBoard } from '../FillaPixBoard';
import { LightsOutBoard } from '../LightsOutBoard';
import { MirrorMazeBoard } from '../MirrorMazeBoard';
import { TentsBoard } from '../TentsBoard';
import { LessonShell, LessonStepCopy, useLessonFlow } from './LessonShell';

type Cell = { row: number; col: number };

/** One step of a tap-the-board lesson. */
interface GridStep<P, S> extends LessonStepCopy {
  /** The square to tap - or, given the board, the next one - or null for
   * any square. A tap anywhere else is a gentle "not there". */
  readonly target: Cell | null | ((state: S) => Cell | null);
  readonly goal: (state: S) => boolean;
  /** A fresh board for this step, when it needs one. */
  readonly board?: { puzzle: P; state: S };
}

/**
 * The machinery every tap lesson shares: the board as the player changes
 * it, only the glowing square accepted, the goal checked after every tap,
 * and the board swapped when a step brings its own.
 */
function useGridLesson<P, S>(first: { puzzle: P; state: S }, steps: ReadonlyArray<GridStep<P, S>>, apply: (puzzle: P, state: S, row: number, col: number) => S) {
  const [board, setBoard] = useState(first);
  const [stepIndex, setStepIndex] = useState(0);
  // The demo: the step's own taps, played from the board as it stands,
  // until its goal is met. Cheap - a handful of taps on a tiny board.
  const demo = demoTaps(board, steps[stepIndex], apply);
  const flow = useLessonFlow(
    steps.length,
    i => {
      setStepIndex(i);
      const fresh = steps[i].board;
      if (fresh) setBoard(fresh);
    },
    demo.length,
  );
  const step = steps[flow.index];
  const target = typeof step.target === 'function' ? step.target(board.state) : step.target;
  // Steady while the player watches and acts: blinking it meant redrawing
  // the whole board twice a second.
  const glow = (flow.phase === 'doing' || flow.phase === 'watch') && target !== null;
  const shown = flow.demoFrame !== null && demo[flow.demoFrame] ? { ...board, state: demo[flow.demoFrame] } : board;

  const tap = useCallback(
    (row: number, col: number) => {
      if (flow.phase !== 'doing') return;
      if (target && (target.row !== row || target.col !== col)) {
        flow.wrong();
        return;
      }
      const next = apply(board.puzzle, board.state, row, col);
      setBoard(b => ({ ...b, state: next }));
      if (step.goal(next)) flow.succeed();
    },
    [flow, target, apply, board, step],
  );
  return { board: shown, flow, tap, flash: glow ? target : null };
}

/** The boards a step's demo shows, one per tap, ending on its goal - or
 * none, when the step has no single square to show. */
function demoTaps<P, S>(board: { puzzle: P; state: S }, step: GridStep<P, S>, apply: (puzzle: P, state: S, row: number, col: number) => S): S[] {
  const frames: S[] = [];
  let state = board.state;
  for (let tap = 0; tap < 6 && !step.goal(state); tap += 1) {
    const cell = typeof step.target === 'function' ? step.target(state) : step.target;
    if (!cell) return [];
    state = apply(board.puzzle, state, cell.row, cell.col);
    frames.push(state);
  }
  return step.goal(state) ? frames : [];
}

// --- Twos ---------------------------------------------------------------------

const TWOS: BinairoPuzzle = {
  id: 'lesson-twos',
  difficulty: 'easy',
  size: 4,
  givens: [
    [1, 1, null, null],
    [0, null, 0, null],
    [1, 0, 1, null],
    [null, null, null, null],
  ],
};
const TWOS_STEPS: ReadonlyArray<GridStep<BinairoPuzzle, BinairoState>> = [
  {
    title: 'Never three in a row',
    say: 'Two circles sit side by side in the top row. A third circle would make three in a row, so the next square must be the other shape.',
    hint: 'Tap the glowing square once to place a square.',
    praise: 'Two alike side by side? Both ends are always the other shape.',
    target: { row: 0, col: 2 },
    goal: s => s.values[0][2] === 0,
  },
  {
    title: 'Mind the gap',
    say: 'This empty square sits between two squares. Another square there would make three in a row, so it is a circle.',
    hint: 'Tap the glowing square twice: square, then circle.',
    praise: 'A gap between two alike is always the other shape.',
    target: { row: 1, col: 1 },
    goal: s => s.values[1][1] === 1,
  },
  {
    title: 'Keep it even',
    say: 'Every row holds as many circles as squares. The third row already has its two circles, so the last square is a square.',
    hint: 'Tap the glowing square once.',
    praise: 'Count each line as you go. Half of one shape? The rest is the other.',
    target: { row: 2, col: 3 },
    goal: s => s.values[2][3] === 0,
  },
];

export function TwosLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const { board, flow, tap, flash } = useGridLesson({ puzzle: TWOS, state: { values: TWOS.givens.map(r => r.slice()) } }, TWOS_STEPS, (p, s, r, c) => setValue(s, p, r, c, nextValue(s.values[r][c])));
  return (
    <LessonShell
      gameName="Twos"
      accent={accentColorForKind('binairo')}
      steps={TWOS_STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => <BinairoBoard puzzle={board.puzzle} state={board.state} size={size} solved={flow.phase === 'done'} onToggleCell={tap} flashCell={flash} />}
    />
  );
}

// --- Tents ----------------------------------------------------------------------

const TENTS: TentsTreesPuzzle = {
  id: 'lesson-tents',
  difficulty: 'easy',
  rows: 4,
  cols: 4,
  trees: [
    { row: 1, col: 1 },
    { row: 2, col: 3 },
  ],
  rowCounts: [1, 0, 0, 1],
  colCounts: [0, 1, 0, 1],
};
const emptyTents = (): TentsTreesState => ({ marks: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 'empty' as const)) });
const TENTS_STEPS: ReadonlyArray<GridStep<TentsTreesPuzzle, TentsTreesState>> = [
  {
    title: 'Every tree hides one tent',
    say: 'A tent sits right beside its tree: above, below, left or right, never diagonally. This tree has one free spot above it.',
    hint: 'Tap the glowing square to pitch a tent.',
    praise: 'That tent belongs to the tree below it.',
    target: { row: 0, col: 1 },
    goal: s => s.marks[0][1] === 'tent',
  },
  {
    title: 'Tents never touch',
    say: 'Not even corner to corner. So every square around a tent is grass, and you can mark it.',
    hint: 'Tap the glowing square twice to mark it as grass.',
    praise: 'Marking grass makes the tents easy to find.',
    target: { row: 1, col: 2 },
    goal: s => s.marks[1][2] === 'marked',
  },
  {
    title: 'Count the tents',
    say: 'The numbers at the edges say how many tents each row and column holds. The bottom row needs one, beside the second tree.',
    hint: 'Pitch the last tent on the glowing square.',
    praise: 'Every tree has its tent, and every count is met.',
    target: { row: 3, col: 3 },
    goal: s => s.marks[3][3] === 'tent',
  },
];

export function TentsLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const { board, flow, tap, flash } = useGridLesson({ puzzle: TENTS, state: emptyTents() }, TENTS_STEPS, (p, s, r, c) => setMark(s, p, r, c, nextMark(s.marks[r][c])));
  return (
    <LessonShell
      gameName="Tents and Trees"
      accent={accentColorForKind('tents')}
      steps={TENTS_STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => <TentsBoard puzzle={board.puzzle} state={board.state} size={size} solved={flow.phase === 'done'} onToggleCell={tap} flashCell={flash} />}
    />
  );
}

// --- Lanterns ---------------------------------------------------------------------

const lanterns = (lit: ReadonlyArray<Cell>): { puzzle: LightsOutPuzzle; state: LightsOutState } => {
  const lights = Array.from({ length: 3 }, (_v, r) => Array.from({ length: 3 }, (_w, c) => lit.some(l => l.row === r && l.col === c)));
  return { puzzle: { id: 'lesson-lanterns', difficulty: 'easy', size: 3, initial: lights, par: 1 }, state: { lights } };
};
const allDark = (s: LightsOutState) => s.lights.every(line => line.every(on => !on));
const LANTERN_CORNER = lanterns([
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 1, col: 0 },
]);
const LANTERN_CROSS = lanterns([
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: 2 },
  { row: 2, col: 1 },
]);
const LANTERN_STEPS: ReadonlyArray<GridStep<LightsOutPuzzle, LightsOutState>> = [
  {
    title: 'A tap reaches its neighbours',
    say: 'Tapping a lantern switches it, and also the lanterns directly above, below and beside it. In a corner, that is three lanterns.',
    hint: 'Tap the glowing lantern in the corner.',
    praise: 'Three lanterns out with a single tap.',
    target: { row: 0, col: 0 },
    goal: allDark,
  },
  {
    title: 'Put them all out',
    say: 'In the middle a tap reaches four neighbours. Find the one lantern that switches all five off.',
    hint: 'Tap the glowing lantern in the centre.',
    praise: 'Every lantern dark: that is a solved board.',
    target: { row: 1, col: 1 },
    goal: allDark,
    board: LANTERN_CROSS,
  },
];

export function LanternsLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const { board, flow, tap, flash } = useGridLesson(LANTERN_CORNER, LANTERN_STEPS, (p, s, r, c) => press(s, p.size, r, c));
  return (
    <LessonShell
      gameName="Lanterns"
      accent={accentColorForKind('lightsout')}
      steps={LANTERN_STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => <LightsOutBoard puzzle={board.puzzle} state={board.state} size={size} solved={flow.phase === 'done'} onPressCell={tap} flashCell={flash} />}
    />
  );
}

// --- Pixel Clues --------------------------------------------------------------------

const PIXEL: FillaPixPuzzle = {
  id: 'lesson-pixel',
  difficulty: 'easy',
  size: 4,
  solution: [
    [true, true, false, false],
    [true, true, false, false],
    [false, false, false, false],
    [false, false, false, false],
  ],
  clues: [
    { row: 0, col: 0 },
    { row: 3, col: 3 },
  ],
};
const blankPixels = (): FillaPixState => ({ filled: Array.from({ length: 4 }, () => [false, false, false, false]) });
const CORNER: ReadonlyArray<Cell> = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
];
const PIXEL_STEPS: ReadonlyArray<GridStep<FillaPixPuzzle, FillaPixState>> = [
  {
    title: 'A number counts its block',
    say: 'Each number counts the filled squares in the block around it, its own square included. In a corner the block is only four squares, so a 4 fills them all.',
    hint: 'Fill the glowing squares, one tap each.',
    praise: 'The 4 is complete: every square of its block is filled.',
    target: s => CORNER.find(c => !s.filled[c.row][c.col]) ?? null,
    goal: s => CORNER.every(c => s.filled[c.row][c.col]),
  },
  {
    title: 'A 0 keeps its block empty',
    say: 'This 0 says none of the squares around it are filled. One of them is, by mistake.',
    hint: 'Tap the glowing square to clear it.',
    praise: 'Every number matches, and the picture appears.',
    target: { row: 2, col: 2 },
    goal: s => !s.filled[2][2],
    board: {
      puzzle: PIXEL,
      state: { filled: [[true, true, false, false], [true, true, false, false], [false, false, true, false], [false, false, false, false]] },
    },
  },
];

export function PixelCluesLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const { board, flow, tap, flash } = useGridLesson({ puzzle: PIXEL, state: blankPixels() }, PIXEL_STEPS, (_p, s, r, c) => toggleCell(s, r, c));
  return (
    <LessonShell
      gameName="Pixel Clues"
      accent={accentColorForKind('fillapix')}
      steps={PIXEL_STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => <FillaPixBoard puzzle={board.puzzle} state={board.state} size={size} solved={flow.phase === 'done'} onToggleCell={tap} flashCell={flash} />}
    />
  );
}

// --- Mirror Maze ---------------------------------------------------------------------

const mirrorBoard = (puzzle: MirrorMazePuzzle) => ({ puzzle, state: { mirrors: Array.from({ length: puzzle.rows }, () => Array.from({ length: puzzle.cols }, () => null)) } as MirrorMazeState });
const MIRROR_UP: MirrorMazePuzzle = { id: 'lesson-mirror-1', difficulty: 'easy', rows: 3, cols: 3, source: { row: 2, col: 0 }, sourceDirection: 'right', target: { row: 0, col: 2 }, gems: [], obstacles: [] };
const MIRROR_DOWN: MirrorMazePuzzle = { id: 'lesson-mirror-2', difficulty: 'easy', rows: 3, cols: 3, source: { row: 0, col: 0 }, sourceDirection: 'right', target: { row: 2, col: 2 }, gems: [{ row: 1, col: 2 }], obstacles: [] };
const MIRROR_STEPS: ReadonlyArray<GridStep<MirrorMazePuzzle, MirrorMazeState>> = [
  {
    title: 'Bend the beam',
    say: 'The light runs straight from its source until a mirror turns it. It needs to turn up here to reach the target.',
    hint: 'Tap the glowing square once to place a / mirror.',
    praise: 'A / mirror sends a beam travelling right straight up.',
    target: { row: 2, col: 2 },
    goal: s => s.mirrors[2][2] === 'fwd',
  },
  {
    title: 'Flip it the other way',
    say: 'Tap a mirror again and it leans the other way. This beam has to turn down, through the gem, to the target.',
    hint: 'Tap the glowing square twice for a \\ mirror.',
    praise: 'Gem collected, target reached. That is a solved maze.',
    target: { row: 0, col: 2 },
    goal: s => s.mirrors[0][2] === 'back',
    board: mirrorBoard(MIRROR_DOWN),
  },
];

export function MirrorLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const { board, flow, tap, flash } = useGridLesson(mirrorBoard(MIRROR_UP), MIRROR_STEPS, (p, s, r, c) => setMirror(s, p, r, c, nextMirror(s.mirrors[r][c])));
  return (
    <LessonShell
      gameName="Mirror Maze"
      accent={accentColorForKind('mirror')}
      steps={MIRROR_STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => (
        <MirrorMazeBoard
          puzzle={board.puzzle}
          state={board.state}
          size={size}
          path={traceBeam(board.puzzle, board.state)}
          revealProgress={1}
          solved={isMirrorMazeSolved(board.puzzle, board.state)}
          onCycleCell={tap}
          flashCell={flash}
        />
      )}
    />
  );
}

// --- Bloom ---------------------------------------------------------------------------

const BLOOM: BloomPuzzle = {
  id: 'lesson-bloom',
  difficulty: 'easy',
  rows: 2,
  cols: 2,
  kinds: [
    ['arc', 'arc'],
    ['arc', 'arc'],
  ],
  solution: [
    [1, 2],
    [0, 3],
  ],
  start: [
    [1, 1],
    [3, 3],
  ],
  pinned: [
    [true, false],
    [false, true],
  ],
};
const BLOOM_STEPS: ReadonlyArray<GridStep<BloomPuzzle, BloomState>> = [
  {
    title: 'Every line must meet a line',
    say: 'Tap a tile to turn it a quarter. The pinned tiles never turn: read from them. This tile has to face the pinned one beside it.',
    hint: 'Tap the glowing tile until its line meets its neighbours.',
    praise: 'Its line now meets the tiles on both sides.',
    target: { row: 0, col: 1 },
    goal: s => s.rotations[0][1] % 4 === 2,
  },
  {
    title: 'Close the loop',
    say: 'One loose end is left. Turn the last tile and the loop closes, and blooms with colour.',
    hint: 'Tap the glowing tile.',
    praise: 'A closed loop blooms. Close them all to finish a board.',
    target: { row: 1, col: 0 },
    goal: s => s.rotations[1][0] % 4 === 0,
  },
];

export function BloomLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const { board, flow, tap, flash } = useGridLesson({ puzzle: BLOOM, state: { rotations: BLOOM.start.map(r => r.slice()) } }, BLOOM_STEPS, (_p, s, r, c) => ({
    rotations: s.rotations.map((line, ri) => (ri === r ? line.map((v, ci) => (ci === c ? (v + 1) % 4 : v)) : line)),
  }));
  return (
    <LessonShell
      gameName="Bloom"
      accent={accentColorForKind('bloom')}
      steps={BLOOM_STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => <BloomBoard puzzle={board.puzzle} state={board.state} size={size} solved={flow.phase === 'done'} onTurn={tap} flashCell={flash} />}
    />
  );
}
