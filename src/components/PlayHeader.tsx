import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { GameKind, accentColorForKind, gameDisplayName } from '../game/journey';
import { PuzzleDifficulty } from '../game/puzzleDifficulty';
import { isReducedMotion } from '../game/rendering';
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
import { setEmblemTarget, whenEmblemLanded } from './EmblemHandoff';
import { usePlayerProgress } from '../progression/PlayerProgressProvider';
import { useDealsReleased } from '../game/rendering/dealGate';

/** The header's keys: a size down from the round keys under the board. */
const KEY = 40;
const KEY_LIP = 3;
/** The game's emblem in the header, where the hand-off's lands. */
const EMBLEM = 30;

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

  // The emblem: hidden while the hand-off's is flying to it, then shown
  // in the frame that one lands.
  const emblemRef = useRef<React.ElementRef<typeof View>>(null);
  const [emblemShown, setEmblemShown] = useState(false);
  useEffect(() => whenEmblemLanded(() => setEmblemShown(true)), []);
  const measureEmblem = () => {
    emblemRef.current?.measureInWindow((x: number, y: number, w: number) => {
      if (w > 0) setEmblemTarget({ x: x + w / 2, y: y + EMBLEM / 2, size: EMBLEM });
    });
  };

  // The rest arrives as the veil opens: the name and line settle in under
  // the landing emblem, the keys either side a beat later.
  const enter = useRef(new Animated.Value(isReducedMotion() ? 1 : 0)).current;
  const released = useDealsReleased();
  useEffect(() => {
    if (!released) return;
    Animated.timing(enter, { toValue: 1, duration: 520, easing: curve.linear, useNativeDriver: true }).start();
  }, [released, enter]);
  const rise = (from: number, to: number, dy: number) => ({
    opacity: enter.interpolate({ inputRange: [from, Math.min(1, from + (to - from) * 0.6)], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: enter.interpolate({ inputRange: [from, to], outputRange: [dy, 0], extrapolate: 'clamp', easing: curve.arrive }) }],
  });

  // The status figure ticks on every change, the way the count on a
  // scoreboard turns over: `kick`, never `pop` (this fires on every move).
  const tick = useRef(new Animated.Value(1)).current;
  const previous = useRef(status);
  useEffect(() => {
    if (status === previous.current) return;
    previous.current = status;
    tick.setValue(0.86);
    Animated.spring(tick, { toValue: 1, useNativeDriver: true, ...motion.spring.kick }).start();
  }, [status, tick]);

  return (
    <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
      <View style={styles.row}>
        <Animated.View style={rise(0.25, 0.85, 6)}>
          <PressableScale accessibilityRole="button" accessibilityLabel={exitLabel} onPress={onExit} hitSlop={8} scaleTo={1} holdMs={motion.beat.pressHold}>
            <RaisedKey height={KEY} width={KEY} lip={KEY_LIP} face={theme.colors.surfaceHi} edge={theme.colors.borderStrong} rim={theme.colors.border}>
              <Icon name="back" size={16} color={theme.colors.textPrimary} weight={2} />
            </RaisedKey>
          </PressableScale>
        </Animated.View>

        <View style={styles.title}>
          <View ref={emblemRef} collapsable={false} onLayout={measureEmblem} style={!emblemShown && styles.hidden}>
            <GameEmblem kind={kind} size={EMBLEM} raised />
          </View>
          <Animated.View style={rise(0, 0.6, 5)}>
            <Text style={styles.name} numberOfLines={1}>
              {gameDisplayName(kind)}
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={rise(0.32, 0.92, 6)}>
          <PressableScale accessibilityRole="button" accessibilityLabel="How to play" onPress={onHelp} hitSlop={8} scaleTo={1}>
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
          <Text style={[styles.status, { color: accent }]} numberOfLines={1}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Text>
        </Animated.View>
      </Animated.View>
      <Animated.View style={rise(0.2, 0.8, 3)}>
        {dots ?? <PuzzleProgressMark batch={progress.currentBatch} puzzleId={puzzleId} style={styles.dots} />}
      </Animated.View>
    </View>
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
  header: { alignSelf: 'stretch', paddingHorizontal: theme.spacing.md, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', justifyContent: 'space-between' },
  title: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: theme.spacing.sm },
  hidden: { opacity: 0 },
  name: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title,
    lineHeight: theme.typography.lineHeights.title,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  line: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm },
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
