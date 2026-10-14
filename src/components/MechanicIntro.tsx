import React, { useState } from 'react';
import { useSettings } from '../settings';
import { TutorialOverlay } from './TutorialOverlay';

/** A rule a board brings for the first time, explained once. */
export interface MechanicIntroCopy {
  /** Remembered once seen, like every tutorial (`mechanic:<name>`). */
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

/**
 * The "New on the board" card for a mechanic, shown over the game the
 * first time a board brings it and never again. Every game uses the same
 * one, so a new rule always arrives the same way, wherever it appears.
 * Waits for settings, so a board opened before they load still explains.
 */
export function MechanicIntro({ intros, accent }: { intros: ReadonlyArray<MechanicIntroCopy>; accent: string }): React.JSX.Element | null {
  const { ready, hasSeenTutorial, markTutorialSeen } = useSettings();
  const [dismissed, setDismissed] = useState<ReadonlyArray<string>>([]);
  // A board can bring two rules at once: they are explained one at a time.
  const intro = ready ? intros.find(i => !dismissed.includes(i.id) && !hasSeenTutorial(i.id)) : undefined;
  if (!intro) return null;
  return (
    <TutorialOverlay
      copy={{ title: intro.title, body: intro.body }}
      accentColor={accent}
      onDismiss={() => {
        markTutorialSeen(intro.id);
        setDismissed(d => [...d, intro.id]);
      }}
    />
  );
}
