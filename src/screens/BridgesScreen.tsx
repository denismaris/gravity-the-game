import { RoundKey } from '../components/RoundKey';
import { isStandalonePuzzle } from '../game/journey/daily';
import { DockFloor, DockGap, dockPlate, StageTopGap } from '../components/StageTopGap';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Path } from '@shopify/react-native-skia';
import {
  BridgesPuzzle,
  BridgesState,
  blockingLink,
  bridgeLinks,
  bridgesLeft,
  canBuild,
  cycleBridge,
  setBridges,
  emptyBridgesState,
  isBridgesSolved,
  islandLoads,
  explainBridgesHint } from '../game/bridges';
import { BridgesBoard, LevelSetComplete, MechanicsCarousel, PuzzleSolved, renderBridgesIllustration, useSolveCelebration } from '../components';
import { PageBloom } from '../components/PageBloom';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { mechanic } from '../game/mechanics';
import { MechanicIntro } from '../components/MechanicIntro';
import { playHapticEvents, triggerFeedback, triggerSound } from '../game/rendering';
import { BRIDGES_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { theme, themedStyles } from '../theme';
import { CoinBalance, useCoinPurchase } from '../components/Coins';
import { InsightButton, useInsightPower } from '../components/InsightPower';
import { UNDO_COST } from '../progression/coins';
import { useStageEntrance } from '../components/useStageEntrance';
import { buildDurationMs, buildTimeAt } from '../components/bridgesMotion';
import { PlayHeader } from '../components/PlayHeader';
import { isTodaysDaily } from '../game/journey';
import { savedBoard, useSaveBoard } from '../progression/boardSaves';
import { useHintNote } from '../components/HintNote';

const TUTORIAL_ID = tutorialIdForGame('bridges');
const ICON_SIZE = 14;
const RESERVED = 300;
const STAGE_H_PADDING = theme.spacing.sm;
const HINT_FLASH_MS = 1500;
/** When a laid bridge reaches its shore - the board's build eases out, so
 * the bridge is all but down at 80% of its time; the island dips, and its
 * "island met" tap lands, right there. */
const landingMs = (squares: number): number => buildDurationMs(squares) * 0.8;
const gameAccent = (): string => theme.colors.bridgesAccent;

function UndoIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 9.83 3.63 A 4.4 4.4 0 1 1 3.63 4.17" color={gameAccent()} style="stroke" strokeWidth={1.6} />
      <Path path="M 4.34 3.33 L 1.21 4.1 L 4.12 6.54 Z" color={gameAccent()} />
    </Canvas>
  );
}

function RestartIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 4.17 3.63 A 4.4 4.4 0 1 0 10.37 4.17" color={gameAccent()} style="stroke" strokeWidth={1.6} />
      <Path path="M 9.66 3.33 L 12.79 4.1 L 9.88 6.54 Z" color={gameAccent()} />
    </Canvas>
  );
}

/**
 * A bridge being laid, felt plank by plank: a light wooden click for each
 * plank as it drops into place, rising as the bridge grows, then a firm
 * knock as it reaches the shore - timed to the board's own build. iOS
 * only - Android's motor plays one waveform at a time and gets the plain
 * `bridgesBuild` tap instead.
 */
function layingPattern(squares: number): Array<{ time: number; type: 'transient' | 'continuous'; duration?: number; intensity: number; sharpness: number }> {
  const planks = Math.max(3, Math.min(9, Math.round(squares * 2.2)));
  const duration = buildDurationMs(squares);
  const landing = landingMs(squares);
  const events: Array<{ time: number; type: 'transient' | 'continuous'; duration?: number; intensity: number; sharpness: number }> = [];
  // One click as each plank lands - on the board's own ease-out curve, so
  // they come quick at first and slow into the shore, in step with the
  // planks you can see.
  for (let i = 0; i < planks; i += 1) {
    const time = buildTimeAt((i + 0.5) / planks) * duration;
    if (time < landing - 12) events.push({ time, type: 'transient', intensity: 0.24 + (0.22 * i) / planks, sharpness: 0.7 });
  }
  events.push({ time: landing, type: 'transient', intensity: 0.9, sharpness: 0.45 });
  events.push({ time: landing, type: 'continuous', duration: 45, intensity: 0.45, sharpness: 0.15 });
  return events;
}

export interface BridgesScreenProps {
  puzzle: BridgesPuzzle;
  onExit: () => void;
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

/**
 * Bridges: join numbered islands with straight bridges - one or two per
 * pair, never crossing - until every number is met and the archipelago is
 * one. Same frame as every other play screen, so a batch that deals it
 * reads as another page of the same almanac.
 */
export function BridgesScreen({ puzzle, onExit, onNextPuzzle }: BridgesScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const stageIn = useStageEntrance();
  const controlsIn = useStageEntrance(110);
  const { width, height } = useWindowDimensions();
  const { progress, recordCompletion } = usePlayerProgress();
  const { markTutorialSeen } = useSettings();

  const [showTutorial, setShowTutorial] = useState(false);
  const dismissTutorial = useCallback(() => {
    markTutorialSeen(TUTORIAL_ID);
    setShowTutorial(false);
  }, [markTutorialSeen]);
  const reopenTutorial = useCallback(() => setShowTutorial(true), []);

  const nextEntry = useMemo(() => (progress.currentBatch ? nextInBatch(progress.currentBatch) : null), [progress.currentBatch]);
  // A board left half played opens as it was left (not the timed Daily,
  // whose clock would start again): see `boardSaves`.
  const resumable = !isTodaysDaily(puzzle.id);
  const [resumed] = useState(() => (resumable ? savedBoard(puzzle.id, emptyBridgesState(puzzle)) : null));
  const [state, setState] = useState<BridgesState>(() => resumed?.state ?? emptyBridgesState(puzzle));
  const stateRef = useRef(state);
  stateRef.current = state;
  const historyRef = useRef<BridgesState[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const { coins, shortBy, buy } = useCoinPurchase();
  // Insight, the superpower: charges first, then a video or coins.
  const insight = useInsightPower();
  const spendInsight = insight.spend;
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [hints, setHints] = useState(() => resumed?.extras.hints ?? 0);
  const [origin, setOrigin] = useState<{ link: number; at: number } | null>(null);
  const [flashLink, setFlashLink] = useState<number | null>(null);
  const [blocked, setBlocked] = useState<{ link: number; at: number } | null>(null);
  const [introKey, setIntroKey] = useState(0);
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const recorded = useRef(false);
  const batchCompletedRef = useRef(false);
  const finishedSetRef = useRef<BatchState | null>(null);
  const [showSetComplete, setShowSetComplete] = useState(false);
  const currentBatchRef = useRef(progress.currentBatch);
  currentBatchRef.current = progress.currentBatch;

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const solved = useMemo(() => isBridgesSolved(puzzle, state), [puzzle, state]);
  useSaveBoard(puzzle.id, state, solved, { hints }, resumable);
  // Why the hint made its move, said once above the keys.
  const { note: hintNote, show: showHint } = useHintNote();
  const left = useMemo(() => bridgesLeft(puzzle, state), [puzzle, state]);
  const showSolvedCard = useSolveCelebration(solved);

  useEffect(() => {
    if (solved && !recorded.current) {
      recorded.current = true;
      finishedSetRef.current = currentBatchRef.current ?? null;
      const outcome = recordCompletion(puzzle.id, hints);
      batchCompletedRef.current = outcome.batchCompleted;
      setStars(outcome.best.stars);
      setCoinsEarned(outcome.coinsEarned);
      // Let the last bridge land before the fanfare.
      timersRef.current.push(setTimeout(() => triggerFeedback('bridgesSolve'), 320));
    }
  }, [solved, hints, puzzle.id, recordCompletion]);

  /** Applies a new board with the right feel - computed from the live
   * board, never inside a state updater (React may run one twice). */
  const commit = useCallback(
    (next: BridgesState, link: number, at: number) => {
      const current = stateRef.current;
      if (next === current) return;
      historyRef.current.push(current);
      setCanUndo(true);
      stateRef.current = next;
      setOrigin({ link, at });
      setState(next);

      const built = next.bridges[link] > current.bridges[link];
      if (!built) {
        triggerFeedback('bridgesRemove');
        return;
      }
      const lane = bridgeLinks(puzzle)[link];
      const squares = Math.abs(puzzle.islands[lane.a].row - puzzle.islands[lane.b].row) + Math.abs(puzzle.islands[lane.a].col - puzzle.islands[lane.b].col);
      if (Platform.OS === 'ios') {
        triggerSound('bridgesBuild');
        playHapticEvents(layingPattern(squares));
      } else {
        triggerFeedback('bridgesBuild');
      }
      if (isBridgesSolved(puzzle, next)) return;
      const before = islandLoads(puzzle, current);
      const after = islandLoads(puzzle, next);
      const metNow = puzzle.islands.some((isl, i) => after[i] === isl.need && before[i] !== isl.need);
      if (metNow) timersRef.current.push(setTimeout(() => triggerFeedback('bridgesIsland'), landingMs(squares) + 20));
    },
    [puzzle],
  );

  const refuse = useCallback(
    (link: number) => {
      const blocker = blockingLink(puzzle, stateRef.current, link);
      if (blocker === null) return;
      setBlocked({ link: blocker, at: Date.now() });
      triggerFeedback('refuse');
    },
    [puzzle],
  );

  /** One more bridge on a lane, built out from `at` - or refused, with
   * the blocking bridge flashing, if it would cross one. */
  const build = useCallback(
    (link: number, at: number) => {
      const current = stateRef.current;
      if (current.bridges[link] === 0 && !canBuild(puzzle, current, link)) {
        refuse(link);
        return;
      }
      commit(cycleBridge(puzzle, current, link), link, at);
    },
    [puzzle, commit, refuse],
  );

  // A screen reader's swipe on a lane: exactly one bridge more or fewer.
  const onAdjustLane = useCallback(
    (link: number, delta: 1 | -1) => {
      const current = stateRef.current;
      const count = current.bridges[link] + delta;
      if (count < 0 || count > 2) return;
      if (current.bridges[link] === 0 && !canBuild(puzzle, current, link)) {
        refuse(link);
        return;
      }
      commit(setBridges(current, link, count), link, 0.5);
    },
    [puzzle, commit, refuse],
  );

  // Dragged from an island: built out from that island's end of the lane.
  const onLane = useCallback((link: number, island: number) => build(link, bridgeLinks(puzzle)[link].a === island ? 0 : 1), [puzzle, build]);
  // Tapped on the water: built out from the spot tapped.
  const onTapLane = useCallback((link: number, at: number) => build(link, at), [build]);

  // The last hint's reason, shown over the board for a few seconds.
  const useHint = useCallback(() => {
    const result = explainBridgesHint(puzzle, stateRef.current);
    if (!result) return;
    spendInsight(() => {
      showHint(result as { reason?: string; tip?: string });
      historyRef.current.push(stateRef.current);
      setCanUndo(true);
      stateRef.current = result.state;
      setOrigin({ link: result.link, at: 0.5 });
      setState(result.state);
      setHints(n => n + 1);
      setFlashLink(result.link);
      timersRef.current.push(setTimeout(() => setFlashLink(null), HINT_FLASH_MS));
      triggerFeedback('targetReached');
    });
  }, [puzzle, spendInsight, showHint]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0 || solved) return;
    buy(UNDO_COST, () => {
      const previous = historyRef.current.pop();
      if (!previous) return;
      setCanUndo(historyRef.current.length > 0);
      stateRef.current = previous;
      setOrigin(null);
      setState(previous);
      triggerFeedback('bridgesRemove');
    });
  }, [buy, solved]);

  const restart = useCallback(() => {
    recorded.current = false;
    batchCompletedRef.current = false;
    setStars(null);
    setHints(0);
    setFlashLink(null);
    setBlocked(null);
    setOrigin(null);
    historyRef.current = [];
    setCanUndo(false);
    const fresh = emptyBridgesState(puzzle);
    stateRef.current = fresh;
    setState(fresh);
    setIntroKey(k => k + 1);
  }, [puzzle]);

  const goNext = useCallback(() => {
    if (nextEntry) onNextPuzzle(nextEntry.kind, nextEntry.puzzleId, { showInterstitial: batchCompletedRef.current });
  }, [nextEntry, onNextPuzzle]);

  const boardSize = Math.max(0, Math.min(width - theme.spacing.md * 2 - STAGE_H_PADDING * 2, height - insets.top - insets.bottom - RESERVED));


  return (
    <View style={styles.container}>
      <PageBloom />
      <PlayHeader
        kind="bridges"
        difficulty={puzzle.difficulty}
        status={solved ? 'All connected' : left < 0 ? `${-left} too many` : `${left} to build`}
        solved={solved}
        puzzleId={puzzle.id}
        onExit={onExit}
        onHelp={reopenTutorial}
      />

      <View style={styles.boardArea}>
        <StageTopGap />
        <Animated.View style={[styles.stage, stageIn]}>
          {/* Finished: the board takes no more touches. Never collapsed: on
              Android a flattened wrapper is re-created when its touches
              change, and the board canvas under it redraws from blank - a
              white flash at every finish. */}
          <View collapsable={false} pointerEvents={solved ? 'none' : 'auto'}>
            <BridgesBoard
              puzzle={puzzle}
              state={state}
              size={boardSize}
              solved={solved}
              onLane={onLane}
              onTapLane={onTapLane}
              onAdjustLane={onAdjustLane}
              origin={origin}
              flashLink={flashLink}
              blocked={blocked}
              introKey={introKey}
            />
          </View>
        </Animated.View>

        <DockGap />
        {/* Finished: the keys take no more touches. The card is a beat
          away, and a fast Restart in that beat threw a solved board away. */}
        <Animated.View pointerEvents={solved ? "none" : "auto"} style={[styles.controls, dockPlate.plate, controlsIn]}>
          <InsightButton count={insight.count} onPress={useHint} progress={state} />
          {insight.sheet}
          <RoundKey accessibilityLabel="Undo last move" accessibilityState={{ disabled: !canUndo }} onPress={undo} dim={!canUndo}>
            <UndoIcon />
          </RoundKey>
          <RoundKey accessibilityLabel="Restart puzzle" confirm="Tap again to restart" onPress={restart}>
            <RestartIcon />
          </RoundKey>
        </Animated.View>
        {/* Coins only matter here once Insight runs out: until then the
          line keeps its place but stays out of sight. */}
        <View style={insight.count > 0 && !shortBy ? styles.quiet : undefined} accessibilityElementsHidden={insight.count > 0 && !shortBy} importantForAccessibility={insight.count > 0 && !shortBy ? 'no-hide-descendants' : 'auto'}>
          <CoinBalance coins={coins} shortBy={shortBy} style={styles.coinBalance} />
        </View>
        <DockFloor />
      </View>

      {hintNote}

      {showSolvedCard && stars && !showSetComplete && (
        <PuzzleSolved
          kind="bridges"
          stars={stars}
          hintsUsed={hints}
          coinsEarned={coinsEarned}
          onDone={onExit}
          hasNext={nextEntry !== null && !isStandalonePuzzle(puzzle.id)}
          onNext={batchCompletedRef.current && finishedSetRef.current ? () => setShowSetComplete(true) : goNext}
        />
      )}

      {showSetComplete && finishedSetRef.current && (
        <LevelSetComplete levelNumber={finishedSetRef.current.levelNumber} kinds={finishedSetRef.current.puzzles.map(p => p.kind)} onContinue={goNext} />
      )}

      <MechanicIntro intros={puzzle.islands.some(i => i.fog) ? [mechanic('mechanic:bridges-fog')] : []} accent={accentColorForKind('bridges')} />
      {showTutorial && <MechanicsCarousel slides={BRIDGES_MECHANICS_SLIDES} renderIllustration={renderBridgesIllustration} onDone={dismissTutorial} accentColor={accentColorForKind('bridges')} />}
    </View>
  );
}

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  stage: {
    borderRadius: 28,
    paddingHorizontal: STAGE_H_PADDING,
    paddingVertical: theme.spacing.md,
  },
  controls: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  coinBalance: { marginTop: theme.spacing.md },
  quiet: { opacity: 0 },
}));
