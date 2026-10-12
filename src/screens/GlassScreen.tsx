import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Group, Path, rect, RoundedRect, rrect } from '@shopify/react-native-skia';
import { DifficultyChip, LevelSetComplete, MechanicsCarousel, PressableScale, PuzzleSolved, renderGlassIllustration, useSolveCelebration } from '../components';
import { CoinBalance, useCoinPurchase } from '../components/Coins';
import { GLASS_ARCH, GlassBoard, glassColor, glassTexture, StrokePhase } from '../components/GlassBoard';
import { HelpHalo } from '../components/HelpHalo';
import { HintNote } from '../components/HintNote';
import { BackLabel, Icon } from '../components/Icon';
import { InsightButton, useInsightPower } from '../components/InsightPower';
import { PageBloom } from '../components/PageBloom';
import { StageTopGap } from '../components/StageTopGap';
import { PuzzleProgressMark } from '../components/PuzzleProgressMark';
import { useStageEntrance } from '../components/useStageEntrance';
import { clashes, GLASS_COLORS, GLASS_COLOR_NAMES, GlassColor, glassHint, GlassPuzzle, GlassState, initialGlassState, isGlassSolved, paint, panesLeft } from '../game/glass';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { isStandalonePuzzle } from '../game/journey/daily';
import { shade, triggerFeedback } from '../game/rendering';
import { GLASS_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { motion, theme, themedStyles } from '../theme';

const ICON_SIZE = 14;
const RESERVED = 330;
const STAGE_H_PADDING = theme.spacing.sm;
const TRACK_WIDTH = 160;
const TUTORIAL_ID = tutorialIdForGame('glass');

/** The same simple-stroke "?" every other game's header carries. */
function HelpIcon(): React.JSX.Element {
  return (
    <Canvas style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Circle cx={7} cy={7} r={6.3} color={theme.colors.textPrimary} style="stroke" strokeWidth={1.4} />
      <Path path="M 5.1 5.6 A 1.9 1.9 0 1 1 7.9 7.3 C 7.15 7.75 7 8.1 7 8.9" color={theme.colors.textPrimary} style="stroke" strokeWidth={1.3} strokeCap="round" />
      <Circle cx={7} cy={10.9} r={0.75} color={theme.colors.textPrimary} />
    </Canvas>
  );
}

export interface GlassScreenProps {
  puzzle: GlassPuzzle;
  onExit: () => void;
  onNextPuzzle: (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => void;
}

/**
 * Stained Glass: glaze every pane of a leaded window so no two panes that
 * share lead are the same colour. Laid out as the other games are - header
 * with its kicker, progress track and set dots; the window on its stage;
 * the glass to choose from in a tray beneath it, like Mosaic's pieces;
 * then Insight and the round keys.
 */
export function GlassScreen({ puzzle, onExit, onNextPuzzle }: GlassScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const stageIn = useStageEntrance();
  const controlsIn = useStageEntrance(110);
  const { width, height } = useWindowDimensions();
  const { progress, recordCompletion } = usePlayerProgress();
  const { markTutorialSeen } = useSettings();

  const [state, setState] = useState<GlassState>(() => initialGlassState(puzzle));
  const [history, setHistory] = useState<GlassState[]>([]);
  const [brush, setBrush] = useState<GlassColor | null>(0);
  const [hints, setHints] = useState(0);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [note, setNote] = useState<{ reason: string; tip?: string; kind: 'fix' | 'rule'; id: number } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const dismissHelp = useCallback(() => {
    markTutorialSeen(TUTORIAL_ID);
    setShowHelp(false);
  }, [markTutorialSeen]);
  const insight = useInsightPower();
  const { coins, shortBy } = useCoinPurchase();

  const nextEntry = useMemo(() => (progress.currentBatch ? nextInBatch(progress.currentBatch) : null), [progress.currentBatch]);
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const recorded = useRef(false);
  const batchCompletedRef = useRef(false);
  const finishedSetRef = useRef<BatchState | null>(null);
  const [showSetComplete, setShowSetComplete] = useState(false);
  const currentBatchRef = useRef(progress.currentBatch);
  currentBatchRef.current = progress.currentBatch;

  const solved = useMemo(() => isGlassSolved(puzzle, state), [puzzle, state]);
  const left = panesLeft(state);
  const clashCount = useMemo(() => clashes(puzzle, state).length, [puzzle, state]);
  const showSolved = useSolveCelebration(solved);
  useEffect(() => {
    if (solved && !recorded.current) {
      recorded.current = true;
      finishedSetRef.current = currentBatchRef.current ?? null;
      const outcome = recordCompletion(puzzle.id, hints);
      batchCompletedRef.current = outcome.batchCompleted;
      setStars(outcome.best.stars);
      setCoinsEarned(outcome.coinsEarned);
      triggerFeedback('glassSolve');
    }
  }, [solved, hints, puzzle.id, recordCompletion]);

  // The header's progress track: panes coloured, of those to colour.
  const toColour = puzzle.given.filter(g => g === null).length;
  const track = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(track, { toValue: toColour ? (toColour - left) / toColour : 0, duration: 380, useNativeDriver: true }).start();
  }, [left, toColour, track]);

  // A stroke: the first pane decides whether it lays glass or takes it
  // out (starting on a pane already in the chosen glass takes it out), and
  // every pane the finger then crosses gets the same. One undo per stroke.
  const strokeMode = useRef<'paint' | 'erase'>('paint');
  const stateRef = useRef(state);
  stateRef.current = state;
  const onStroke = useCallback(
    (pane: number, phase: StrokePhase) => {
      if (solved) return;
      const current = stateRef.current;
      if (puzzle.given[pane] !== null) {
        if (phase === 'start') triggerFeedback('glassLift');
        return;
      }
      if (phase === 'start') {
        strokeMode.current = brush === null || current.colors[pane] === brush ? 'erase' : 'paint';
        setHistory(h => [...h, current]);
      }
      const color = strokeMode.current === 'erase' ? null : brush;
      const next = paint(puzzle, current, pane, color);
      if (next === current) return;
      stateRef.current = next;
      setState(next);
      const more = clashes(puzzle, next).length > clashes(puzzle, current).length;
      triggerFeedback(color === null ? 'glassLift' : more ? 'glassClash' : (['glassRuby', 'glassCobalt', 'glassAmber'] as const)[color]);
    },
    [puzzle, brush, solved],
  );

  const undo = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h;
      setState(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }, []);
  const restart = useCallback(() => {
    recorded.current = false;
    batchCompletedRef.current = false;
    setStars(null);
    setHints(0);
    setHistory([]);
    setHighlight(null);
    setState(initialGlassState(puzzle));
  }, [puzzle]);

  const useHint = useCallback(() => {
    const hint = glassHint(puzzle, state);
    if (!hint) return;
    insight.spend(() => {
      setHistory(h => [...h, state]);
      setState(hint.state);
      setHints(n => n + 1);
      setHighlight(hint.pane);
      setNote({ reason: hint.reason, tip: hint.tip, kind: hint.kind, id: Date.now() });
      triggerFeedback('targetReached');
    });
  }, [puzzle, state, insight]);

  const goNext = useCallback(() => {
    if (nextEntry) onNextPuzzle(nextEntry.kind, nextEntry.puzzleId, { showInterstitial: batchCompletedRef.current });
  }, [nextEntry, onNextPuzzle]);

  // The window stands taller than it is wide: the arch sits on top.
  const boardSize = Math.max(0, Math.min(width - theme.spacing.lg * 2 - STAGE_H_PADDING * 2, (height - insets.top - insets.bottom - RESERVED) / (1 + GLASS_ARCH)));

  return (
    <View style={styles.container}>
      <PageBloom />
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Back to home" onPress={onExit} hitSlop={8}>
          <BackLabel label="Home" style={styles.back} />
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {puzzle.name}
          </Text>
          <View style={styles.kickerRow}>
            <DifficultyChip difficulty={puzzle.difficulty} style={styles.kickerChip} />
            <Text style={styles.kicker} numberOfLines={1}>
              {solved ? 'Stained Glass · finished' : clashCount > 0 ? `Stained Glass · ${clashCount} ${clashCount === 1 ? 'clash' : 'clashes'}` : `Stained Glass · ${left} left`}
            </Text>
          </View>
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.trackFill,
                {
                  transform: [
                    { translateX: track.interpolate({ inputRange: [0, 1], outputRange: [-TRACK_WIDTH / 2, 0], extrapolate: 'clamp' }) },
                    { scaleX: track.interpolate({ inputRange: [0, 1], outputRange: [0.0001, 1], extrapolate: 'clamp' }) },
                  ],
                },
              ]}
            />
          </View>
          <PuzzleProgressMark batch={progress.currentBatch} puzzleId={puzzle.id} style={styles.batchDots} />
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel="How to play" onPress={() => setShowHelp(true)} hitSlop={8} containerStyle={styles.headerRightSpacer}>
          <HelpHalo />
          <HelpIcon />
        </PressableScale>
      </View>

      <View style={styles.boardArea}>
        <StageTopGap />
        <Animated.View style={[styles.stage, stageIn]}>
          <GlassBoard puzzle={puzzle} state={state} size={boardSize} solved={solved} onStroke={onStroke} highlight={highlight} />
        </Animated.View>

        {/* The glass to set, in a tray like Mosaic's pieces. */}
        <Animated.View style={[styles.palette, controlsIn]}>
          {[...GLASS_COLORS, null].map(color => (
            <Swatch key={String(color)} color={color} selected={brush === color} onPress={() => setBrush(color)} />
          ))}
        </Animated.View>

        <Animated.View style={[styles.controls, controlsIn]}>
          <InsightButton count={insight.count} onPress={useHint} />
          {insight.sheet}
          <PressableScale accessibilityRole="button" accessibilityLabel="Undo" onPress={undo} disabled={history.length === 0} style={({ pressed }) => [styles.pill, styles.roundKey, history.length === 0 && styles.disabled, pressed && styles.pillPressed]}>
            <Icon name="undo" size={ICON_SIZE} color={theme.colors.glassAccent} />
          </PressableScale>
          <PressableScale accessibilityRole="button" accessibilityLabel="Restart window" onPress={restart} style={({ pressed }) => [styles.pill, styles.roundKey, pressed && styles.pillPressed]}>
            <Icon name="restart" size={ICON_SIZE} color={theme.colors.glassAccent} />
          </PressableScale>
        </Animated.View>
        {/* Coins only matter here once Insight runs out: until then the
          line keeps its place but stays out of sight. */}
        <View style={insight.count > 0 && !shortBy ? styles.quiet : undefined} accessibilityElementsHidden={insight.count > 0 && !shortBy} importantForAccessibility={insight.count > 0 && !shortBy ? 'no-hide-descendants' : 'auto'}>
          <CoinBalance coins={coins} shortBy={shortBy} style={styles.coinBalance} />
        </View>
        {note && !solved && <HintNote key={note.id} reason={note.reason} tip={note.tip} kind={note.kind} accent={accentColorForKind('glass')} onGone={() => setNote(null)} />}
      </View>

      {showSolved && stars && !showSetComplete && (
        <PuzzleSolved
          kind="glass"
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

      {showHelp && <MechanicsCarousel slides={GLASS_MECHANICS_SLIDES} renderIllustration={renderGlassIllustration} onDone={dismissHelp} accentColor={accentColorForKind('glass')} />}
    </View>
  );
}

/** One glass in the tray: a glazed tile on its side face, like the panes;
 * the clear one an empty slot. The chosen one lifts, ringed in the accent. */
function Swatch({ color, selected, onPress }: { color: GlassColor | null; selected: boolean; onPress: () => void }): React.JSX.Element {
  const lift = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(lift, { toValue: selected ? 1 : 0, useNativeDriver: true, ...motion.spring.pop }).start();
  }, [selected, lift]);
  const size = 40;
  const depth = 3;
  const face = glassColor(color);
  const texture = glassTexture(color, size / 2, size / 2, size, size / 2.4);
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={color === null ? 'Clear, to take a pane out' : `${GLASS_COLOR_NAMES[color]} glass`} accessibilityState={{ selected }} onPress={onPress} hitSlop={6}>
      <Animated.View style={[styles.swatch, selected && styles.swatchOn, { transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]}>
        <Canvas style={{ width: size, height: size + depth }}>
          {color === null ? (
            <>
              <RoundedRect x={0.5} y={0.5} width={size - 1} height={size - 1} r={10} color={theme.colors.surfaceHi} />
              <RoundedRect x={0.5} y={0.5} width={size - 1} height={size - 1} r={10} color={theme.colors.borderStrong} style="stroke" strokeWidth={1} />
              <Path path={`M ${size * 0.32} ${size * 0.32} L ${size * 0.68} ${size * 0.68} M ${size * 0.68} ${size * 0.32} L ${size * 0.32} ${size * 0.68}`} color={theme.colors.textTertiary} style="stroke" strokeWidth={1.6} strokeCap="round" />
            </>
          ) : (
            <>
              <RoundedRect x={0} y={depth} width={size} height={size} r={10} color={shade(face, 0.62)} />
              <RoundedRect x={0} y={0} width={size} height={size} r={10} color={face} />
              {texture && (
                <Group clip={rrect(rect(0, 0, size, size), 10, 10)}>
                  <Path path={texture.path} color={shade(face, 0.78)} style={texture.style} strokeWidth={1} opacity={0.55} />
                </Group>
              )}
            </>
          )}
        </Canvas>
      </Animated.View>
    </PressableScale>
  );
}

const styles = themedStyles(() => ({
  container: { flex: 1, alignItems: 'center', backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingHorizontal: theme.spacing.md },
  back: { color: theme.colors.textPrimary, fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRightSpacer: { width: 56, alignItems: 'center' },
  name: { fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.headline, lineHeight: theme.typography.lineHeights.headline, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  kickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', marginTop: 2 },
  kickerChip: { marginRight: 6 },
  kicker: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.semibold, color: theme.colors.glassAccent, flexShrink: 1 },
  track: { width: TRACK_WIDTH, height: 3, borderRadius: 1.5, backgroundColor: theme.colors.surfaceAlt, marginTop: theme.spacing.sm, overflow: 'hidden' },
  trackFill: { width: TRACK_WIDTH, height: 3, borderRadius: 1.5, backgroundColor: theme.colors.glassAccent },
  batchDots: { marginTop: theme.spacing.sm },
  quiet: { opacity: 0 },
  coinBalance: { marginTop: theme.spacing.sm },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  stage: { borderRadius: 28, paddingHorizontal: STAGE_H_PADDING, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.borderStrong },
  palette: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.md },
  swatch: { padding: 4, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent' },
  swatchOn: { borderColor: theme.colors.glassAccent, backgroundColor: theme.colors.surface },
  controls: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg },
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
  roundKey: { width: 46, height: 46, paddingHorizontal: 0, paddingVertical: 0, justifyContent: 'center' },
  disabled: { opacity: 0.4 },
}));
