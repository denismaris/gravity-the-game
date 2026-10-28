import React, { useCallback, useState } from 'react';
import { GLASS_LESSON_WINDOW as WINDOW, GlassColor, GlassPuzzle, GlassState, initialGlassState, isGlassSolved, paint, touchingOf, trayOf } from '../../game/glass';
import { accentColorForKind } from '../../game/journey';
import { GlassBoard, StrokePhase } from '../GlassBoard';
import { LessonShell, LessonStepCopy, useLessonFlow } from './LessonShell';

interface GlassStep extends LessonStepCopy {
  readonly pane: number;
  readonly color: GlassColor;
  /** The last step: a window of the player's own, every glass theirs to choose. */
  readonly free?: boolean;
}

const FREE_PANES = [
  [0, 0, 1, 1],
  [2, 2, 1, 1],
  [2, 3, 3, 4],
  [5, 5, 3, 4],
];
/** Six pieces, two of them set: one way to finish it. */
export const FREE_WINDOW: GlassPuzzle = {
  id: 'lesson-glass-2',
  name: 'Lesson',
  difficulty: 'easy',
  rows: 4,
  cols: 4,
  paneOf: FREE_PANES,
  panes: 6,
  touching: touchingOf(FREE_PANES, 6),
  given: [0, 1, null, null, null, null],
  solution: [0, 1, 2, 0, 2, 1],
};

const STEPS: ReadonlyArray<GlassStep> = [
  {
    title: 'Touching pieces differ',
    say: 'The middle piece touches red and blue. Touching pieces cannot match, so it must be yellow.',
    hint: 'Yellow is picked. Tap the glowing piece.',
    praise: 'Yellow, the only colour left for it.',
    pane: 4,
    color: 2,
  },
  {
    title: 'Look at the neighbours',
    say: 'This piece touches red above it and the yellow you just set. Only one colour is left.',
    hint: 'Blue is picked. Tap the glowing piece.',
    praise: 'Each piece you colour helps with the next one.',
    pane: 2,
    color: 1,
  },
  {
    title: 'Finish the window',
    say: 'The last piece touches blue and yellow. Red is fine here, even though red is already in the window. Only touching pieces must be different.',
    hint: 'Red is picked. Tap the glowing piece.',
    praise: 'Every piece coloured, and no two touching pieces match. The window is done.',
    pane: 3,
    color: 0,
  },
  {
    title: 'Your turn',
    say: 'A new window. Colour every piece, and keep touching pieces different. Start next to the coloured ones.',
    hint: 'Tap a piece to change its colour.',
    praise: 'Every piece coloured, none touching its match. A whole window, by you.',
    pane: -1,
    color: 0,
    free: true,
  },
];

export function GlassLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState<GlassState>(() => initialGlassState(WINDOW));
  // The last step brings its own window.
  const flow = useLessonFlow(STEPS.length, i => {
    if (STEPS[i].free) setState(initialGlassState(FREE_WINDOW));
  });
  const step = STEPS[flow.index];
  const glass = step.free ? FREE_WINDOW : WINDOW;

  const stroke = useCallback(
    (pane: number, phase: StrokePhase) => {
      if (phase !== 'start' || flow.phase !== 'doing') return;
      if (step.free) {
        if (FREE_WINDOW.given[pane] !== null) return flow.wrong();
        // Each tap moves the piece on to the next glass.
        const tray = trayOf(FREE_WINDOW);
        const now = state.colors[pane];
        const next = paint(FREE_WINDOW, state, pane, tray[(now === null ? -1 : tray.indexOf(now)) + 1] ?? tray[0]);
        setState(next);
        if (isGlassSolved(FREE_WINDOW, next)) flow.succeed();
        return;
      }
      if (pane !== step.pane) {
        if (WINDOW.given[pane] === null && state.colors[pane] === null) flow.wrong();
        return;
      }
      setState(s => paint(WINDOW, s, pane, step.color));
      flow.succeed();
    },
    [flow, step, state],
  );

  const done = flow.phase === 'done';
  return (
    <LessonShell
      gameName="Stained Glass"
      accent={accentColorForKind('glass')}
      steps={STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => <GlassBoard key={step.free ? 'free' : 'guided'} puzzle={glass} state={state} size={size} solved={done} onStroke={stroke} glow={flow.phase === 'doing' && !step.free ? step.pane : null} />}
    />
  );
}
