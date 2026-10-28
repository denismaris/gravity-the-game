import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RoundKey } from './RoundKey';
import { Animated, View } from 'react-native';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { isStandalonePuzzle } from '../game/journey/daily';
import { tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { CoinBalance, useCoinPurchase } from './Coins';
import { GameLesson } from './lessons';
import { LevelSetComplete } from './LevelSetComplete';
import { theme, themedStyles } from '../theme';
import { Icon } from './Icon';
import { InsightButton, useInsightPower } from './InsightPower';
import { PageBloom } from './PageBloom';
import { PuzzleSolved } from './PuzzleSolved';
import { DockFloor, DockGap, dockPlate, StageTopGap } from './StageTopGap';
import { MechanicsCarousel } from './MechanicsCarousel';
import { MechanicIntro, MechanicIntroCopy } from './MechanicIntro';
import { TutorialOverlay } from './TutorialOverlay';
import { TutorialSlide } from '../game/tutorials';
import { useSettings } from '../settings';
import { useSolveCelebration } from './useSolveCelebration';
import { useStageEntrance } from './useStageEntrance';
import { PlayHeader } from './PlayHeader';
import { useHintNote } from './HintNote';

const ICON_SIZE = 14;

/** A board played from the Home test button: a fixed run of boards, with
 * the game's lesson before the first one the first time. */
export interface TrialMode {
  readonly type: 'trial';
  readonly index: number;
  readonly total: number;
  readonly onNext: () => void;
}

/** A board dealt in a set (or the Daily, or the Grand): its solve is
 * recorded and paid, and Next leads on through the set. */
export interface SetMode {
  readonly type: 'set';
  readonly puzzleId: string;
  readonly onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

/**
 * The frame Lily Pads and Weathervanes are played in, laid out exactly as
 * the other game screens are: header with name, tier, kicker, progress
 * track and the set's dots; the board on its stage; Insight and the round
 * keys; the help carousel on "?"; the finish card, then on to the next.
 *
 * In a set it records the solve and pays for it, and Next leads on through
 * the set (or to the set's own finish). On trial it walks a fixed run of
 * boards, with the game's lesson before the first one the first time.
 */
export function PlayShell({
  kind,
  mode,
  difficulty,
  kicker,
  slides,
  renderIllustration,
  introduce,
  intros = [],
  solved,
  hints,
  canUndo,
  progress,
  onExit,
  onHint,
  onUndo,
  onRestart,
  children,
}: {
  kind: GameKind;
  mode: TrialMode | SetMode;
  difficulty: PuzzleDifficulty;
  kicker: string;
  /** A rule this board brings for the first time, explained once. */
  introduce?: { id: string; title: string; body: string } | null;
  /** Later rules this board brings, each explained once after `introduce`. */
  intros?: ReadonlyArray<MechanicIntroCopy>;
  /** The "?" carousel: its slides and their pictures. */
  slides: ReadonlyArray<TutorialSlide>;
  renderIllustration: (kind: string) => React.ReactNode;
  solved: boolean;
  hints: number;
  canUndo: boolean;
  /** The board's state: unchanged for long, Insight offers itself. */
  progress?: unknown;
  onExit: () => void;
  /** Called with Insight already paid for. */
  /** Shows the next move; returns `false` when there is none (then no
   * Insight is spent), or the hint's reason, which is shown above the keys. */
  onHint: () => boolean | void | { reason?: string; tip?: string };
  onUndo: () => void;
  onRestart: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  // Why the hint made its move, said once above the keys.
  const { note: hintNote, show: showHint } = useHintNote();
  const stageIn = useStageEntrance();
  const controlsIn = useStageEntrance(110);
  const insight = useInsightPower();
  const { coins, shortBy } = useCoinPurchase();
  const accent = accentColorForKind(kind);
  const tutorialId = tutorialIdForGame(kind);
  const [showHelp, setShowHelp] = useState(false);
  const { ready, hasSeenTutorial, markTutorialSeen } = useSettings();
  // In a set the app plays the lesson itself before the game opens.
  const [lesson, setLesson] = useState(() => mode.type === 'trial' && mode.index === 0 && ready && !hasSeenTutorial(tutorialId));
  const showSolved = useSolveCelebration(solved);
  // Waits for settings, so a board opened before they load still explains.
  const [introDone, setIntroDone] = useState(false);
  const showIntro = !!introduce && ready && !introDone && !hasSeenTutorial(introduce.id);

  // The solve, recorded once (in a set) and paid for.
  const { progress: player, recordCompletion } = usePlayerProgress();
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const recorded = useRef(false);
  const batchCompleted = useRef(false);
  const finishedSet = useRef<BatchState | null>(null);
  const [showSetComplete, setShowSetComplete] = useState(false);
  const batchRef = useRef(player.currentBatch);
  batchRef.current = player.currentBatch;
  const nextEntry = useMemo(() => (player.currentBatch ? nextInBatch(player.currentBatch) : null), [player.currentBatch]);
  useEffect(() => {
    if (!solved) {
      recorded.current = false;
      return;
    }
    if (recorded.current) return;
    recorded.current = true;
    if (mode.type === 'set') {
      finishedSet.current = batchRef.current ?? null;
      const outcome = recordCompletion(mode.puzzleId, hints);
      batchCompleted.current = outcome.batchCompleted;
      setStars(outcome.best.stars);
      setCoinsEarned(outcome.coinsEarned);
    } else {
      setStars(hints === 0 ? 3 : hints === 1 ? 2 : 1);
    }
  }, [solved, hints, mode, recordCompletion]);
  const goNext = () => {
    if (mode.type === 'trial') mode.onNext();
    else if (nextEntry) mode.onNextPuzzle(nextEntry.kind, nextEntry.puzzleId, { showInterstitial: batchCompleted.current });
  };


  if (lesson) {
    return (
      <View style={styles.container}>
        <GameLesson
          kind={kind}
          onDone={() => {
            markTutorialSeen(tutorialId);
            setLesson(false);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PageBloom />
      <PlayHeader
        kind={kind}
        difficulty={difficulty}
        status={kicker}
        solved={solved}
        puzzleId={mode.type === 'set' ? mode.puzzleId : ''}
        onExit={onExit}
        onHelp={() => setShowHelp(true)}
        dots={mode.type === 'set' ? undefined : <TrialDots total={mode.total} index={mode.index} accent={accent} />}
      />

      <View style={styles.boardArea}>
        <StageTopGap />
        <Animated.View style={[styles.stage, stageIn]}>{children}</Animated.View>
        <DockGap />
        {/* Finished: the keys take no more touches (see the screens). */}
        <Animated.View pointerEvents={solved ? "none" : "auto"} style={[styles.controls, dockPlate.plate, controlsIn]}>
          <InsightButton
            count={insight.count}
            onPress={() =>
              !solved &&
              insight.spend(() => {
                const given = onHint();
                if (given && typeof given === 'object') showHint(given);
                return given === false ? false : undefined;
              })
            }
            progress={progress}
          />
          {insight.sheet}
          <RoundKey accessibilityLabel="Undo" onPress={onUndo} disabled={!canUndo} dim={!canUndo}>
            <Icon name="undo" size={ICON_SIZE} color={accent} />
          </RoundKey>
          <RoundKey accessibilityLabel="Restart" confirm="Tap again to restart" onPress={onRestart}>
            <Icon name="restart" size={ICON_SIZE} color={accent} />
          </RoundKey>
        </Animated.View>
        {/* Coins only matter once Insight runs out: until then the line
            keeps its place but stays out of sight. */}
        <View style={insight.count > 0 && !shortBy ? styles.quiet : undefined} accessibilityElementsHidden={insight.count > 0 && !shortBy} importantForAccessibility={insight.count > 0 && !shortBy ? 'no-hide-descendants' : 'auto'}>
          <CoinBalance coins={coins} shortBy={shortBy} style={styles.coinBalance} />
        </View>
        <DockFloor />
      </View>

      {hintNote}

      {showSolved && stars && !showSetComplete && (
        <PuzzleSolved
          kind={kind}
          stars={stars}
          hintsUsed={hints}
          coinsEarned={coinsEarned}
          onDone={onExit}
          hasNext={mode.type === 'trial' ? mode.index < mode.total - 1 : nextEntry !== null && !isStandalonePuzzle(mode.puzzleId)}
          onNext={mode.type === 'set' && batchCompleted.current && finishedSet.current ? () => setShowSetComplete(true) : goNext}
        />
      )}
      {showSetComplete && finishedSet.current && (
        <LevelSetComplete levelNumber={finishedSet.current.levelNumber} kinds={finishedSet.current.puzzles.map(p => p.kind)} onContinue={goNext} />
      )}
      {showIntro && introduce && !lesson && (
        <TutorialOverlay
          copy={{ title: introduce.title, body: introduce.body }}
          accentColor={accent}
          onDismiss={() => {
            markTutorialSeen(introduce.id);
            setIntroDone(true);
          }}
        />
      )}
      {!showIntro && !lesson && intros.length > 0 && <MechanicIntro intros={intros} accent={accent} />}
      {showHelp && <MechanicsCarousel slides={slides} renderIllustration={renderIllustration} onDone={() => setShowHelp(false)} accentColor={accent} />}
    </View>
  );
}

/** A trial's own run of boards, in place of a set's dots. */
function TrialDots({ total, index, accent }: { total: number; index: number; accent: string }): React.JSX.Element {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_v, i) => (
        <View key={i} style={[styles.dot, { borderColor: accent }, i < index && [styles.dotDone, { backgroundColor: accent }], i === index && styles.dotNow]} />
      ))}
    </View>
  );
}

const styles = themedStyles(() => ({
  container: { flex: 1, alignItems: 'center', backgroundColor: theme.colors.background },
  quiet: { opacity: 0 },
  coinBalance: { marginTop: theme.spacing.sm },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: theme.spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, opacity: 0.6 },
  dotDone: { opacity: 1 },
  dotNow: { width: 9, height: 9, borderRadius: 5, opacity: 1 },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  stage: { borderRadius: 28, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md },
  controls: { flexDirection: 'row', gap: theme.spacing.md },
}));
