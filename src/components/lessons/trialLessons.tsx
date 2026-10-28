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
    say: 'The frog jumps straight up, down, left or right, to the nearest pad that way. It can jump over water.',
    hint: 'Tap the glowing pad, or swipe toward it.',
    praise: 'It can jump far, as long as it is a straight line.',
    board: POND_LINE,
    target: p => padAt(p, 1, 3),
    goal: s => s.at === 1,
  },
  {
    title: 'The pad behind sinks',
    say: 'When the frog jumps off a pad, the pad sinks. The frog cannot go back.',
    hint: 'Jump to the glowing pad, and watch the pad you leave.',
    praise: 'That pad has sunk. Each one holds the frog only once.',
    board: POND_SINK,
    target: p => padAt(p, 0, 2),
    goal: s => s.at === 1,
  },
  {
    title: 'Visit every pad',
    say: 'The pond is clear when the frog has been on every pad.',
    hint: 'Jump down to the last pad.',
    praise: 'Every pad visited, and the frog is home.',
    target: p => padAt(p, 2, 2),
    goal: s => isLilySolved(s),
  },
  {
    title: 'Leave no pad behind',
    say: 'If the frog jumps right first, one of the last two pads gets left behind forever. If it jumps left first, it can reach them all.',
    hint: 'Jump left, to the glowing pad.',
    praise: 'Think a jump or two ahead, so no pad is left alone.',
    board: POND_PLAN,
    target: p => padAt(p, 1, 0),
    goal: s => s.at === 1,
  },
  {
    title: 'Finish the pond',
    say: 'Now the frog can jump right along the row, then down, and visit every pad.',
    hint: 'Follow the glowing pads.',
    praise:
      'That is the whole game: reach every pad before it gets cut off.',
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

/** Six vanes, two rows of three: the player's own roof, set without help.
 * One way round: along the top, down the right, back along the bottom. */
export const ROOF_FREE: VanePuzzle = {
  id: 'lesson-vanes-2',
  name: 'Lesson',
  difficulty: 'easy',
  size: 3,
  vanes: [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 2, col: 0 },
    { row: 2, col: 1 },
    { row: 2, col: 2 },
  ],
  fixed: [null, null, null, null, null, null],
  start: [0, 2, 3, 3, 0, 1],
  solution: [1, 1, 2, 0, 3, 3],
};

interface VaneStep extends LessonStepCopy {
  readonly vane: number;
  readonly dir: Dir;
  /** The last step: a roof of the player's own, no vane shown. */
  readonly free?: boolean;
}

const VANE_STEPS: ReadonlyArray<VaneStep> = [
  {
    title: 'Point at a vane',
    say: 'A vane points at the nearest vane in that direction. This one points up, at nothing. Every vane must point at another vane.',
    hint: 'Tap the glowing vane to turn it right.',
    praise:
      'Now it points at a vane. But that vane points straight back, so both turn red.',
    vane: 0,
    dir: 1,
  },
  {
    title: 'Never back and forth',
    say: 'Two vanes cannot point at each other, or the wind just goes back and forth. Point this one down instead.',
    hint: 'Tap the glowing vane until it points down.',
    praise:
      'The wind moves on. The vane below gets a blue ring: the wind reached it.',
    vane: 1,
    dir: 2,
  },
  {
    title: 'Pass the wind on',
    say: 'This vane points down, off the roof. Each vane must pass the wind to another vane. Turn it toward the vane on its left.',
    hint: 'Tap the glowing vane once.',
    praise: 'The wind reaches the last vane, but it still points off the roof.',
    vane: 3,
    dir: 3,
  },
  {
    title: 'Close the loop',
    say: 'Each vane must get wind from just one vane. Point this last one up, and the wind goes all the way round.',
    hint: 'Tap the glowing vane once, to point it up.',
    praise:
      'The wind goes round through every vane, and back to the start.',
    vane: 2,
    dir: 0,
  },
  {
    title: 'Your turn',
    say: 'A roof of six. Turn the vanes so the wind runs through every one and comes back round. No two may point at each other.',
    hint: 'Tap any vane to turn it.',
    praise: 'The wind runs round all six. You set a whole roof.',
    vane: -1,
    dir: 0,
    free: true,
  },
];

export function VanesLesson({
  onDone,
}: {
  onDone: () => void;
}): React.JSX.Element {
  const [state, setState] = useState<VaneState>({ dirs: [...ROOF.start] });
  // The last step brings its own, bigger roof.
  const flow = useLessonFlow(VANE_STEPS.length, i => {
    if (VANE_STEPS[i].free) setState({ dirs: [...ROOF_FREE.start] });
  });
  const step = VANE_STEPS[flow.index];
  const roof = step.free ? ROOF_FREE : ROOF;

  const onTurn = useCallback(
    (vane: number) => {
      if (flow.phase !== 'doing') return;
      if (step.free) {
        const next = turn(ROOF_FREE, state, vane);
        setState(next);
        if (isVaneSolved(ROOF_FREE, next)) flow.succeed();
        return;
      }
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
          key={step.free ? 'free' : 'guided'}
          puzzle={roof}
          state={state}
          size={size}
          solved={isVaneSolved(roof, state)}
          onTurn={onTurn}
          glow={flow.phase === 'doing' && !step.free ? step.vane : null}
        />
      )}
    />
  );
}
