import React, { useCallback, useMemo, useState } from 'react';
import {
  hop,
  hopsFrom,
  initialLilyState,
  isLilySolved,
  LilyPuzzle,
  LilyState,
  solveLily,
} from '../../game/lilypads';
import { cutOff as cutOffOf } from '../../game/lilypads';
import {
  Dir,
  isVaneSolved,
  turn,
  VanePuzzle,
  VaneState,
} from '../../game/vanes';
import { accentColorForKind } from '../../game/journey';
import { LilyPadsBoard } from '../LilyPadsBoard';
import { VanesBoard } from '../VanesBoard';
import { LessonShell, LessonStepCopy, useLessonFlow } from './LessonShell';

/**
 * The hands-on lessons for the two games on trial: tiny boards, a step at
 * a time, each step asking for one move and saying why it works.
 */

// --- Lily Pads ----------------------------------------------------------------

const pond = (id: string, pads: Array<[number, number]>): LilyPuzzle => ({
  id,
  name: 'Lesson',
  difficulty: 'easy',
  size: 4,
  pads: pads.map(([row, col]) => ({ row, col })),
  solution: [],
});

/** A straight hop over open water. */
const POND_LINE = pond('lesson-lily-1', [
  [1, 0],
  [1, 3],
]);
/** Two hops, the first pad sinking behind. */
const POND_SINK = pond('lesson-lily-2', [
  [0, 0],
  [0, 2],
  [2, 2],
]);
/** Right first splits the last two pads apart: left first is the way. */
export const POND_PLAN = pond('lesson-lily-3', [
  [1, 1],
  [1, 0],
  [1, 2],
  [3, 2],
]);

interface LilyStep extends LessonStepCopy {
  readonly board?: LilyPuzzle;
  /** The pad to hop to, given the pond - or the next pad of a way through. */
  readonly target: (puzzle: LilyPuzzle, state: LilyState) => number;
  readonly goal: (state: LilyState) => boolean;
}

const padAt = (puzzle: LilyPuzzle, row: number, col: number) =>
  puzzle.pads.findIndex(p => p.row === row && p.col === col);

const LILY_STEPS: ReadonlyArray<LilyStep> = [
  {
    title: 'Hop in a line',
    say: 'The frog hops straight up, down, left or right, to the nearest pad that way, clean over any open water.',
    hint: 'Tap the glowing pad, or swipe toward it.',
    praise: 'Any distance, as long as it is in a straight line.',
    board: POND_LINE,
    target: p => padAt(p, 1, 3),
    goal: s => s.at === 1,
  },
  {
    title: 'The pad behind sinks',
    say: 'Every pad the frog leaves goes under. There is no hopping back.',
    hint: 'Hop to the glowing pad, and watch the one you leave.',
    praise: 'Gone. Each hop uses a pad up for good.',
    board: POND_SINK,
    target: p => padAt(p, 0, 2),
    goal: s => s.at === 1,
  },
  {
    title: 'Visit every pad',
    say: 'The pond is cleared when the frog has been on every pad and sits on the last one.',
    hint: 'Hop down to the last pad.',
    praise: 'Every pad visited. The pond is clear.',
    target: p => padAt(p, 2, 2),
    goal: s => isLilySolved(s),
  },
  {
    title: 'Leave no pad behind',
    say: 'Hop right first, and the last two pads lie in different directions from the frog: it can reach one, and the other is stranded. Hop left first, and the row leads on to the rest.',
    hint: 'Hop left, to the glowing pad.',
    praise: 'Think a hop or two ahead, so no pad is left alone.',
    board: POND_PLAN,
    target: p => padAt(p, 1, 0),
    goal: s => s.at === 1,
  },
  {
    title: 'Finish the pond',
    say: 'From here the frog can hop right along the row, then down, and every pad is visited.',
    hint: 'Follow the glowing pads.',
    praise:
      'That is the whole game: see which pads could be stranded, and reach them in time.',
    target: (p, s) => solveLily(p, s)?.[0] ?? -1,
    goal: s => isLilySolved(s),
  },
];

export function LilyPadsLesson({
  onDone,
}: {
  onDone: () => void;
}): React.JSX.Element {
  const [board, setBoard] = useState<{ puzzle: LilyPuzzle; state: LilyState }>(
    () => ({ puzzle: POND_LINE, state: initialLilyState(POND_LINE) }),
  );
  const flow = useLessonFlow(LILY_STEPS.length, i => {
    const fresh = LILY_STEPS[i].board;
    if (fresh) setBoard({ puzzle: fresh, state: initialLilyState(fresh) });
  });
  const step = LILY_STEPS[flow.index];
  const target = step.target(board.puzzle, board.state);
  const reach = useMemo(() => hopsFrom(board.puzzle, board.state), [board]);

  const onHop = useCallback(
    (pad: number) => {
      if (flow.phase !== 'doing') return;
      if (pad !== target) {
        flow.wrong();
        return;
      }
      const next = hop(board.puzzle, board.state, pad);
      setBoard(b => ({ ...b, state: next }));
      if (step.goal(next)) flow.succeed();
    },
    [flow, target, board, step],
  );

  return (
    <LessonShell
      gameName="Lily Pads"
      accent={accentColorForKind('lilypads')}
      steps={LILY_STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => (
        <LilyPadsBoard
          key={board.puzzle.id}
          puzzle={board.puzzle}
          state={board.state}
          size={size}
          solved={isLilySolved(board.state)}
          reach={reach}
          cutOff={cutOffOf(board.puzzle, board.state)}
          stranded={false}
          onHop={onHop}
          onRefused={flow.wrong}
          glow={flow.phase === 'doing' && target >= 0 ? target : null}
        />
      )}
    />
  );
}

// --- Weathervanes -------------------------------------------------------------

/** Four vanes at the corners of a square: one loop, round the square. */
export const ROOF: VanePuzzle = {
  id: 'lesson-vanes',
  name: 'Lesson',
  difficulty: 'easy',
  size: 3,
  vanes: [
    { row: 0, col: 0 },
    { row: 0, col: 2 },
    { row: 2, col: 0 },
    { row: 2, col: 2 },
  ],
  fixed: [null, null, null, null],
  // Top left up into the air; top right pointing back left; the bottom
  // two out over the edges.
  start: [0, 3, 3, 2],
  solution: [1, 2, 0, 3],
};

interface VaneStep extends LessonStepCopy {
  readonly vane: number;
  readonly dir: Dir;
}

const VANE_STEPS: ReadonlyArray<VaneStep> = [
  {
    title: 'Point at a vane',
    say: 'A vane points at the nearest vane that way. This one points up, into open air, and every vane must point at another.',
    hint: 'Tap the glowing vane to turn it a quarter, to the right.',
    praise:
      'It points at a vane now. But that vane points straight back, and both turn red.',
    vane: 0,
    dir: 1,
  },
  {
    title: 'Never back and forth',
    say: 'Two vanes may never point at each other: the wind would only go back and forth. Send this one down instead.',
    hint: 'Tap the glowing vane until it points down.',
    praise:
      'The wind passes on, and the vane below wears a blue ring: wind has reached it.',
    vane: 1,
    dir: 2,
  },
  {
    title: 'Pass the wind on',
    say: 'This vane points down, off the roof. Every vane passes the wind to the next, so turn it toward the vane on its left.',
    hint: 'Tap the glowing vane once.',
    praise: 'The wind reaches the last vane, but it still points off the roof.',
    vane: 3,
    dir: 3,
  },
  {
    title: 'Close the loop',
    say: 'Each vane must be reached by exactly one wind. Point this last one up, and the wind runs all the way round.',
    hint: 'Tap the glowing vane once, to point it up.',
    praise:
      'A closed loop through every vane. The roof is set, and the wind goes round.',
    vane: 2,
    dir: 0,
  },
];

export function VanesLesson({
  onDone,
}: {
  onDone: () => void;
}): React.JSX.Element {
  const [state, setState] = useState<VaneState>({ dirs: [...ROOF.start] });
  const flow = useLessonFlow(VANE_STEPS.length);
  const step = VANE_STEPS[flow.index];

  const onTurn = useCallback(
    (vane: number) => {
      if (flow.phase !== 'doing') return;
      if (vane !== step.vane) {
        flow.wrong();
        return;
      }
      const next = turn(ROOF, state, vane);
      setState(next);
      if (next.dirs[vane] === step.dir) flow.succeed();
    },
    [flow, step, state],
  );

  return (
    <LessonShell
      gameName="Weathervanes"
      accent={accentColorForKind('vanes')}
      steps={VANE_STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => (
        <VanesBoard
          puzzle={ROOF}
          state={state}
          size={size}
          solved={isVaneSolved(ROOF, state)}
          onTurn={onTurn}
          glow={flow.phase === 'doing' ? step.vane : null}
        />
      )}
    />
  );
}
