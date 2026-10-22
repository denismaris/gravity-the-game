import React, { useCallback, useState } from 'react';
import { BinairoPuzzle, BinairoState, isBinairoSolved, nextValue, setValue } from '../../game/binairo';
import { BloomPuzzle, BloomState, isBloomSolved } from '../../game/bloom';
import { LightsOutPuzzle, LightsOutState, press } from '../../game/lightsout';
import { MirrorMazePuzzle, MirrorMazeState, isMirrorMazeSolved, nextMirror, setMirror, traceBeam } from '../../game/mirror';
import { accentColorForKind } from '../../game/journey';
import { BinairoBoard } from '../BinairoBoard';
import { BloomBoard } from '../BloomBoard';
import { LightsOutBoard } from '../LightsOutBoard';
import { MirrorMazeBoard } from '../MirrorMazeBoard';
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
  const flow = useLessonFlow(steps.length, i => {
    const fresh = steps[i].board;
    if (fresh) setBoard(fresh);
  });
  const step = steps[flow.index];
  const target = typeof step.target === 'function' ? step.target(board.state) : step.target;
  // Steady while the player is meant to act: blinking it meant redrawing
  // the whole board twice a second.
  const glow = flow.phase === 'doing' && target !== null;

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
  return { board, flow, tap, flash: glow ? target : null };
}

// --- Twos ---------------------------------------------------------------------

export const TWOS: BinairoPuzzle = {
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
    say: 'Two circles are next to each other in the top row. A third circle would make three in a row. So the next one must be a square.',
    hint: 'Tap the glowing square once to place a square.',
    praise: 'Two the same side by side? The squares at both ends are the other shape.',
    target: { row: 0, col: 2 },
    goal: s => s.values[0][2] === 0,
  },
  {
    title: 'Mind the gap',
    say: 'This empty square is between two squares. A square here would make three in a row. So it must be a circle.',
    hint: 'Tap the glowing square twice: square, then circle.',
    praise: 'A gap between two the same is always the other shape.',
    target: { row: 1, col: 1 },
    goal: s => s.values[1][1] === 1,
  },
  {
    title: 'Keep it even',
    say: 'Every row has the same number of circles and squares. This row already has its two circles, so the last one is a square.',
    hint: 'Tap the glowing square once.',
    praise: 'Count as you go. When one shape is full, the rest is the other.',
    target: { row: 2, col: 3 },
    goal: s => s.values[2][3] === 0,
  },
  {
    title: 'Your turn',
    say: 'Finish the board on your own: no three in a row, and the same number of each shape in every row and column.',
    hint: 'Fill every empty square.',
    praise: 'A whole board, solved by you.',
    target: null,
    goal: s => isBinairoSolved(TWOS, s),
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
// Two corner taps' worth, so it takes two taps to clear and the player
// has to find which.
export const LANTERN_PAIR = lanterns([
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 2, col: 2 },
  { row: 2, col: 1 },
  { row: 1, col: 2 },
]);
const LANTERN_STEPS: ReadonlyArray<GridStep<LightsOutPuzzle, LightsOutState>> = [
  {
    title: 'A tap reaches its neighbours',
    say: 'Tapping a lantern switches it, and the lanterns right above, below and beside it. In a corner, that is three lanterns.',
    hint: 'Tap the glowing lantern in the corner.',
    praise: 'Three lanterns out with a single tap.',
    target: { row: 0, col: 0 },
    goal: allDark,
  },
  {
    title: 'Put them all out',
    say: 'In the middle, a tap switches five lanterns. Find the one that turns all five off.',
    hint: 'Tap the glowing lantern in the centre.',
    praise: 'All the lanterns are off. That is how every board ends.',
    target: { row: 1, col: 1 },
    goal: allDark,
    board: LANTERN_CROSS,
  },
  {
    title: 'Your turn',
    say: 'Six lanterns are lit, and two taps put them all out. Find the two.',
    hint: 'Tap any lantern. Tap it again to take a tap back.',
    praise: 'Every lantern out. You solved a whole board.',
    target: null,
    goal: allDark,
    board: LANTERN_PAIR,
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

// --- Mirror Maze ---------------------------------------------------------------------

const mirrorBoard = (puzzle: MirrorMazePuzzle) => ({ puzzle, state: { mirrors: Array.from({ length: puzzle.rows }, () => Array.from({ length: puzzle.cols }, () => null)) } as MirrorMazeState });
const MIRROR_UP: MirrorMazePuzzle = { id: 'lesson-mirror-1', difficulty: 'easy', rows: 3, cols: 3, source: { row: 2, col: 0 }, sourceDirection: 'right', target: { row: 0, col: 2 }, gems: [], obstacles: [] };
const MIRROR_DOWN: MirrorMazePuzzle = { id: 'lesson-mirror-2', difficulty: 'easy', rows: 3, cols: 3, source: { row: 0, col: 0 }, sourceDirection: 'right', target: { row: 2, col: 2 }, gems: [{ row: 1, col: 2 }], obstacles: [] };
// The light has to turn twice - down, then left - through a gem on the way.
export const MIRROR_TWICE: MirrorMazePuzzle = { id: 'lesson-mirror-3', difficulty: 'easy', rows: 3, cols: 3, source: { row: 0, col: 0 }, sourceDirection: 'right', target: { row: 2, col: 0 }, gems: [{ row: 1, col: 2 }], obstacles: [] };
const MIRROR_STEPS: ReadonlyArray<GridStep<MirrorMazePuzzle, MirrorMazeState>> = [
  {
    title: 'Bend the beam',
    say: 'The light goes straight until a mirror turns it. Here it needs to turn up to reach the gold ring.',
    hint: 'Tap the glowing square once to place a / mirror.',
    praise: 'The / mirror turned the light up.',
    target: { row: 2, col: 2 },
    goal: s => s.mirrors[2][2] === 'fwd',
  },
  {
    title: 'Flip it the other way',
    say: 'Tap a mirror again and it tilts the other way. This light needs to turn down, through the gem, to the gold ring.',
    hint: 'Tap the glowing square twice for a \\ mirror.',
    praise: 'Gem lit, ring reached. The beam did the rest.',
    target: { row: 0, col: 2 },
    goal: s => s.mirrors[0][2] === 'back',
    board: mirrorBoard(MIRROR_DOWN),
  },
  {
    title: 'Your turn',
    say: 'This light has to turn twice: through the gem, then round to the gold ring. Place the mirrors yourself.',
    hint: 'Tap any square to place a mirror, again to tilt it.',
    praise: 'Two turns, gem and ring. You solved a whole board.',
    target: null,
    goal: s => isMirrorMazeSolved(MIRROR_TWICE, s),
    board: mirrorBoard(MIRROR_TWICE),
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
// The same loop, scrambled, with only one tile pinned: three to turn.
export const BLOOM_FREE: BloomPuzzle = { ...BLOOM, id: 'lesson-bloom-2', start: [[1, 0], [2, 1]], pinned: [[true, false], [false, false]] };
const BLOOM_STEPS: ReadonlyArray<GridStep<BloomPuzzle, BloomState>> = [
  {
    title: 'Every line must meet a line',
    say: 'Tap a tile to turn it. Tiles with a gold dot never turn, so start next to them. This tile must face the fixed one beside it.',
    hint: 'Tap the glowing tile until its line meets its neighbours.',
    praise: 'Now its line joins the tiles on both sides.',
    target: { row: 0, col: 1 },
    goal: s => s.rotations[0][1] % 4 === 2,
  },
  {
    title: 'Close the loop',
    say: 'One loose end is left. Turn the last tile to close the loop, and it fills with colour.',
    hint: 'Tap the glowing tile.',
    praise: 'A closed loop fills with colour. Close them all to win.',
    target: { row: 1, col: 0 },
    goal: s => s.rotations[1][0] % 4 === 0,
  },
  {
    title: 'Your turn',
    say: 'Three tiles to turn this time. Start beside the gold dot and close the loop.',
    hint: 'Tap any tile to turn it.',
    praise: 'The loop is closed. You solved a whole board.',
    target: null,
    goal: s => isBloomSolved(BLOOM_FREE, s),
    board: { puzzle: BLOOM_FREE, state: { rotations: BLOOM_FREE.start.map(r => r.slice()) } },
  },
];

export function BloomLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const { board, flow, tap, flash } = useGridLesson({ puzzle: BLOOM, state: { rotations: BLOOM.start.map(r => r.slice()) } }, BLOOM_STEPS, (p, s, r, c) =>
    // A gold-dot tile never turns - free play reaches it now.
    p.pinned[r][c]
      ? s
      : {
          rotations: s.rotations.map((line, ri) => (ri === r ? line.map((v, ci) => (ci === c ? (v + 1) % 4 : v)) : line)),
        },
  );
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
