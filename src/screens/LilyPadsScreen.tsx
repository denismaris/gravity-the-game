import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HOP_MS, LilyPadsBoard } from '../components/LilyPadsBoard';
import { renderLilyIllustration } from '../components/TrialIllustrations';
import { PlayShell, SetMode, TrialMode } from '../components/PlayShell';
import { GameKind, NextPuzzleOptions } from '../game/journey';
import { cutOff, getLilyTrial, hop, hopsFrom, initialLilyState, isLilySolved, isStranded, LILY_TRIAL_IDS, LilyPuzzle, LilyState, lilyHint, padsLeft } from '../game/lilypads';
import { triggerFeedback } from '../game/rendering';
import { LILY_MECHANICS_SLIDES } from '../game/tutorials';
import { theme } from '../theme';
import { mechanic } from '../game/mechanics';

const RESERVED = 300;

const LOTUS_INTRO = {
  id: 'mechanic:lotus',
  title: 'Lotus pads',
  body: 'A pad with a flower does not sink the first time. When the frog leaves, only the flower sinks. Come back to it later. While it floats, it stops jumps like any pad.',
};

export interface LilyPadsScreenProps {
  puzzle: LilyPuzzle;
  onExit: () => void;
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

/** Lily Pads, as dealt in a set, the Daily or the Grand. */
export function LilyPadsScreen({ puzzle, onExit, onNextPuzzle }: LilyPadsScreenProps): React.JSX.Element {
  return <Pond puzzle={puzzle} mode={{ type: 'set', puzzleId: puzzle.id, onNextPuzzle }} onExit={onExit} />;
}

/**
 * Lily Pads from the Home test button: a run of ponds, small to large,
 * after the lesson the first time.
 */
export function LilyPadsTrialScreen({ onExit }: { onExit: () => void }): React.JSX.Element {
  const [index, setIndex] = useState(0);
  // Each pond mounts fresh, so no frame ever pairs a pond with the last
  // one's frog.
  return (
    <Pond
      key={index}
      puzzle={getLilyTrial(index)}
      mode={{ type: 'trial', index, total: LILY_TRIAL_IDS.length, onNext: () => setIndex(i => Math.min(i + 1, LILY_TRIAL_IDS.length - 1)) }}
      onExit={onExit}
    />
  );
}

function Pond({ puzzle, mode, onExit }: { puzzle: LilyPuzzle; mode: TrialMode | SetMode; onExit: () => void }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [state, setState] = useState<LilyState>(() => initialLilyState(puzzle));
  const [history, setHistory] = useState<LilyState[]>([]);
  const [hints, setHints] = useState(0);
  const [glow, setGlow] = useState<number | null>(null);

  const solved = isLilySolved(state);
  const stranded = isStranded(puzzle, state);
  const reach = useMemo(() => hopsFrom(puzzle, state), [puzzle, state]);
  const lonely = useMemo(() => cutOff(puzzle, state), [puzzle, state]);
  const left = padsLeft(state) - (state.stones?.[state.at] ? 0 : 1);
  const total = puzzle.pads.filter((_p, i) => !puzzle.stones?.[i]).length;

  // Sounds land with the frog, not with the finger.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  // One hop at a time. A tap that came while the frog was still in the air
  // started the next hop from where the frog *would* be, so on quick taps
  // it seemed to teleport. Now a tap mid-hop waits, and is made the moment
  // the frog lands - quick taps still all count.
  const landsAt = useRef(0);
  const queued = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHopRef = useRef<(pad: number) => void>(() => {});
  useEffect(() => () => {
    if (queued.current) clearTimeout(queued.current);
  }, []);

  const onHop = useCallback(
    (pad: number) => {
      const wait = landsAt.current - Date.now();
      if (wait > 0) {
        if (queued.current) clearTimeout(queued.current);
        queued.current = setTimeout(() => {
          queued.current = null;
          onHopRef.current(pad);
        }, wait);
        return;
      }
      const next = hop(puzzle, state, pad);
      if (next === state) return;
      landsAt.current = Date.now() + HOP_MS;
      setHistory(h => [...h, state]);
      setState(next);
      setGlow(null);
      triggerFeedback('lilyHop');
      if (isLilySolved(next)) later(() => triggerFeedback('lilySolve'), HOP_MS + 120);
      else if (cutOff(puzzle, next).length > cutOff(puzzle, state).length) later(() => triggerFeedback('lilyWarn'), HOP_MS + 80);
      else if (isStranded(puzzle, next)) later(() => triggerFeedback('lilyStranded'), HOP_MS + 80);
    },
    [puzzle, state],
  );

  onHopRef.current = onHop;

  const undo = useCallback(() => {
    if (history.length === 0) return;
    // Undo always answers - and drops any hop still waiting to be made.
    if (queued.current) clearTimeout(queued.current);
    queued.current = null;
    landsAt.current = 0;
    setState(history[history.length - 1]);
    setHistory(h => h.slice(0, -1));
    setGlow(null);
    triggerFeedback('tap');
  }, [history]);

  const restart = useCallback(() => {
    if (queued.current) clearTimeout(queued.current);
    queued.current = null;
    landsAt.current = 0;
    setState(initialLilyState(puzzle));
    setHistory([]);
    setGlow(null);
  }, [puzzle]);

  const useHint = useCallback(() => {
    // Still in the air: no hint yet, and nothing charged.
    if (landsAt.current > Date.now()) return false;
    const h = lilyHint(puzzle, history, state);
    if (!h) return false;
    // Back to where the way is still open, if it is not, and then the hop
    // itself: the frog makes the move, not just points at it.
    let s = state;
    let past = history;
    for (let k = 0; k < h.back; k += 1) {
      s = past[past.length - 1];
      past = past.slice(0, -1);
    }
    const next = hop(puzzle, s, h.pad);
    if (next === s) {
      setHistory(past);
      setState(s);
      setGlow(h.pad);
    } else {
      landsAt.current = Date.now() + HOP_MS;
      setHistory([...past, s]);
      setState(next);
      setGlow(null);
      if (isLilySolved(next)) later(() => triggerFeedback('lilySolve'), HOP_MS + 120);
    }
    setHints(n => n + 1);
    triggerFeedback('lilyHop');
    return true;
  }, [puzzle, history, state]);

  const boardSize = Math.max(0, Math.min(width - theme.spacing.lg * 2 - theme.spacing.sm * 2, height - insets.top - insets.bottom - RESERVED));
  const kicker = solved
    ? 'pond cleared'
    : stranded
      ? 'stranded, undo a hop'
      : lonely.length > 0
        ? `${lonely.length === 1 ? 'a pad is' : `${lonely.length} pads are`} cut off`
        : `${left} ${left === 1 ? 'pad' : 'pads'} to go`;

  return (
    <PlayShell
      kind="lilypads"
      mode={mode}
      name={puzzle.name}
      difficulty={puzzle.difficulty}
      kicker={kicker}
      progress={(total - 1 - left) / Math.max(1, total - 1)}
      introduce={puzzle.lotus?.some(Boolean) ? LOTUS_INTRO : null}
      intros={puzzle.stones?.some(Boolean) ? [mechanic('mechanic:lily-stones')] : []}
      slides={LILY_MECHANICS_SLIDES}
      renderIllustration={renderLilyIllustration}
      solved={solved}
      hints={hints}
      canUndo={history.length > 0}
      onExit={onExit}
      onHint={useHint}
      onUndo={undo}
      onRestart={restart}
    >
      {/* Finished: the board takes no more touches. Never collapsed: on
              Android a flattened wrapper is re-created when its touches
              change, and the board canvas under it redraws from blank - a
              white flash at every finish. */}
      <View collapsable={false} pointerEvents={solved ? 'none' : 'auto'}>
        <LilyPadsBoard
          puzzle={puzzle}
          state={state}
          size={boardSize}
          solved={solved}
          reach={reach}
          cutOff={lonely}
          stranded={stranded}
          onHop={onHop}
          onRefused={() => triggerFeedback('bridgesBlocked')}
          glow={glow}
          trail={[...history.map(h => h.at), state.at]}
        />
      </View>
    </PlayShell>
  );
}
