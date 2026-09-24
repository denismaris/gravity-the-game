import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import {
  BinairoCell,
  BinairoConstraint,
  BinairoPuzzle,
  constraintPartner,
  duplicateLines,
  emptyBinairoState,
  isBinairoSolved,
  isColHealthy,
  isConstraintViolated,
  isRowHealthy,
  nextValue,
  remainingCells,
  revealHint,
  setValue,
  tripleRunCells,
  unbalancedLines,
} from '../game/binairo';
import { BatchProgressDots, BinairoBoard, GeometricRule, LevelSetComplete, MechanicsCarousel, PressableScale, PuzzleSolved, renderBinairoIllustration } from '../components';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { triggerFeedback } from '../game/rendering';
import { BINAIRO_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { motion, theme } from '../theme';

const TUTORIAL_ID = tutorialIdForGame('binairo');

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
/** How long the progress track's fill animates to its new width on a
 * toggle - the same "state indication" budget as a dropdown, not a
 * celebratory spring: this fires on ordinary cell taps, tens of times a
 * puzzle, so it has to stay quiet. */
const TRACK_MS = 220;
/** How long the completion popup waits after solve detection before
 * appearing - tuned to `BinairoBoardView`'s own `WAVE_TOTAL_MS` (650ms),
 * the board's ripple-celebration duration, so the popup doesn't cut the
 * wave off mid-flight. Completion is still recorded and the solve sound
 * still fires immediately on detection - only the popup itself waits. */
const POPUP_DELAY_MS = 650;

/** A small lightbulb - bulb outline plus a stepped-down base, all simple
 * strokes rather than arcs needing sweep-flag verification, since it's
 * decorative and never animates. Tinted this game's own identity colour
 * (`binairoAccent`, echoing the board's own frame and the header's
 * kicker/progress-track) rather than plain ink - the two primary actions
 * on this screen carry the same accent the board itself now does, instead
 * of the accent being confined to one thin line up in the header. */
function HintIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={5.8} r={4.3} color={theme.colors.binairoAccent} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.4 9.4 L 8.6 9.4" color={theme.colors.binairoAccent} style="stroke" strokeWidth={1.3} />
      <Path path="M 5.7 11.2 L 8.3 11.2" color={theme.colors.binairoAccent} style="stroke" strokeWidth={1.3} />
      <Path path="M 6.3 12.6 L 7.7 12.6" color={theme.colors.binairoAccent} style="stroke" strokeWidth={1.1} />
    </Canvas>
  );
}

/** A circular restart arrow: a 270-degree open ring plus a small
 * arrowhead tangent to its open end, continuing the arc's own rotation -
 * verified against a full SVG-arc reconstruction before trusting the
 * sweep flag. Same identity-colour tint as `HintIcon` - see its own
 * comment for why. */
function RestartIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Path path="M 4.17 3.63 A 4.4 4.4 0 1 0 10.37 4.17" color={theme.colors.binairoAccent} style="stroke" strokeWidth={1.6} />
      <Path path="M 9.66 3.33 L 12.79 4.1 L 9.88 6.54 Z" color={theme.colors.binairoAccent} />
    </Canvas>
  );
}

/** A plain "?" glyph, ring plus stem plus dot - the same simple-stroke
 * treatment `HintIcon`/`RestartIcon` use, so this reads as one family of
 * header icons rather than a generic help symbol dropped in from
 * elsewhere. Sits in the header's own right-hand slot (see
 * `styles.headerRightSpacer`) and reopens the exact same
 * `MechanicsCarousel` the first-run auto-open shows - see
 * `reopenTutorial` below. */
function HelpIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={7} r={6.3} color={theme.colors.textPrimary} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.1 5.6 A 1.9 1.9 0 1 1 7.9 7.3 C 7.15 7.75 7 8.1 7 8.9" color={theme.colors.textPrimary} style="stroke" strokeWidth={1.3} strokeCap="round" />
      <Circle cx={7} cy={10.9} r={0.75} color={theme.colors.textPrimary} />
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
  const { width, height } = useWindowDimensions();
  const { progress, recordCompletion } = usePlayerProgress();
  const { ready: settingsReady, hasSeenTutorial, markTutorialSeen } = useSettings();

  // Bumped on every restart so the board's own intro wave (see
  // `BinairoBoardView`'s `introKey` prop) replays - the puzzle "resetting"
  // reads as the same tray waking back up that a fresh puzzle load does,
  // rather than the grid just silently snapping back to blank.
  const [introKey, setIntroKey] = useState(0);

  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
    if (settingsReady && !hasSeenTutorial(TUTORIAL_ID)) setShowTutorial(true);
  }, [settingsReady, hasSeenTutorial]);
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
  const left = remainingCells(state);
  const totalCells = puzzle.size * puzzle.size;

  // The header's own progress track - see `styles.track`. Animates toward
  // its new fraction on every toggle rather than jumping, so filling the
  // last few cells of a row reads as continuous progress instead of a
  // stepped counter.
  const trackFill = useRef(new Animated.Value(totalCells ? (totalCells - left) / totalCells : 0)).current;
  useEffect(() => {
    Animated.timing(trackFill, {
      toValue: totalCells ? (totalCells - left) / totalCells : 0,
      duration: TRACK_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width isn't a transform - can't use the native driver
    }).start();
  }, [left, totalCells, trackFill]);

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
      }, POPUP_DELAY_MS);
    }
  }, [solved, hints, puzzle.id, recordCompletion]);

  const toggle = useCallback(
    (row: number, col: number) => {
      setState(s => {
        if (isBinairoSolved(puzzle, s)) return s;
        const next = setValue(s, puzzle, row, col, nextValue(s.values[row][col]));
        if (next === s) return next;

        // The solved sound fires exactly once from the effect above,
        // regardless of which toggle triggers it. Short of that: any of
        // the three error geometries touching the cell just toggled beats
        // a newly-healthy line (a wrong entry that happens to fill a line
        // isn't a milestone); a genuinely new line beats the plain toggle.
        if (!isBinairoSolved(puzzle, next)) {
          const touchesCell = (constraint: BinairoConstraint): boolean => {
            if (constraint.row === row && constraint.col === col) return true;
            const partner = constraintPartner(constraint);
            return partner.row === row && partner.col === col;
          };
          const isError =
            tripleRunCells(next).has(`${row}:${col}`) ||
            unbalancedLines(puzzle, next).rows.has(row) ||
            unbalancedLines(puzzle, next).cols.has(col) ||
            duplicateLines(puzzle, next).rows.has(row) ||
            duplicateLines(puzzle, next).cols.has(col) ||
            (puzzle.constraints ?? []).some(constraint => touchesCell(constraint) && isConstraintViolated(next, constraint));

          if (isError) {
            triggerFeedback('binairoError');
          } else {
            const rowJustHealthy = isRowHealthy(puzzle, next, row) && !isRowHealthy(puzzle, s, row);
            const colJustHealthy = isColHealthy(puzzle, next, col) && !isColHealthy(puzzle, s, col);
            triggerFeedback(rowJustHealthy || colJustHealthy ? 'binairoRowBalance' : 'binairoToggle');
          }
        }
        return next;
      });
    },
    [puzzle],
  );

  const useHint = useCallback(() => {
    setState(s => {
      const h = revealHint(s, puzzle);
      if (!h) return s;
      setHints(n => n + 1);
      setFlash(h.cell);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setFlash(null), 450);
      triggerFeedback('targetReached');
      return h.state;
    });
  }, [puzzle]);

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
    Math.min(width - theme.spacing.lg * 2 - STAGE_H_PADDING * 2, height - insets.top - insets.bottom - RESERVED),
  );

  const constraintKinds = useMemo(() => new Set((puzzle.constraints ?? []).map(c => c.kind)), [puzzle]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8}>
          <Text style={styles.back}>‹ Home</Text>
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.name} numberOfLines={1}>
            {puzzle.name ?? 'Binairo'}
          </Text>
          <AnimatedKicker left={left} solved={solved} />
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.trackFill,
                {
                  width: trackFill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' }),
                },
              ]}
            />
          </View>
          {progress.currentBatch && <BatchProgressDots batch={progress.currentBatch} style={styles.batchDots} />}
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="How to play"
          onPress={reopenTutorial}
          hitSlop={8}
          containerStyle={styles.headerRightSpacer}
        >
          <HelpIcon />
        </PressableScale>
      </View>

      <View style={styles.boardArea}>
        <View style={styles.stage}>
          <GeometricRule variant="stage" style={styles.stageRule} />
          <BinairoBoard puzzle={puzzle} state={state} size={boardSize} solved={solved} onToggleCell={toggle} flashCell={flash} introKey={introKey} />
        </View>

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
      </View>

      <View style={styles.controls}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Reveal a hint"
          onPress={useHint}
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        >
          <HintIcon />
          <Text style={styles.pillText}>Hint</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Restart puzzle"
          onPress={restart}
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        >
          <RestartIcon />
          <Text style={styles.pillText}>Restart</Text>
        </PressableScale>
      </View>

      {solved && stars && (
        <PuzzleSolved
          kind="binairo"
          stars={stars}
          hintsUsed={hints}
          onReplay={restart}
          onDone={onExit}
          hasNext={nextEntry !== null}
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

      {showTutorial && (
        <MechanicsCarousel
          slides={BINAIRO_MECHANICS_SLIDES}
          renderIllustration={renderBinairoIllustration}
          onDone={dismissTutorial}
          accentColor={accentColorForKind('binairo')}
        />
      )}
    </View>
  );
}

/** The "N LEFT" kicker, popping (`spring.pop`) on each decrement only -
 * reusing the existing header rather than inventing a board-level effect
 * for what is, after all, just a number changing. On solve, it swaps to
 * "SOLVED" with a small filled dot popping in beside it, matching the
 * board's own filled-circle symbol. */
function AnimatedKicker({ left, solved }: { left: number; solved: boolean }): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;
  const previous = useRef(left);
  const solvedScale = useRef(new Animated.Value(0)).current;
  const previousSolved = useRef(solved);

  useEffect(() => {
    if (left < previous.current) {
      scale.setValue(0.85);
      // `kick`, not `pop` - this fires on every correct placement, up to
      // ~100 times on a 10x10 board, far too often for `pop`'s reward-tier
      // bounce (see `theme/motion.ts`).
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...motion.spring.kick }).start();
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

  return (
    <View style={styles.kickerRow}>
      <Animated.Text style={[styles.kicker, { transform: [{ scale }] }]}>
        {solved ? 'BINAIRO · SOLVED' : `BINAIRO · ${left} LEFT`}
      </Animated.Text>
      {solved && <Animated.View style={[styles.solvedBadge, { transform: [{ scale: solvedScale }] }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: theme.typography.sizes.title,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  kicker: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1,
    color: theme.colors.binairoAccent,
  },
  solvedBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
    marginLeft: 5,
  },
  // The header's own progress track - same shape as Home's hero-card track
  // (`HomeScreen.tsx`'s `styles.track`/`trackFill`), tinted with this game's
  // own identity colour instead of the app-wide `secondary` so it reads as
  // "this screen's" progress, not a borrowed piece of chrome.
  track: {
    width: 140,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.surfaceAlt,
    marginTop: theme.spacing.sm,
    overflow: 'hidden',
  },
  trackFill: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.binairoAccent,
  },
  batchDots: {
    marginTop: theme.spacing.sm,
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
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: theme.spacing.lg,
  },
  // The board's own plinth: a snug groove the tray sits inside, not a
  // second tinted card behind it - the tray (drawn by `BinairoBoardView`'s
  // own `renderTray`) already carries its own fill, border and shadow, so
  // a filled plinth here used to stack a second box around the first,
  // reading as nested frames rather than one confident surface. No fill
  // now, just the page's own background showing through; the lighter top
  // edge/deeper bottom edge (light grazing the near lip of a shallow
  // recess from above) is the one remaining cue that this is a considered
  // well the board rests in, not arbitrary padding - and that groove has
  // to actually hug the board to read as one surface, so its own vertical
  // padding stays modest (not the generous `xxl` this used when it was
  // filling otherwise-empty centred space). Horizontal padding stays
  // tight regardless - every point there is a point the board itself
  // loses, see `STAGE_H_PADDING`.
  /** The signature rule standing in for the stage's old plain top
   * hairline - same job, carrying the app's own mark. */
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
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 0.6,
    color: theme.colors.textTertiary,
  },
  controls: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    // A slightly lighter top edge than the other three sides - the same
    // small "catching the light" cue the board's own tiles use - rather
    // than one flat border colour on all sides.
    borderTopColor: '#FBF6EB',
    borderLeftColor: theme.colors.border,
    borderRightColor: theme.colors.border,
    borderBottomColor: theme.colors.border,
    // Offset down-right, matching the one light source every other
    // element in this screen now shades toward.
    shadowColor: '#3B1F52',
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
});
