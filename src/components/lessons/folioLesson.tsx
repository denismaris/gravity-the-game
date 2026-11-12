import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { applyFold, FolioFold, FolioPuzzle, FolioState, generateFolio, initialFolioState, isFolioSolved } from '../../game/folio';
import { accentColorForKind } from '../../game/journey';
import { FolioBoard, FolioTargetCard } from '../FolioBoard';
import { Icon } from '../Icon';
import { RoundKey } from '../RoundKey';
import { theme } from '../../theme';
import { LessonShell, LessonStepCopy, useLessonFlow } from './LessonShell';

/** A strip of three on bare paper backs: the first fold turns one over. */
const STRIP: FolioPuzzle = {
  id: 'lesson-folio',
  difficulty: 'easy',
  width: 3,
  height: 1,
  squares: [
    { front: 'vermilion', back: 'paper' },
    { front: 'indigo', back: 'paper' },
    { front: 'indigo', back: 'paper' },
  ],
  target: { width: 2, height: 1, inks: ['paper', 'indigo'] },
  par: 1,
};

/** Two rows with painted backs: folding the top down shows them. */
const ROWS: FolioPuzzle = {
  id: 'lesson-folio-2',
  difficulty: 'easy',
  width: 2,
  height: 2,
  squares: [
    { front: 'indigo', back: 'saffron' },
    { front: 'indigo', back: 'vermilion' },
    { front: 'paper', back: 'indigo' },
    { front: 'paper', back: 'indigo' },
  ],
  target: { width: 2, height: 1, inks: ['saffron', 'vermilion'] },
  par: 1,
};

/** The player's own: a real easy board, two folds. */
export const FOLIO_FREE: FolioPuzzle = generateFolio('lesson-folio-3', 'First Fold', 'easy');

const STEPS: ReadonlyArray<LessonStepCopy & { readonly fold: FolioFold | null; readonly puzzle: FolioPuzzle }> = [
  {
    title: 'Fold along a crease',
    say: 'The dashed lines are creases. Tap one and the smaller side folds over onto the rest.',
    hint: 'Tap the glowing crease.',
    praise: 'The red square turned over. Its back was bare paper, so paper faces up now.',
    fold: { axis: 'v', at: 1 },
    puzzle: STRIP,
  },
  {
    title: 'Read the corners',
    say: 'Each square has a small turned-up corner. It shows the colour on the back, the colour you get when that square folds over.',
    hint: 'Tap the glowing crease to fold the top row down.',
    praise: 'Gold and red, just as the corners showed.',
    fold: { axis: 'h', at: 1 },
    puzzle: ROWS,
  },
  {
    title: 'Your turn',
    say: 'Fold this sheet until it matches the target. It takes two folds. Undo opens a fold back out.',
    hint: 'Look for the squares that must change colour.',
    praise: 'A perfect match. That is the whole game.',
    fold: null,
    puzzle: FOLIO_FREE,
  },
];

export function FolioLesson({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [state, setState] = useState<FolioState>(initialFolioState);
  const flow = useLessonFlow(STEPS.length, () => setState(initialFolioState()));
  const step = STEPS[flow.index];
  const fold = useCallback(
    (f: FolioFold) => {
      if (flow.phase !== 'doing') return;
      if (step.fold) {
        if (f.axis !== step.fold.axis || f.at !== step.fold.at) return flow.wrong();
        setState(current => applyFold(step.puzzle, current, f));
        flow.succeed();
        return;
      }
      const next = applyFold(step.puzzle, state, f);
      setState(next);
      if (isFolioSolved(step.puzzle, next)) flow.succeed();
    },
    [flow, step, state],
  );
  const done = isFolioSolved(step.puzzle, state);
  return (
    <LessonShell
      gameName="Folio"
      accent={accentColorForKind('folio')}
      steps={STEPS}
      {...flow}
      onDone={onDone}
      renderBoard={size => (
        <View key={flow.index} style={styles.column}>
          {!step.fold && <FolioTargetCard puzzle={step.puzzle} />}
          <FolioBoard
            puzzle={step.puzzle}
            folds={state.folds}
            width={size}
            height={step.fold ? size * 0.8 : size * 0.62}
            solved={step.fold ? state.folds.length > 0 : done}
            onFold={fold}
            highlight={flow.phase === 'doing' ? step.fold : null}
          />
          {!step.fold && state.folds.length > 0 && !done && <UndoChip onPress={() => setState({ folds: state.folds.slice(0, -1) })} />}
        </View>
      )}
    />
  );
}

function UndoChip({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <RoundKey accessibilityLabel="Unfold" onPress={onPress}>
      <Icon name="undo" size={14} color={theme.colors.folioAccent} />
    </RoundKey>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: 12 },
});
