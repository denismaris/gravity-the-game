import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, Keyframe, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerFeedback } from '../../game/rendering';
import { theme, themedStyles } from '../../theme';
import { PressableScale } from '../PressableScale';
import { GameEmblem } from '../GameEmblem';
import { GESTURE_VERB, LessonGesture, LessonGuideContext } from './guides';

/**
 * One step of a hands-on lesson: what the instruction card says, what the
 * guidance under the board says while the player tries, and the praise
 * once they have done it.
 */
export interface LessonStepCopy {
  readonly title: string;
  readonly say: string;
  /** Under the board while the player tries ("Tap the glowing square"). */
  readonly hint: string;
  /** Under the board once it is done. */
  readonly praise: string;
}

export type LessonPhase = 'doing' | 'success' | 'done';

/**
 * The flow of a lesson: which step is live, and the beat between steps -
 * a success holds for a moment so it lands, then the next step slides in.
 */
export function useLessonFlow(stepCount: number, onEnterStep?: (index: number) => void): {
  index: number;
  phase: LessonPhase;
  succeed: () => void;
  wrong: () => void;
  wrongNonce: number;
} {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<LessonPhase>('doing');
  const [wrongNonce, setWrongNonce] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enter = useRef(onEnterStep);
  enter.current = onEnterStep;
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Kept in refs as well as state, so the beat between steps is decided
  // once, outside any state updater (React may run an updater twice).
  const phaseRef = useRef<LessonPhase>('doing');
  const indexRef = useRef(0);
  const succeed = useCallback(() => {
    if (phaseRef.current !== 'doing') return;
    phaseRef.current = 'success';
    setPhase('success');
    triggerFeedback('targetReached');
    timer.current = setTimeout(() => {
      const next = indexRef.current + 1;
      if (next >= stepCount) {
        phaseRef.current = 'done';
        setPhase('done');
        triggerFeedback('coin');
        return;
      }
      indexRef.current = next;
      enter.current?.(next);
      setIndex(next);
      phaseRef.current = 'doing';
      setPhase('doing');
    }, 1300);
  }, [stepCount]);

  const wrong = useCallback(() => {
    triggerFeedback('tap');
    setWrongNonce(n => n + 1);
  }, []);

  return { index, phase, succeed, wrong, wrongNonce };
}

/** The instruction card, down from the top. */
const CARD_IN = FadeInDown.duration(420).easing(Easing.out(Easing.cubic));
/** The guide card, up from the bottom, a beat after the instruction. */
const GUIDE_IN = FadeInUp.duration(380).delay(160).easing(Easing.out(Easing.cubic));
/** The praise, up at once - it answers the player's move. */
const PRAISE_IN = FadeInUp.duration(300).easing(Easing.out(Easing.cubic));
/** The board settles in once, at the start. */
/** The game's emblem, on the opening card: a soft pop. */
const EMBLEM_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.back(1.8)) },
}).duration(560);
const BOARD_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.94 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.back(1.4)) },
}).duration(520);

/**
 * The stage every lesson plays on: the instruction card slides down from
 * the top, the real board sits in the middle, and the guidance card rises
 * from the bottom - turning to praise when the step is done. At the end, a
 * short "you're ready" and the way into the real puzzle.
 *
 * Every movement here is a Reanimated layout animation or shared value, so
 * it runs on the UI thread: a board redrawing after a tap never stalls a
 * card mid-slide. Cards are keyed by step, so new text mounts already
 * hidden and animates in, rather than showing for a frame first.
 */
export function LessonShell({
  gameName,
  accent,
  steps,
  index,
  phase,
  wrongNonce,
  renderBoard,
  onDone,
}: {
  gameName: string;
  accent: string;
  steps: ReadonlyArray<LessonStepCopy>;
  index: number;
  phase: LessonPhase;
  wrongNonce: number;
  /** Draws the board at `size` points square. */
  renderBoard: (size: number) => React.ReactNode;
  onDone: () => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const step = steps[index];
  const boardSize = Math.min(width - theme.spacing.lg * 2, height * 0.42, 360);

  // A gentle shake when a tap lands somewhere else.
  const shake = useSharedValue(0);
  useEffect(() => {
    if (wrongNonce === 0) return;
    shake.value = withSequence(
      withTiming(8, { duration: 50 }),
      withTiming(-8, { duration: 80 }),
      withTiming(5, { duration: 70 }),
      withTiming(0, { duration: 60 }),
    );
  }, [wrongNonce, shake]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  // A miss earns a word as well as a shake, until the step is done.
  const [missedStep, setMissedStep] = useState<number | null>(null);
  useEffect(() => {
    if (wrongNonce > 0) setMissedStep(index);
    // Only a new miss counts; a new step clears it by not matching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongNonce]);
  const guide = useContext(LessonGuideContext);
  // The opening card: the game, its goal, and how it is played - before
  // the first step asks for anything.
  const [started, setStarted] = useState(guide === null);

  const done = phase === 'done';
  const success = phase === 'success';

  if (!started && guide) {
    return (
      <View style={[styles.layer, { paddingTop: insets.top + theme.spacing.sm, paddingBottom: insets.bottom + theme.spacing.md }]}>
        <View style={styles.topBar}>
          <Text style={[styles.eyebrow, { color: accent }]}>{`LEARN ${gameName.toUpperCase()}`}</Text>
          <PressableScale accessibilityRole="button" accessibilityLabel="Skip the lesson" onPress={onDone} hitSlop={10}>
            <Text style={styles.skip}>Skip</Text>
          </PressableScale>
        </View>
        <View style={styles.introBody}>
          <Animated.View entering={EMBLEM_IN}>
            <GameEmblem kind={guide.kind} size={96} />
          </Animated.View>
          <Animated.Text entering={FadeInDown.duration(420).delay(120)} style={styles.introName} accessibilityRole="header">
            {gameName}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.duration(420).delay(200)} style={styles.introGoal}>
            {guide.goal}
          </Animated.Text>
          <Animated.View entering={FadeInDown.duration(420).delay(280)} style={styles.chips}>
            {[`${steps.length} short steps`, `You play by ${GESTURE_VERB[guide.gesture]}`, 'About a minute'].map(chip => (
              <View key={chip} style={styles.chip}>
                <Text style={styles.chipText}>{chip}</Text>
              </View>
            ))}
          </Animated.View>
        </View>
        <Animated.View entering={FadeInUp.duration(420).delay(360)} style={styles.footer}>
          <PressableScale accessibilityRole="button" accessibilityLabel="Show me how" onPress={() => setStarted(true)} style={({ pressed }) => [styles.start, { backgroundColor: accent }, pressed && styles.pressed]}>
            <Text style={styles.startText}>Show me how</Text>
          </PressableScale>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.layer, { paddingTop: insets.top + theme.spacing.sm, paddingBottom: insets.bottom + theme.spacing.md }]}>
      <View style={styles.topBar}>
        <Text style={[styles.eyebrow, { color: accent }]}>{`LEARN ${gameName.toUpperCase()}`}</Text>
        {!done && (
          <PressableScale accessibilityRole="button" accessibilityLabel="Skip the lesson" onPress={onDone} hitSlop={10}>
            <Text style={styles.skip}>Skip</Text>
          </PressableScale>
        )}
      </View>
      <View style={styles.bars}>
        {steps.map((_s, i) => (
          <View key={i} style={styles.bar}>
            {(i < index || (i === index && (success || done))) && <Animated.View entering={FadeIn.duration(320)} style={[styles.barFill, { backgroundColor: accent }]} />}
          </View>
        ))}
      </View>

      {guide && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.goalRow}>
          <Text style={[styles.goalLabel, { color: accent }]}>GOAL</Text>
          <Text style={styles.goalText} numberOfLines={2}>
            {guide.goal}
          </Text>
        </Animated.View>
      )}

      <View style={styles.instruction}>
        <Animated.View key={done ? 'done' : `step-${index}`} entering={CARD_IN}>
          <Text style={styles.stepLabel}>{done ? 'ALL DONE' : `STEP ${index + 1} OF ${steps.length}`}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {done ? 'You are ready' : step.title}
          </Text>
          <Text style={styles.say}>{done ? `That is all there is to ${gameName}. The rest is practice, and every puzzle starts easy.` : step.say}</Text>
        </Animated.View>
      </View>

      {done && guide ? (
        <View style={styles.boardWrap}>
          <Animated.View entering={CARD_IN} style={[styles.recap, { borderColor: accent }]}>
            <Text style={[styles.recapLabel, { color: accent }]}>THE RULES IN SHORT</Text>
            {guide.recap.map((line, i) => (
              <Animated.View key={i} entering={FadeInDown.duration(380).delay(140 + i * 110)} style={styles.recapRow}>
                <View style={[styles.recapNum, { backgroundColor: accent }]}>
                  <Text style={styles.recapNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.recapText}>{line}</Text>
              </Animated.View>
            ))}
          </Animated.View>
        </View>
      ) : (
        <Animated.View entering={BOARD_IN} exiting={FadeOut.duration(200)} style={styles.boardWrap}>
          <View style={{ width: boardSize, height: boardSize, alignItems: 'center', justifyContent: 'center' }}>{renderBoard(boardSize)}</View>
        </Animated.View>
      )}

      <View style={styles.footer}>
        {done ? (
          <Animated.View key="start" entering={GUIDE_IN}>
            <PressableScale accessibilityRole="button" accessibilityLabel="Start playing" onPress={onDone} style={({ pressed }) => [styles.start, pressed && styles.pressed]}>
              <Text style={styles.startText}>Start playing</Text>
            </PressableScale>
          </Animated.View>
        ) : (
          <Animated.View style={shakeStyle}>
            <Animated.View key={`${index}-${phase}`} entering={success ? PRAISE_IN : GUIDE_IN} style={[styles.guide, success && [styles.guideSuccess, { borderColor: accent }]]}>
              <View style={[styles.guideDot, { backgroundColor: success ? accent : theme.colors.surfaceAlt }]}>
                {success ? <Text style={[styles.guideDotText, styles.guideDotTextOn]}>{'✓︎'}</Text> : <GestureCue gesture={guide?.gesture ?? 'tap'} color={accent} />}
              </View>
              <View style={styles.guideBody}>
                {!success && missedStep === index && (
                  <Animated.Text entering={FadeIn.duration(200)} style={[styles.miss, { color: accent }]}>
                    NOT QUITE
                  </Animated.Text>
                )}
                <Text style={styles.guideText}>{success ? step.praise : step.hint}</Text>
              </View>
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

/**
 * A tiny loop acting out the gesture a step wants, inside the guide's dot:
 * a ripple for a tap, a fingertip gliding for a swipe or a drag. Shared
 * values on the UI thread - it costs the board nothing.
 */
function GestureCue({ gesture, color }: { gesture: LessonGesture; color: string }): React.JSX.Element {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withSequence(withTiming(1, { duration: gesture === 'tap' ? 900 : 1100, easing: Easing.out(Easing.quad) }), withDelay(250, withTiming(0, { duration: 0 }))), -1);
  }, [t, gesture]);
  const ring = useAnimatedStyle(() => ({ opacity: 1 - t.value, transform: [{ scale: 0.4 + t.value * 1.1 }] }));
  const tip = useAnimatedStyle(() =>
    gesture === 'tap'
      ? { opacity: 1, transform: [{ scale: t.value < 0.2 ? 1 - t.value : 0.8 + (t.value - 0.2) * 0.25 }] }
      : { opacity: t.value < 0.85 ? 1 : (1 - t.value) / 0.15, transform: [{ translateX: -8 + t.value * 16 }] },
  );
  return (
    <View style={styles.cue}>
      {gesture === 'tap' && <Animated.View style={[styles.cueRing, { borderColor: color }, ring]} />}
      <Animated.View style={[styles.cueTip, { backgroundColor: color }, tip]} />
    </View>
  );
}

const styles = themedStyles(() => ({
  layer: { ...StyleSheet.absoluteFill, zIndex: 30, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.lg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro + 1, letterSpacing: theme.typography.tracking.eyebrow },
  skip: { fontSize: theme.typography.sizes.body, fontWeight: theme.typography.weights.semibold, color: theme.colors.textSecondary },
  bars: { flexDirection: 'row', gap: 5, marginTop: theme.spacing.md },
  bar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: theme.colors.border },
  barFill: { ...StyleSheet.absoluteFill },
  instruction: { marginTop: theme.spacing.md, minHeight: 150 },
  stepLabel: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.4, color: theme.colors.textTertiary },
  title: { marginTop: 6, fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title + 4, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary },
  say: { marginTop: 6, fontSize: theme.typography.sizes.body + 1, lineHeight: 24, color: theme.colors.textSecondary },
  boardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { minHeight: 72, justifyContent: 'center' },
  guide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  guideSuccess: { backgroundColor: theme.colors.surfaceHi, borderWidth: 1.5 },
  guideDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  guideDotText: { fontSize: 15, fontWeight: theme.typography.weights.bold, color: theme.colors.textSecondary },
  guideDotTextOn: { color: theme.colors.surfaceHi },
  guideBody: { flex: 1 },
  introBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  introName: { marginTop: 10, fontFamily: theme.typography.families.display, fontSize: theme.typography.sizes.title + 12, fontWeight: theme.typography.weights.bold, color: theme.colors.textPrimary, textAlign: 'center' },
  introGoal: { fontSize: theme.typography.sizes.body + 2, lineHeight: 26, color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: theme.spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipText: { fontSize: theme.typography.sizes.caption, color: theme.colors.textSecondary },
  goalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: theme.spacing.md },
  goalLabel: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.4 },
  goalText: { flex: 1, fontSize: theme.typography.sizes.caption + 1, lineHeight: 19, color: theme.colors.textSecondary },
  miss: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.2, marginBottom: 2 },
  cue: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  cueRing: { position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  cueTip: { width: 9, height: 9, borderRadius: 4.5 },
  recap: { alignSelf: 'stretch', padding: 18, borderRadius: 20, borderWidth: 1, backgroundColor: theme.colors.surface, gap: 14 },
  recapLabel: { fontFamily: theme.typography.families.mono, fontSize: theme.typography.sizes.micro, letterSpacing: 1.4 },
  recapRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  recapNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  recapNumText: { fontSize: theme.typography.sizes.caption, fontWeight: theme.typography.weights.bold, color: theme.colors.surfaceHi },
  recapText: { flex: 1, fontSize: theme.typography.sizes.body, lineHeight: 22, color: theme.colors.textPrimary },
  guideText: { fontSize: theme.typography.sizes.body, lineHeight: 22, color: theme.colors.textPrimary },
  start: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  startText: { fontSize: theme.typography.sizes.body + 1, fontWeight: theme.typography.weights.semibold, color: theme.colors.surfaceHi },
  pressed: { opacity: 0.85 },
}));
