import React, { useCallback, useState } from 'react';
import { GLASS_LESSON_WINDOW as WINDOW, GlassColor, GlassState, initialGlassState, paint } from '../../game/glass';
import { accentColorForKind } from '../../game/journey';
import { GlassBoard, StrokePhase } from '../GlassBoard';
import { LessonShell, LessonStepCopy, useLessonFlow } from './LessonShell';

interface GlassStep extends LessonStepCopy {
  readonly pane: number;
  readonly color: GlassColor;
}

const STEPS: ReadonlyArray<GlassStep> = [
  {
    title: 'Touching pieces differ',
    say: 'The middle piece touches red and blue. Touching pieces cannot match, so it must be yellow.',
    hint: 'Yellow is picked. Tap the glowing piece.',
    praise: 'Yellow! The only colour left for it.',
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
    praise: 'Every piece coloured, and no touching pieces match. You did it!',
    pane: 3,
    color: 0,
  },
];

export function GlassLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState<GlassState>(() => initialGlassState(WINDOW));
  const flow = useLessonFlow(STEPS.length);
  const step = STEPS[flow.index];

  const stroke = useCallback(
    (pane: number, phase: StrokePhase) => {
      if (phase !== 'start' || flow.phase !== 'doing') return;
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
      renderBoard={size => <GlassBoard puzzle={WINDOW} state={state} size={size} solved={done} onStroke={stroke} glow={flow.phase === 'doing' ? step.pane : null} />}
    />
  );
}
