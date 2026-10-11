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
    title: 'Touching panes differ',
    say: 'The centre pane touches the ruby and the cobalt. Two panes that share lead can never share a colour, so only amber is left for it.',
    hint: 'Amber is in your hand. Tap the glowing pane.',
    praise: 'Amber, the one glass its neighbours left free.',
    pane: 4,
    color: 2,
  },
  {
    title: 'Read the neighbours',
    say: 'This pane touches the ruby above it and the amber you just set. That leaves one glass.',
    hint: 'Cobalt is in your hand. Tap the glowing pane.',
    praise: 'Each pane you set narrows the ones beside it.',
    pane: 2,
    color: 1,
  },
  {
    title: 'Finish the window',
    say: 'The last pane touches cobalt twice and amber once. Ruby can go here, even though it is already in the window: only touching panes have to differ.',
    hint: 'Ruby is in your hand. Tap the glowing pane.',
    praise: 'Every pane glazed and no two neighbours alike. The light comes through.',
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
