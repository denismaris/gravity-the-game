import { SOLVE_CELEBRATION_MS } from '../components/useSolveCelebration';
import { RoundKey } from '../components/RoundKey';
import { isStandalonePuzzle } from '../game/journey/daily';
import { DockFloor, DockGap, dockPlate, StageTopGap } from '../components/StageTopGap';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, useWindowDimensions } from 'react-native';
import { Text } from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Path } from '@shopify/react-native-skia';
import {
  BinairoCell,
  BinairoPuzzle,
  cellBreaksARule,
  emptyBinairoState,
  explainBinairoHint,
  isBinairoSolved,
  isColHealthy,
  isRowHealthy,
  nextValue,
  remainingCells,
  setValue,
} from '../game/binairo';
import { BinairoBoard, LevelSetComplete, MechanicsCarousel, PuzzleSolved, renderBinairoIllustration, useSolveCelebration } from '../components';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { BINAIRO_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { theme, themedStyles } from '../theme';
import { PageBloom } from '../components/PageBloom';
import { CoinBalance, useCoinPurchase } from '../components/Coins';
import { InsightButton, useInsightPower } from '../components/InsightPower';
import { useStageEntrance } from '../components/useStageEntrance';
import { PlayHeader } from '../components/PlayHeader';

const TUTORIAL_ID = tutorialIdForGame('binairo');
/** Matches the board's own delay before it shows a mistake. */
const ERROR_SOUND_DELAY_MS = 450;

export interface BinairoScreenProps {
  puzzle: BinairoPuzzle;
  /** Return to the hub. */
  onExit: () => void;
  /** Advance to the next entry in the Journey (any of the games). */
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

const RESERVED = 300;
const ICON_SIZE = 14;
/** The stage card's own horizontal inset around the board - deliberately
 * tight (unlike its generous vertical padding, see `styles.stage`) so the
 * grid loses as little of the screen's width as possible; width is what
 * actually caps the board's size on a phone, so every point here is a
 * point of board. */
const STAGE_H_PADDING = theme.spacing.sm;
/** How long the completion popup waits after solve detection before
 * appearing - tuned to `BinairoBoardView`'s own `WAVE_TOTAL_MS` (650ms),
 * the board's ripple-celebration duration, so the popup doesn't cut the
 * wave off mid-flight. Completion is still recorded and the solve sound
 * still fires immediately on detection - only the popup itself waits. */
const POPUP_DELAY_MS = SOLVE_CELEBRATION_MS;

/** A circular restart arrow: a 270-degree open ring plus a small
 * arrowhead tangent to its open end, continuing the arc's own rotation -
 * verified against a full SVG-arc reconstruction before trusting the
 * sweep flag. Same identity-colour tint as the other glyphs here - see its own
 * comment for why. */
function RestartIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 4.17 3.63 A 4.4 4.4 0 1 0 10.37 4.17" color={theme.colors.binairoAccent} style="stroke" strokeWidth={1.6} />
      <Path path="M 9.66 3.33 L 12.79 4.1 L 9.88 6.54 Z" color={theme.colors.binairoAccent} />
    </Canvas>
  );
}

/**
 * Play screen for a Binairo puzzle. Tap a cell to cycle blank -> square ->
 * circle -> blank; matching every row and column's balance, with no run
 * of three and no repeated line, solves it.
 */
export function BinairoScreen({ puzzle, onExit, onNextPuzzle }: BinairoScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const stageIn = useStageEntrance();
  const controlsIn = useStageEntrance(110);
  const { width, height } = useWindowDimensions();
  const { progress, recordCompletion } = usePlayerProgress();
  const { markTutorialSeen } = useSettings();

  // Bumped on every restart so the board's own intro wave (see
  // `BinairoBoardView`'s `introKey` prop) replays - the puzzle "resetting"
  // reads as the same tray waking back up that a fresh puzzle load does,
  // rather than the grid just silently snapping back to blank.
  const [introKey, setIntroKey] = useState(0);

  const [showTutorial, setShowTutorial] = useState(false);
  const dismissTutorial = useCallback(() => {
    markTutorialSeen(TUTORIAL_ID);
    setShowTutorial(false);
  }, [markTutorialSeen]);
  // The header's "?" icon reopens the exact same carousel the first-run
  // auto-open shows (see `MechanicsCarousel`'s own doc comment) - it's
  // the same `showTutorial`/`dismissTutorial` pair either way, so a
  // manual reopen always starts at slide 1 for free (the component
  // unmounts on dismiss and remounts fresh on the next open).
  const reopenTutorial = useCallback(() => setShowTutorial(true), []);

  const nextEntry = useMemo(() => (progress.currentBatch ? nextInBatch(progress.currentBatch) : null), [progress.currentBatch]);
  const [state, setState] = useState(() => emptyBinairoState(puzzle));
  const { coins, shortBy } = useCoinPurchase();
  // Insight, the superpower: charges first, then a video or coins.
  const insight = useInsightPower();
  const spendInsight = insight.spend;
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [hints, setHints] = useState(0);
  const [flash, setFlash] = useState<BinairoCell | null>(null);
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const recorded = useRef(false);
  const batchCompletedRef = useRef(false);
  // The batch this solve might complete. Captured *before* `recordCompletion`
  // runs, because completing a set immediately generates the next one and
  // `progress.currentBatch` is the new set by the time the card renders -
  // the finished one is otherwise gone.
  const finishedSetRef = useRef<BatchState | null>(null);
  // Finishing the last puzzle of a set shows the per-puzzle card first,
  // then this - two separate moments rather than one card trying to be
  // both. See `LevelSetComplete`'s own comment.
  const [showSetComplete, setShowSetComplete] = useState(false);
  // Mirrored into a ref rather than read straight off `progress` inside
  // the solve effect: completing a set replaces `currentBatch`, so making
  // the effect depend on it would mean depending on something the effect
  // itself causes to change. Refreshed every render, so when the effect
  // runs it still holds the batch from the render that triggered it.
  const currentBatchRef = useRef(progress.currentBatch);
  currentBatchRef.current = progress.currentBatch;
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    };
  }, []);

  const solved = useMemo(() => isBinairoSolved(puzzle, state), [puzzle, state]);

  // The completion card waits for the board's own finish animation to
  // play - without this it drops a scrim straight over the top of it.
  const showSolvedCard = useSolveCelebration(solved);
  const left = remainingCells(state);


  useEffect(() => {
    if (solved && !recorded.current) {
      recorded.current = true;
      finishedSetRef.current = currentBatchRef.current ?? null;
      const outcome = recordCompletion(puzzle.id, hints);
      batchCompletedRef.current = outcome.batchCompleted;
      triggerFeedback('binairoSolve');
      // The popup waits for the board's own ripple celebration to finish
      // rather than cutting it off - see `POPUP_DELAY_MS`. Progress is
      // already recorded above regardless of this timer's fate.
      popupTimeoutRef.current = setTimeout(() => {
        setStars(outcome.best.stars);
        setCoinsEarned(outcome.coinsEarned);
      }, POPUP_DELAY_MS);
    }
  }, [solved, hints, puzzle.id, recordCompletion]);

  // The error sound waits as long as the board's red outline does (the
  // board's own `ERROR_DELAY_MS`), and plays only if the mistake is still
  // there: tapping a cell through blank, circle, square can pass through a
  // state that breaks a rule for a moment, and buzzing at that read as the
  // game scolding a mistake the player never made.
  const stateRef = useRef(state);
  stateRef.current = state;
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
  }, []);

  const toggle = useCallback(
    (row: number, col: number) => {
      const s = stateRef.current;
      if (isBinairoSolved(puzzle, s)) return;
      const next = setValue(s, puzzle, row, col, nextValue(s.values[row][col]));
      if (next === s) return;
      stateRef.current = next;
      setState(next);
      if (errorTimer.current) {
        clearTimeout(errorTimer.current);
        errorTimer.current = null;
      }
      // The solved sound fires exactly once from the effect above. Short
      // of that: a newly finished, healthy line gets its own note, any
      // other tap the plain one - and a rule broken by this tap, if it is
      // still broken a moment later, the error.
      if (isBinairoSolved(puzzle, next)) return;
      const rowJustHealthy = isRowHealthy(puzzle, next, row) && !isRowHealthy(puzzle, s, row);
      const colJustHealthy = isColHealthy(puzzle, next, col) && !isColHealthy(puzzle, s, col);
      const breaks = cellBreaksARule(puzzle, next, row, col);
      triggerFeedback(!breaks && (rowJustHealthy || colJustHealthy) ? 'binairoRowBalance' : 'binairoToggle');
      if (breaks) {
        errorTimer.current = setTimeout(() => {
          errorTimer.current = null;
          if (cellBreaksARule(puzzle, stateRef.current, row, col)) triggerFeedback('binairoError');
        }, ERROR_SOUND_DELAY_MS);
      }
    },
    [puzzle],
  );

  // Charged only when there is a hint to give, and before applying it, so
  // a refused purchase leaves the board untouched. Worked out from the live
  // \`state\` rather than inside a \`setState\` updater: React may run an
  // updater twice, which would charge twice.
  // The last hint's reason, shown over the board for a few seconds.
  const useHint = useCallback(() => {
    const h = explainBinairoHint(puzzle, state);
    if (!h) return;
    spendInsight(() => {
      setState(h.state);
      setHints(n => n + 1);
      setFlash(h.cell);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlash(null), 1500);
      triggerFeedback('targetReached');
    });
  }, [puzzle, state, spendInsight]);

  const restart = useCallback(() => {
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = null;
    }
    recorded.current = false;
    batchCompletedRef.current = false;
    setStars(null);
    setHints(0);
    setState(emptyBinairoState(puzzle));
    setIntroKey(k => k + 1);
  }, [puzzle]);

  const goNext = useCallback(() => {
    if (nextEntry) onNextPuzzle(nextEntry.kind, nextEntry.puzzleId, { showInterstitial: batchCompletedRef.current });
  }, [nextEntry, onNextPuzzle]);

  const boardSize = Math.max(
    0,
    Math.min(width - theme.spacing.md * 2 - STAGE_H_PADDING * 2, height - insets.top - insets.bottom - RESERVED),
  );

  const constraintKinds = useMemo(() => new Set((puzzle.constraints ?? []).map(c => c.kind)), [puzzle]);


  return (
    <View style={styles.container}>
      <PageBloom />
      <PlayHeader
        kind="binairo"
        difficulty={puzzle.difficulty}
        status={solved ? 'Solved' : `${left} left`}
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
            <BinairoBoard puzzle={puzzle} state={state} size={boardSize} solved={solved} onToggleCell={toggle} flashCell={flash} introKey={introKey} />
          </View>
        </Animated.View>

        {constraintKinds.size > 0 && (
          <View style={styles.legend}>
            {constraintKinds.has('same') && (
              <View style={styles.legendItem}>
                <Text style={styles.legendMark}>=</Text>
                <Text style={styles.legendLabel}>same</Text>
              </View>
            )}
            {constraintKinds.has('different') && (
              <View style={styles.legendItem}>
                <Text style={styles.legendMark}>×</Text>
                <Text style={styles.legendLabel}>different</Text>
              </View>
            )}
          </View>
        )}

        <DockGap />
        <Animated.View style={[styles.controls, dockPlate.plate, controlsIn]}>
          <InsightButton count={insight.count} onPress={useHint} />
          {insight.sheet}
          <RoundKey
            accessibilityLabel="Restart puzzle"
            onPress={restart}>
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


      {showSolvedCard && stars && !showSetComplete && (
        <PuzzleSolved
          kind="binairo"
          stars={stars}
          hintsUsed={hints}
          coinsEarned={coinsEarned}
          onDone={onExit}
          hasNext={nextEntry !== null && !isStandalonePuzzle(puzzle.id)}
          onNext={batchCompletedRef.current && finishedSetRef.current ? () => setShowSetComplete(true) : goNext}
        />
      )}

      {showSetComplete && finishedSetRef.current && (
        <LevelSetComplete
          levelNumber={finishedSetRef.current.levelNumber}
          kinds={finishedSetRef.current.puzzles.map(p => p.kind)}
          onContinue={goNext}
        />
      )}

      {showTutorial && <MechanicsCarousel slides={BINAIRO_MECHANICS_SLIDES} renderIllustration={renderBinairoIllustration} onDone={dismissTutorial} accentColor={accentColorForKind('binairo')} />}
    </View>
  );
}

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  // Anchored to the header, not centred in whatever space happens to be
  // left over - `flex: 1` still lets this area claim all the room between
  // the header and the footer controls (so a tap anywhere below the board
  // still lands here), but `justifyContent: 'flex-start'` plus a fixed
  // `marginTop` means the board sits at the same, deliberate distance from
  // the title on every puzzle size. Centring in the leftover space used to
  // put a small board (a 6x6, say) adrift in the middle of a mostly-empty
  // screen, with no clear relationship to the header above it - any spare
  // room now collects in one place, below the controls' natural position,
  // which reads as "the page ended" rather than "why is this floating".
  // Centred between the header and the controls, not pinned under the
  // header. Every board here is square and limited by the screen's width,
  // so on a tall phone there is always vertical slack - top-aligning it
  // pooled all of that into one dead block beneath the board, which read
  // as a layout that had run out rather than a composed page. Split either
  // side, the same slack reads as margin.
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
  legend: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.xs,
  },
  legendMark: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textTertiary,
  },
  legendLabel: {
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textTertiary,
    fontWeight: theme.typography.weights.semibold,
  },
  // Sits with the board inside the centred group rather than pinned to the
  // bottom of the screen - the arrangement Gravity's own board already
  // used, and the reason its screen read as composed while the other five
  // read as a board at the top and two buttons stranded at the bottom.
  controls: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  coinBalance: { marginTop: theme.spacing.md },
  quiet: { opacity: 0 },
}));
