import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
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
  revealBridgesHint,
} from '../game/bridges';
import {
  BatchProgressDots,
  BridgesBoard,
  DifficultyChip,
  GeometricRule,
  LevelSetComplete,
  MechanicsCarousel,
  PressableScale,
  PuzzleSolved,
  renderBridgesIllustration,
  useSolveCelebration,
} from '../components';
import { PageBloom } from '../components/PageBloom';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { playHapticEvents, triggerFeedback, triggerSound } from '../game/rendering';
import { BRIDGES_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { motion, theme, themedStyles } from '../theme';
import { CoinBalance, CoinCost, useCoinPurchase } from '../components/Coins';
import { HINT_COST, UNDO_COST } from '../progression/coins';
import { useStageEntrance } from '../components/useStageEntrance';
import { buildDurationMs, buildTimeAt } from '../components/bridgesMotion';

const TUTORIAL_ID = tutorialIdForGame('bridges');
const ICON_SIZE = 14;
const RESERVED = 300;
const STAGE_H_PADDING = theme.spacing.sm;
const HINT_FLASH_MS = 520;
/** When a laid bridge reaches its shore - the board's build eases out, so
 * the bridge is all but down at 80% of its time; the island dips, and its
 * "island met" tap lands, right there. */
const landingMs = (squares: number): number => buildDurationMs(squares) * 0.8;
const gameAccent = (): string => theme.colors.bridgesAccent;

function HelpIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={7} r={6.3} color={theme.colors.textPrimary} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.1 5.6 A 1.9 1.9 0 1 1 7.9 7.3 C 7.15 7.75 7 8.1 7 8.9" color={theme.colors.textPrimary} style="stroke" strokeWidth={1.3} strokeCap="round" />
      <Circle cx={7} cy={10.9} r={0.75} color={theme.colors.textPrimary} />
    </Canvas>
  );
}

function HintIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={5.8} r={4.3} color={gameAccent()} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.4 9.4 L 8.6 9.4" color={gameAccent()} style="stroke" strokeWidth={1.3} />
      <Path path="M 5.7 11.2 L 8.3 11.2" color={gameAccent()} style="stroke" strokeWidth={1.3} />
      <Path path="M 6.3 12.6 L 7.7 12.6" color={gameAccent()} style="stroke" strokeWidth={1.1} />
    </Canvas>
  );
}

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
  const { ready: settingsReady, hasSeenTutorial, markTutorialSeen } = useSettings();

  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
    if (settingsReady && !hasSeenTutorial(TUTORIAL_ID)) setShowTutorial(true);
  }, [settingsReady, hasSeenTutorial]);
  const dismissTutorial = useCallback(() => {
    markTutorialSeen(TUTORIAL_ID);
    setShowTutorial(false);
  }, [markTutorialSeen]);
  const reopenTutorial = useCallback(() => setShowTutorial(true), []);

  const nextEntry = useMemo(() => (progress.currentBatch ? nextInBatch(progress.currentBatch) : null), [progress.currentBatch]);
  const [state, setState] = useState<BridgesState>(() => emptyBridgesState(puzzle));
  const stateRef = useRef(state);
  stateRef.current = state;
  const historyRef = useRef<BridgesState[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const { coins, shortBy, buy } = useCoinPurchase();
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [hints, setHints] = useState(0);
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
      triggerFeedback('bridgesBlocked');
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

  const useHint = useCallback(() => {
    const result = revealBridgesHint(puzzle, stateRef.current);
    if (!result) return;
    buy(HINT_COST, () => {
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
  }, [puzzle, buy]);

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

  const boardSize = Math.max(0, Math.min(width - theme.spacing.lg * 2 - STAGE_H_PADDING * 2, height - insets.top - insets.bottom - RESERVED));

  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8}>
          <Text style={styles.back}>‹ Home</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {puzzle.name ?? 'Bridges'}
          </Text>
          <AnimatedKicker left={left} solved={solved} difficulty={puzzle.difficulty} />
          {progress.currentBatch && <BatchProgressDots batch={progress.currentBatch} style={styles.batchDots} />}
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel="How to play" onPress={reopenTutorial} hitSlop={8} containerStyle={styles.headerRightSpacer}>
          <HelpIcon />
        </PressableScale>
      </View>

      <View style={styles.boardArea}>
        <Animated.View style={[styles.stage, stageIn]}>
          <GeometricRule variant="stage" style={styles.stageRule} />
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
        </Animated.View>

        <Animated.View style={[styles.controls, controlsIn]}>
          <PressableScale accessibilityRole="button" accessibilityLabel="Reveal a hint" onPress={useHint} style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}>
            <HintIcon />
            <Text style={styles.pillText}>Hint</Text>
            <CoinCost cost={HINT_COST} />
          </PressableScale>
          <PressableScale accessibilityRole="button" accessibilityLabel="Undo last move" onPress={undo} style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}>
            <UndoIcon />
            <Text style={styles.pillText}>Undo</Text>
            <CoinCost cost={UNDO_COST} muted={!canUndo} />
          </PressableScale>
          <PressableScale accessibilityRole="button" accessibilityLabel="Restart puzzle" onPress={restart} style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}>
            <RestartIcon />
            <Text style={styles.pillText}>Restart</Text>
          </PressableScale>
        </Animated.View>
        <CoinBalance coins={coins} shortBy={shortBy} style={styles.coinBalance} />
      </View>

      {showSolvedCard && stars && (
        <PuzzleSolved
          kind="bridges"
          stars={stars}
          hintsUsed={hints}
          coinsEarned={coinsEarned}
          onReplay={restart}
          onDone={onExit}
          hasNext={nextEntry !== null}
          onNext={batchCompletedRef.current && finishedSetRef.current ? () => setShowSetComplete(true) : goNext}
        />
      )}

      {showSetComplete && finishedSetRef.current && (
        <LevelSetComplete levelNumber={finishedSetRef.current.levelNumber} kinds={finishedSetRef.current.puzzles.map(p => p.kind)} onContinue={goNext} />
      )}

      {showTutorial && (
        <MechanicsCarousel slides={BRIDGES_MECHANICS_SLIDES} renderIllustration={renderBridgesIllustration} onDone={dismissTutorial} accentColor={accentColorForKind('bridges')} />
      )}
    </View>
  );
}

/** The kicker: bridges still to lay, popping as each one lands. */
function AnimatedKicker({ left, solved, difficulty }: { left: number; solved: boolean; difficulty: PuzzleDifficulty }): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const previous = useRef(left);
  const solvedScale = useRef(new Animated.Value(0)).current;
  const previousSolved = useRef(solved);

  useEffect(() => {
    if (left < previous.current) {
      scale.setValue(0.85);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    }
    previous.current = left;
  }, [left, scale]);

  useEffect(() => {
    if (solved && !previousSolved.current) {
      solvedScale.setValue(0);
      Animated.spring(solvedScale, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
    }
    previousSolved.current = solved;
  }, [solved, solvedScale]);

  const label = solved ? 'BRIDGES · ALL CONNECTED' : left < 0 ? `BRIDGES · ${-left} TOO MANY` : `BRIDGES · ${left} TO BUILD`;
  return (
    <View style={styles.kickerRow}>
      <DifficultyChip difficulty={difficulty} style={styles.kickerChip} />
      <Animated.Text numberOfLines={1} style={[styles.kicker, { transform: [{ scale }] }]}>
        {label}
      </Animated.Text>
      {solved && <Animated.View style={[styles.solvedBadge, { transform: [{ scale: solvedScale }] }]} />}
    </View>
  );
}

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: theme.spacing.md,
  },
  back: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRightSpacer: { width: 56, alignItems: 'center' },
  name: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.headline,
    lineHeight: theme.typography.lineHeights.headline,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 2,
  },
  kicker: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
    color: gameAccent(),
    flexShrink: 1,
  },
  kickerChip: { marginRight: 6 },
  solvedBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
    marginLeft: 5,
  },
  batchDots: {
    marginTop: theme.spacing.sm,
  },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageRule: {
    marginBottom: theme.spacing.sm,
  },
  stage: {
    borderRadius: 28,
    paddingHorizontal: STAGE_H_PADDING,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderStrong,
  },
  controls: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  coinBalance: { marginTop: theme.spacing.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderTopColor: theme.colors.highlightEdge,
    borderLeftColor: theme.colors.border,
    borderRightColor: theme.colors.border,
    borderBottomColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 3 },
    elevation: 2,
  },
  pillPressed: { backgroundColor: theme.colors.surfaceAlt, shadowOpacity: 0.04, shadowOffset: { width: 1, height: 1 }, elevation: 1 },
  pillText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
}));
