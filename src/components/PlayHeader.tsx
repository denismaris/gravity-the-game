import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { GAME_RULES, GameKind, accentColorForKind, gameDisplayName } from '../game/journey';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { announce, isReducedMotion, readableOn } from '../game/rendering';
import { motion, theme, themedStyles } from '../theme';
import { curve } from '../theme/motion';
import { Text } from './Text';
import { Icon } from './Icon';
import { RaisedKey } from './RaisedKey';
import { PressableScale } from './PressableScale';
import { GameEmblem } from './GameEmblem';
import { DifficultyChip } from './DifficultyChip';
import { HelpHalo } from './HelpHalo';
import { PuzzleProgressMark } from './PuzzleProgressMark';
import { setEmblemMeasurer, setEmblemTarget, whenEmblemLanded } from './EmblemHandoff';
import { usePlayerProgress } from '../progression/PlayerProgressProvider';
import { useDealsReleased } from '../game/rendering/dealGate';
import { continuingFrom, isRepainting } from './playContinuity';

/** The header's keys: a size down from the round keys under the board. */
const KEY = 40;
const KEY_LIP = 3;
/** The game's emblem in the header, where the hand-off's lands. */
const EMBLEM = 30;

/**
 * Where the header's emblem stands on screen (its box's centre, in window
 * points), and a way to lend it: the solve screen takes it out of the
 * header and carries it down into its own page (`PuzzleSolved`), so the
 * same emblem that came in from Home goes on to the finish.
 */
interface EmblemSpot {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}
let spot: EmblemSpot | null = null;
const lendListeners = new Set<(lent: boolean) => void>();
export function headerEmblemSpot(): EmblemSpot | null {
  return spot;
}
export function lendHeaderEmblem(lent: boolean): void {
  lendListeners.forEach(listener => listener(lent));
}

export interface PlayHeaderProps {
  kind: GameKind;
  difficulty: PuzzleDifficulty;
  /** Where the board stands, in a few words: "9 left", "3 of par 6". The
   * figure in it ticks when it changes. */
  status: string;
  solved: boolean;
  /** The puzzle, for its place among the set's dots. */
  puzzleId: string;
  onExit: () => void;
  onHelp: () => void;
  /** Read for the back key: where it goes. */
  exitLabel?: string;
  /** In place of the set's dots: a trial's own run of boards. */
  dots?: React.ReactNode;
}

/**
 * The top of every game screen, the same in all twelve.
 *
 * Round keys either side, the same raised keys as Undo and Restart below
 * the board. Between them, the game itself: its emblem (the one carried in
 * from Home, which lands here) and its name. Under that, one quiet line:
 * how hard, and where the board stands, its figure ticking as it moves.
 * Then the set's dots. Boards have no names of their own here: a generated
 * title over a generated board read as made up, which it was.
 */
export function PlayHeader({ kind, difficulty, status, solved, puzzleId, onExit, onHelp, exitLabel = 'Back to home', dots }: PlayHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { progress } = usePlayerProgress();
  const accent = accentColorForKind(kind);
  // As text, never fainter than 4.5:1 on the page (two games' accents were not).
  const accentInk = readableOn(accent, theme.colors.background, theme.colors.textPrimary);

  // The emblem: hidden while the hand-off's is flying to it, then shown
  // in the frame that one lands.
  const emblemRef = useRef<React.ElementRef<typeof View>>(null);
  const [emblemShown, setEmblemShown] = useState(() => continuingFrom() !== null || isRepainting());
  useEffect(() => whenEmblemLanded(() => setEmblemShown(true)), []);
  // Lent to the solve screen while it shows.
  const [lent, setLent] = useState(false);
  useEffect(() => {
    lendListeners.add(setLent);
    return () => {
      lendListeners.delete(setLent);
      spot = null;
    };
  }, []);
  const measureEmblem = () => {
    emblemRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
      if (w <= 0) return;
      setEmblemTarget({ x: x + w / 2, y: y + EMBLEM / 2, size: EMBLEM });
      spot = { x: x + w / 2, y: y + h / 2, width: w };
    });
  };
  // Asked again as the hand-off's flight sets off (see `EmblemHandoff`).
  useEffect(() => {
    setEmblemMeasurer(done => {
      const node = emblemRef.current;
      if (!node) return done(null);
      node.measureInWindow((x: number, y: number, w: number) => done(w > 0 ? { x: x + w / 2, y: y + EMBLEM / 2, size: EMBLEM } : null));
    });
    return () => setEmblemMeasurer(null);
  }, []);

  // The rest arrives as the veil opens: the name and line settle in under
  // the landing emblem, the keys either side a beat later.
  // Continuing from another board: the header was already here. Same game,
  // it simply stays; another game swaps its emblem and name in place.
  const from = useRef(continuingFrom()).current;
  // A repaint (light/dark) keeps the header exactly where it is, too.
  const stays = from !== null || isRepainting();
  const enter = useRef(new Animated.Value(isReducedMotion() || stays ? 1 : 0)).current;
  const released = useDealsReleased();
  useEffect(() => {
    if (!released || stays) return;
    Animated.timing(enter, { toValue: 1, duration: 520, easing: curve.linear, useNativeDriver: true }).start();
  }, [released, enter, stays]);
  const swap = useRef(new Animated.Value(from !== null && from !== kind && !isReducedMotion() ? 0 : 1)).current;
  useEffect(() => {
    Animated.spring(swap, { toValue: 1, useNativeDriver: true, ...motion.spring.pop }).start();
  }, [swap]);
  const swapStyle = { opacity: swap.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ scale: swap.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] };
  const rise = (from: number, to: number, dy: number) => ({
    opacity: enter.interpolate({ inputRange: [from, Math.min(1, from + (to - from) * 0.6)], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: enter.interpolate({ inputRange: [from, to], outputRange: [dy, 0], extrapolate: 'clamp', easing: curve.arrive }) }],
  });

  // The rule, one tap away: the game's name drops it down under the header.
  const [rule, setRule] = useState(false);
  const ruleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showRule = () => {
    if (ruleTimer.current) clearTimeout(ruleTimer.current);
    setRule(open => {
      if (!open) {
        announce(GAME_RULES[kind], 0);
        ruleTimer.current = setTimeout(() => setRule(false), 6000);
      }
      return !open;
    });
  };
  useEffect(() => () => {
    if (ruleTimer.current) clearTimeout(ruleTimer.current);
  }, []);

  // The status figure ticks on every change, the way the count on a
  // scoreboard turns over: `kick`, never `pop` (this fires on every move).
  const tick = useRef(new Animated.Value(1)).current;
  const previous = useRef(status);
  useEffect(() => {
    if (status === previous.current) return;
    previous.current = status;
    // Heard as well as seen, with a screen reader on.
    announce(status);
    tick.setValue(0.86);
    Animated.spring(tick, { toValue: 1, useNativeDriver: true, ...motion.spring.kick }).start();
  }, [status, tick]);

  return (
    <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
      <View style={styles.row}>
        <Animated.View style={rise(0.25, 0.85, 6)}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={exitLabel}
            onPress={() => {
              onExit();
            }}
            hitSlop={8}
            scaleTo={1}
            holdMs={motion.beat.pressHold}
          >
            <RaisedKey height={KEY} width={KEY} lip={KEY_LIP} face={theme.colors.surfaceHi} edge={theme.colors.borderStrong} rim={theme.colors.border}>
              <Icon name="back" size={16} color={theme.colors.textPrimary} weight={2} />
            </RaisedKey>
          </PressableScale>
        </Animated.View>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${gameDisplayName(kind)}. Show the rule`}
          onPress={showRule}
          scaleTo={0.97}
          containerStyle={styles.titleKey}
          style={styles.title}
        >
          <View ref={emblemRef} collapsable={false} onLayout={measureEmblem} style={(!emblemShown || lent) && styles.hidden}>
            <Animated.View style={swapStyle}>
              <GameEmblem kind={kind} size={EMBLEM} raised />
            </Animated.View>
          </View>
          <Animated.View style={[styles.nameWrap, rise(0, 0.6, 5)]}>
            <Animated.View style={swapStyle}>
              <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {gameDisplayName(kind)}
              </Text>
            </Animated.View>
          </Animated.View>
        </PressableScale>

        <Animated.View style={rise(0.32, 0.92, 6)}>
          <PressableScale accessibilityRole="button" accessibilityLabel="How to play" accessibilityHint="Hold for the rule in a sentence" onPress={onHelp} onLongPress={showRule} hitSlop={8} scaleTo={1}>
            <RaisedKey height={KEY} width={KEY} lip={KEY_LIP} face={theme.colors.surfaceHi} edge={theme.colors.borderStrong} rim={theme.colors.border}>
              <HelpHalo />
              <HelpMark />
            </RaisedKey>
          </PressableScale>
        </Animated.View>
      </View>

      <Animated.View style={[styles.line, rise(0.12, 0.72, 4)]}>
        <DifficultyChip difficulty={difficulty} />
        <View style={styles.sep} />
        <Animated.View style={[styles.statusWrap, { transform: [{ scale: tick }] }]} accessibilityLiveRegion="polite">
          {solved && <Icon name="check" size={12} color={accent} weight={2.2} />}
          <Text style={[styles.status, { color: accentInk }]} numberOfLines={2}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Text>
        </Animated.View>
      </Animated.View>
      {rule && <RuleCard text={GAME_RULES[kind]} onClose={() => setRule(false)} />}
      <Animated.View style={rise(0.2, 0.8, 3)}>
        {dots ?? <PuzzleProgressMark batch={progress.currentBatch} puzzleId={puzzleId} style={styles.dots} />}
      </Animated.View>
    </View>
  );
}

/** The rule in a sentence, dropped from the header over the board's top,
 * gone on a tap or after a few seconds. */
function RuleCard({ text, onClose }: { text: string; onClose: () => void }): React.JSX.Element {
  const t = useRef(new Animated.Value(isReducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(t, { toValue: 1, useNativeDriver: true, ...motion.spring.settle }).start();
  }, [t]);
  return (
    <Animated.View
      style={[styles.ruleWrap, { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}
    >
      <PressableScale accessibilityRole="button" accessibilityLabel={`${text} Tap to close`} onPress={onClose} scaleTo={1} style={styles.ruleCard}>
        <Text style={styles.ruleText}>{text}</Text>
      </PressableScale>
    </Animated.View>
  );
}

/** A question mark drawn to the same stroke as the other key glyphs. */
function HelpMark(): React.JSX.Element {
  return (
    <Canvas style={styles.helpMark}>
      <Path path="M 5.1 5.4 A 2.1 2.1 0 1 1 8.2 7.3 C 7.35 7.8 7 8.2 7 9.1" color={theme.colors.textPrimary} style="stroke" strokeWidth={1.7} strokeCap="round" />
      <Circle cx={7} cy={11.4} r={0.95} color={theme.colors.textPrimary} />
    </Canvas>
  );
}

const styles = themedStyles(() => ({
  header: { alignSelf: 'stretch', paddingHorizontal: theme.spacing.md, alignItems: 'center', zIndex: 5 },
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', justifyContent: 'space-between' },
  titleKey: { flex: 1 },
  title: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: theme.spacing.sm },
  ruleWrap: { position: 'absolute', top: '100%', left: theme.spacing.md, right: theme.spacing.md, alignItems: 'center', zIndex: 20 },
  ruleCard: {
    maxWidth: 420,
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ruleText: { fontSize: theme.typography.sizes.body, lineHeight: theme.typography.lineHeights.body, color: theme.colors.textPrimary, textAlign: 'center' },
  hidden: { opacity: 0 },
  nameWrap: { flexShrink: 1 },
  name: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title,
    lineHeight: theme.typography.lineHeights.title,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', marginTop: theme.spacing.sm },
  sep: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.colors.borderStrong, marginHorizontal: theme.spacing.sm },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  status: {
    fontFamily: theme.typography.families.figures,
    fontVariant: ['tabular-nums'],
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.semibold,
  },
  dots: { marginTop: theme.spacing.sm },
  helpMark: { width: 14, height: 14 },
}));
