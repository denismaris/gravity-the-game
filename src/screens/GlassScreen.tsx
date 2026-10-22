import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RoundKey } from '../components/RoundKey';
import { Animated, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Group, Path, rect, RoundedRect, rrect } from '@shopify/react-native-skia';
import { LevelSetComplete, MechanicsCarousel, PressableScale, PuzzleSolved, renderGlassIllustration, useSolveCelebration } from '../components';
import { CoinBalance, useCoinPurchase } from '../components/Coins';
import { GLASS_ARCH, GlassBoard, glassColor, glassTexture, StrokePhase } from '../components/GlassBoard';
import { MechanicIntro } from '../components/MechanicIntro';
import { Icon } from '../components/Icon';
import { InsightButton, useInsightPower } from '../components/InsightPower';
import { PageBloom } from '../components/PageBloom';
import { DockFloor, DockGap, dockPlate, StageTopGap } from '../components/StageTopGap';
import { useStageEntrance } from '../components/useStageEntrance';
import { clashes, GLASS_COLOR_NAMES, glassesFor, trayOf, GlassColor, glassHint, GlassPuzzle, GlassState, initialGlassState, isGlassSolved, paint, panesLeft } from '../game/glass';
import { accentColorForKind, GameKind, NextPuzzleOptions } from '../game/journey';
import { mechanic } from '../game/mechanics';
import { isStandalonePuzzle } from '../game/journey/daily';
import { shade, triggerFeedback } from '../game/rendering';
import { GLASS_MECHANICS_SLIDES, tutorialIdForGame } from '../game/tutorials';
import { BatchState, nextInBatch, usePlayerProgress } from '../progression';
import { useSettings } from '../settings';
import { motion, theme, themedStyles } from '../theme';
import { PlayHeader } from '../components/PlayHeader';

const ICON_SIZE = 14;
const RESERVED = 330;
const STAGE_H_PADDING = theme.spacing.sm;
const TUTORIAL_ID = tutorialIdForGame('glass');

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
      // A given pane, or emerald on a pane with no leaf: nothing to set.
      if (puzzle.given[pane] !== null || (brush !== null && !glassesFor(puzzle, pane).includes(brush))) {
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
      triggerFeedback(color === null ? 'glassLift' : more ? 'glassClash' : (['glassRuby', 'glassCobalt', 'glassAmber', 'glassCobalt'] as const)[color]);
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
      triggerFeedback('targetReached');
    });
  }, [puzzle, state, insight]);

  const goNext = useCallback(() => {
    if (nextEntry) onNextPuzzle(nextEntry.kind, nextEntry.puzzleId, { showInterstitial: batchCompletedRef.current });
  }, [nextEntry, onNextPuzzle]);

  // The window stands taller than it is wide: the arch sits on top.
  const boardSize = Math.max(0, Math.min(width - theme.spacing.md * 2 - STAGE_H_PADDING * 2, (height - insets.top - insets.bottom - RESERVED) / (1 + GLASS_ARCH)));

  return (
    <View style={styles.container}>
      <PageBloom />
      <PlayHeader
        kind="glass"
        difficulty={puzzle.difficulty}
        status={solved ? 'Finished' : clashCount > 0 ? `${clashCount} ${clashCount === 1 ? 'clash' : 'clashes'}` : `${left} left`}
        solved={solved}
        puzzleId={puzzle.id}
        onExit={onExit}
        onHelp={() => setShowHelp(true)}
      />

      <View style={styles.boardArea}>
        <StageTopGap />
        <Animated.View style={[styles.stage, stageIn]}>
          {/* Finished: the board takes no more touches. Never collapsed: on
              Android a flattened wrapper is re-created when its touches
              change, and the board canvas under it redraws from blank - a
              white flash at every finish. */}
          <View collapsable={false} pointerEvents={solved ? 'none' : 'auto'}>
            <GlassBoard puzzle={puzzle} state={state} size={boardSize} solved={solved} onStroke={onStroke} highlight={highlight} />
          </View>
        </Animated.View>

        {/* The glass to set, in a tray like Mosaic's pieces. */}
        <Animated.View style={[styles.palette, controlsIn]}>
          {[...trayOf(puzzle), null].map(color => (
            <Swatch key={String(color)} color={color} selected={brush === color} onPress={() => setBrush(color)} />
          ))}
        </Animated.View>

        <DockGap />
        <Animated.View style={[styles.controls, dockPlate.plate, controlsIn]}>
          <InsightButton count={insight.count} onPress={useHint} />
          {insight.sheet}
          <RoundKey accessibilityLabel="Undo" onPress={undo} disabled={history.length === 0} dim={history.length === 0}>
            <Icon name="undo" size={ICON_SIZE} color={theme.colors.glassAccent} />
          </RoundKey>
          <RoundKey accessibilityLabel="Restart window" onPress={restart}>
            <Icon name="restart" size={ICON_SIZE} color={theme.colors.glassAccent} />
          </RoundKey>
        </Animated.View>
        {/* Coins only matter here once Insight runs out: until then the
          line keeps its place but stays out of sight. */}
        <View style={insight.count > 0 && !shortBy ? styles.quiet : undefined} accessibilityElementsHidden={insight.count > 0 && !shortBy} importantForAccessibility={insight.count > 0 && !shortBy ? 'no-hide-descendants' : 'auto'}>
          <CoinBalance coins={coins} shortBy={shortBy} style={styles.coinBalance} />
        </View>
        <DockFloor />
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

      <MechanicIntro intros={puzzle.vines?.length ? [mechanic('mechanic:glass-vines')] : []} accent={accentColorForKind('glass')} />
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
              <RoundedRect x={0} y={depth} width={size} height={size} r={10} color={theme.colors.borderStrong} />
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
  quiet: { opacity: 0 },
  coinBalance: { marginTop: theme.spacing.sm },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  stage: { borderRadius: 28, paddingHorizontal: STAGE_H_PADDING, paddingVertical: theme.spacing.md },
  palette: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.md },
  swatch: { padding: 4, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent' },
  swatchOn: { borderColor: theme.colors.glassAccent, backgroundColor: theme.colors.surface },
  controls: { flexDirection: 'row', gap: theme.spacing.md },
}));
