import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { renderVanesIllustration } from '../components/TrialIllustrations';
import { PlayShell, SetMode, TrialMode, TrialNote } from '../components/PlayShell';
import { GameKind, NextPuzzleOptions } from '../game/journey';
import { VanesBoard } from '../components/VanesBoard';
import { getVaneTrial, initialVaneState, isVaneSolved, loops, troubles, turn, unreached, VANE_TRIAL_IDS, vaneHint, VanePuzzle, VaneState } from '../game/vanes';
import { triggerFeedback } from '../game/rendering';
import { VANE_MECHANICS_SLIDES } from '../game/tutorials';
import { theme } from '../theme';

const RESERVED = 300;

const CHIMNEY_INTRO = {
  id: 'mechanic:chimney',
  title: 'Chimneys',
  body: 'Wind does not pass a chimney. A vane pointing at one is pointing into open air, so it has one way fewer to turn.',
};

export interface VanesScreenProps {
  puzzle: VanePuzzle;
  onExit: () => void;
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

/** Weathervanes, as dealt in a set, the Daily or the Grand. */
export function VanesScreen({ puzzle, onExit, onNextPuzzle }: VanesScreenProps): React.JSX.Element {
  return <Roof puzzle={puzzle} mode={{ type: 'set', puzzleId: puzzle.id, onNextPuzzle }} onExit={onExit} />;
}

/**
 * Weathervanes from the Home test button: a run of roofs, small to large,
 * after the lesson the first time.
 */
export function VanesTrialScreen({ onExit }: { onExit: () => void }): React.JSX.Element {
  const [index, setIndex] = useState(0);
  return (
    <Roof
      key={index}
      puzzle={getVaneTrial(index)}
      mode={{ type: 'trial', index, total: VANE_TRIAL_IDS.length, onNext: () => setIndex(i => Math.min(i + 1, VANE_TRIAL_IDS.length - 1)) }}
      onExit={onExit}
    />
  );
}

function Roof({ puzzle, mode, onExit }: { puzzle: VanePuzzle; mode: TrialMode | SetMode; onExit: () => void }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [state, setState] = useState<VaneState>(() => initialVaneState(puzzle));
  // Vanes the player has turned: the rest stay quiet until then.
  const [touched, setTouched] = useState<boolean[]>(() => puzzle.vanes.map(() => false));
  const [history, setHistory] = useState<VaneState[]>([]);
  const [hints, setHints] = useState(0);
  const [glow, setGlow] = useState<number | null>(null);
  const [note, setNote] = useState<TrialNote | null>(null);

  const solved = useMemo(() => isVaneSolved(puzzle, state), [puzzle, state]);
  const trouble = useMemo(() => troubles(puzzle, state).filter((t, i) => t !== null && touched[i]).length, [puzzle, state, touched]);
  const waiting = useMemo(() => unreached(puzzle, state), [puzzle, state]);
  const free = puzzle.vanes.length;

  const solvedOnce = useRef(false);
  useEffect(() => {
    if (solved && !solvedOnce.current) {
      solvedOnce.current = true;
      triggerFeedback('vaneSolve');
    }
    if (!solved) solvedOnce.current = false;
  }, [solved]);

  const loopCount = useRef(0);
  const onTurn = useCallback(
    (vane: number) => {
      if (solved) return;
      const next = turn(puzzle, state, vane);
      if (next === state) {
        triggerFeedback('vaneAstray');
        return;
      }
      setHistory(h => [...h, state]);
      setState(next);
      setGlow(null);
      setTouched(t => t.map((v, i) => v || i === vane));
      // A loop that just closed gets its own sound; a vane newly astray a
      // muted one; any other turn its tick.
      const trouble = troubles(puzzle, next);
      const closed = loops(puzzle, next).filter(l => l.length >= 3 && l.every(i => trouble[i] === null)).length;
      if (isVaneSolved(puzzle, next)) triggerFeedback('vaneTurn');
      else if (closed > loopCount.current) triggerFeedback('vaneLoop');
      else if (trouble[vane] !== null) triggerFeedback('vaneAstray');
      else triggerFeedback('vaneTurn');
      loopCount.current = closed;
    },
    [puzzle, state, solved],
  );

  const undo = useCallback(() => {
    if (history.length === 0) return;
    setState(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    triggerFeedback('vaneTurn');
  }, [history]);

  const restart = useCallback(() => {
    setState(initialVaneState(puzzle));
    setHistory([]);
    setGlow(null);
    setTouched(puzzle.vanes.map(() => false));
  }, [puzzle]);

  const useHint = useCallback(() => {
    const h = vaneHint(puzzle, state);
    if (!h) return false;
    setHistory(past => [...past, state]);
    setState(h.state);
    setGlow(h.vane);
    setTouched(t => t.map((v, i) => v || i === h.vane));
    setHints(n => n + 1);
    setNote({ reason: h.reason, kind: troubles(puzzle, state)[h.vane] !== null ? 'fix' : 'rule', id: Date.now() });
    triggerFeedback('targetReached');
  }, [puzzle, state]);

  const boardSize = Math.max(0, Math.min(width - theme.spacing.lg * 2 - theme.spacing.sm * 2, height - insets.top - insets.bottom - RESERVED));
  const kicker = solved ? 'the wind is set' : trouble > 0 ? `${trouble} astray` : `${waiting} still calm`;

  return (
    <PlayShell
      kind="vanes"
      mode={mode}
      name={puzzle.name}
      difficulty={puzzle.difficulty}
      kicker={kicker}
      progress={solved ? 1 : (free - waiting) / free}
      introduce={puzzle.chimneys?.length ? CHIMNEY_INTRO : null}
      slides={VANE_MECHANICS_SLIDES}
      renderIllustration={renderVanesIllustration}
      solved={solved}
      hints={hints}
      note={note}
      onClearNote={() => setNote(null)}
      canUndo={history.length > 0}
      onExit={onExit}
      onHint={useHint}
      onUndo={undo}
      onRestart={restart}
    >
      <VanesBoard puzzle={puzzle} state={state} size={boardSize} solved={solved} onTurn={onTurn} glow={glow} touched={touched} />
    </PlayShell>
  );
}
