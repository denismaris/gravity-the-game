import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Canvas, Circle, Group, Rect, RoundedRect } from '@shopify/react-native-skia';
import { PressableScale } from '../components';
import { shade, useReducedMotion } from '../game/rendering';
import { theme, themedStyles, inkWash } from '../theme';
import { mazeColors } from './mazePalette';

export interface BreatherIntroProps {
  /** The paint colour the first maze will use, so the picture here
   * previews the break that follows. */
  readonly paint: readonly [string, string, string];
  readonly mazeCount: number;
  readonly onBegin: () => void;
  readonly onSkip: () => void;
}

/** One breath: in, then out, each this long. Slow on purpose - about the
 * pace of a calm resting breath. */
const BREATH_MS = 4000;

const ART_W = 232;
const ART_H = 168;
const CELL = 30;

/** The little ring maze in the picture: floor squares, and how far along
 * the path the paint has got. Row-major 5x3 ring. */
const RING: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
  [4, 1], [4, 2], [3, 2], [2, 2], [1, 2], [0, 2], [0, 1],
];
const PAINTED = 6;

/**
 * The cut screen between a finished batch and the break's mazes: a
 * moment to stop before playing anything. A breathing ring paces a slow
 * breath, and a small picture of the maze to come shows the idea
 * (roll, paint) before the player has to do it. The break starts only
 * when they choose to.
 *
 * Everything that moves here runs on the native driver, and the one JS
 * update is the caption flipping every four seconds.
 */
export function BreatherIntro({ paint, mazeCount, onBegin, onSkip }: BreatherIntroProps): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const breath = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const [inhale, setInhale] = useState(true);

  useEffect(() => {
    if (!reducedMotion) {
      Animated.timing(enter, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: BREATH_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: BREATH_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    const caption = setInterval(() => setInhale(v => !v), BREATH_MS);
    return () => {
      loop.stop();
      clearInterval(caption);
    };
  }, [breath, enter, reducedMotion]);

  const ringScale = breath.interpolate({ inputRange: [0, 1], outputRange: reducedMotion ? [0.97, 1.03] : [0.82, 1.08] });
  const ringOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const artLift = breath.interpolate({ inputRange: [0, 1], outputRange: reducedMotion ? [0, 0] : [3, -3] });
  const rise = (delay: number) => ({
    opacity: enter.interpolate({ inputRange: [delay, Math.min(1, delay + 0.5)], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: enter.interpolate({ inputRange: [delay, Math.min(1, delay + 0.5)], outputRange: [14, 0], extrapolate: 'clamp' }) }],
  });

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.kicker, rise(0)]}>BATCH COMPLETE · A LITTLE PAUSE</Animated.Text>
      <Animated.Text style={[styles.title, rise(0.1)]}>Take a breath</Animated.Text>

      <Animated.View style={[styles.artSlot, rise(0.2)]}>
        <Animated.View style={[styles.breathRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
        <Animated.View style={[styles.breathRingInner, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
        <Animated.View style={{ transform: [{ translateY: artLift }] }}>
          <MazePicture paint={paint} />
        </Animated.View>
      </Animated.View>

      <Animated.Text style={[styles.breathCaption, rise(0.3)]}>{inhale ? 'Breathe in…' : 'Breathe out…'}</Animated.Text>

      <Animated.View style={[styles.copy, rise(0.4)]}>
        <Text style={styles.body}>
          {mazeCount} little mazes. Swipe to roll the ball - every tile it crosses takes the paint.
        </Text>
        <Text style={styles.bodyQuiet}>No timer. No score. Just the path.</Text>
      </Animated.View>

      <Animated.View style={[styles.actions, rise(0.5)]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Begin the break"
          onPress={onBegin}
          style={({ pressed }) => [styles.begin, pressed && styles.pressed]}
        >
          <Text style={styles.beginLabel}>Begin</Text>
        </PressableScale>
        <PressableScale accessibilityRole="button" accessibilityLabel="Skip the break" onPress={onSkip} hitSlop={10} style={styles.skip}>
          <Text style={styles.skipLabel}>Skip the break</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

/** A still of the game: a small ring maze carved into the paper slab,
 * half painted, the ball resting at the paint's leading edge. Drawn with
 * the maze screen's own palette and geometry so it is a true preview. */
function MazePicture({ paint }: { paint: readonly [string, string, string] }): React.JSX.Element {
  const pad = 22;
  const side = 7;
  const slabW = CELL * 5 + pad * 2;
  const slabH = CELL * 3 + pad * 2;
  const ox = (ART_W - slabW) / 2;
  const oy = (ART_H - slabH - side) / 2;
  const face = Math.round(CELL * 0.22);
  const ball = RING[PAINTED - 1];
  const r = CELL * 0.4;
  const bx = ox + pad + ball[0] * CELL + CELL / 2;
  const by = oy + pad + ball[1] * CELL + CELL / 2;
  return (
    <Canvas style={{ width: ART_W, height: ART_H }}>
      <RoundedRect x={ox} y={oy + side} width={slabW} height={slabH} r={16} color={mazeColors.slabSide} />
      <RoundedRect x={ox} y={oy} width={slabW} height={slabH} r={16} color={mazeColors.slab} />
      <Group transform={[{ translateX: ox + pad }, { translateY: oy + pad }]}>
        {RING.map(([c, row], i) => (
          <Rect key={`f${c}-${row}`} x={c * CELL} y={row * CELL} width={CELL} height={CELL} color={i < PAINTED ? paint[1] : mazeColors.socket} />
        ))}
        {/* The far wall above each top-row square, and above the hole. */}
        {RING.filter(([, row]) => row === 0 || row === 2).map(([c, row]) =>
          row === 0 || (c > 0 && c < 4) ? (
            <Rect key={`w${c}-${row}`} x={c * CELL} y={row * CELL} width={CELL} height={face} color={mazeColors.wallFace} />
          ) : null,
        )}
        {RING.slice(0, PAINTED).map(([c, row]) => (
          <Rect key={`l${c}-${row}`} x={c * CELL} y={row * CELL + (row === 0 || row === 2 ? face : 0)} width={CELL} height={2} color={paint[0]} opacity={0.8} />
        ))}
      </Group>
      <Circle cx={bx + r * 0.12} cy={by + r * 0.22} r={r} color={inkWash(0.22)} />
      <Circle cx={bx} cy={by} r={r} color={mazeColors.ball} />
      <Circle cx={bx - r * 0.1} cy={by - r * 0.12} r={r * 0.84} color={shade(mazeColors.ball, 1.45)} />
      <Circle cx={bx - r * 0.34} cy={by - r * 0.38} r={r * 0.22} color="rgba(255,255,255,0.7)" />
    </Canvas>
  );
}

const styles = themedStyles(() => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: 72,
  },
  kicker: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.micro,
    letterSpacing: 1.5,
    color: theme.colors.secondary,
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.display,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
    textAlign: 'center',
  },
  artSlot: {
    width: 280,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.md,
  },
  breathRing: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: theme.colors.sand,
    opacity: 0.6,
  },
  breathRingInner: {
    position: 'absolute',
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 1.5,
    borderColor: theme.colors.sandDeep,
  },
  breathCaption: {
    fontFamily: theme.typography.families.display,
    fontStyle: 'italic',
    fontSize: theme.typography.sizes.subtitle,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  copy: {
    alignItems: 'center',
    maxWidth: 320,
  },
  body: {
    fontSize: theme.typography.sizes.body,
    lineHeight: 22,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  bodyQuiet: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.sizes.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    marginTop: theme.spacing.xl,
    alignItems: 'center',
  },
  begin: {
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
  },
  pressed: { opacity: 0.85 },
  beginLabel: {
    color: theme.colors.surfaceHi,
    fontSize: theme.typography.sizes.subtitle,
    fontWeight: theme.typography.weights.semibold,
    letterSpacing: 0.5,
  },
  skip: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  skipLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.semibold,
  },
}));
