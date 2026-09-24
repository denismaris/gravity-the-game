import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { ConfettiBurst } from './ConfettiBurst';
import { GameEmblem } from './GameEmblem';
import { GeometricRule } from './GeometricRule';
import { PressableScale } from './PressableScale';
import { useCardEntrance } from './useCardEntrance';
import { accentColorForKind, GameKind, gameLabelForKind } from '../game/journey';
import { motion, theme } from '../theme';

export interface LevelSetCompleteProps {
  /** The level number that was just finished. */
  readonly levelNumber: number;
  /** Every game in the set, in the order it was played. */
  readonly kinds: ReadonlyArray<GameKind>;
  /** Move on - to the calming interstitial, then the next level. */
  readonly onContinue: () => void;
}

/** Title, the tally, the closing line, the action. */
const ROW_COUNT = 4;
/** Each emblem is *placed*, not merely revealed - slow enough to read as
 * one-at-a-time rather than a single group fade. */
const PLACE_STAGGER_MS = 150;
/** The tally starts once the card and its heading have settled. */
const PLACE_DELAY_MS = 420;

/**
 * The end of a whole level - a distinct, larger moment than finishing one
 * puzzle inside it.
 *
 * Kept as its own component rather than a section bolted onto
 * `PuzzleSolved` because the two are answering different questions. That
 * card reports a single puzzle: how many stars, how many hints, replay or
 * move on. This one reports a *set*: which games it was made of, and that
 * all of them are behind you. Folding the second into the first made one
 * card that did neither job clearly, and buried the rarer, bigger occasion
 * underneath the routine one.
 *
 * The tally is the whole point of the screen, so it gets the room: each
 * game's emblem drops into place on its own beat, its name arriving with
 * it, counted out rather than presented all at once.
 */
export function LevelSetComplete({ levelNumber, kinds, onContinue }: LevelSetCompleteProps): React.JSX.Element {
  const { backdrop, card, hero, rowStyle } = useCardEntrance(ROW_COUNT);
  const places = useRef(kinds.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(PLACE_DELAY_MS),
      Animated.stagger(
        PLACE_STAGGER_MS,
        places.map(value => Animated.spring(value, { toValue: 1, useNativeDriver: true, ...motion.spring.pop })),
      ),
    ]).start();
    // Mount-only: this card is mounted exactly when a set is completed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View style={[styles.scrim, { opacity: backdrop }]} pointerEvents="none" />
      <ConfettiBurst />
      <Animated.View
        style={[
          styles.cardShadow,
          {
            opacity: card,
            transform: [
              { scale: card.interpolate({ inputRange: [0, 1], outputRange: [motion.cardEnter.scaleFrom, 1] }) },
              { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
            ],
          },
        ]}
      >
        <View style={styles.card}>
          <Animated.View
            style={[
              styles.crest,
              {
                opacity: hero,
                transform: [{ scale: hero }],
              },
            ]}
          >
            <Text style={styles.crestNumber}>{levelNumber}</Text>
          </Animated.View>

          <Animated.View style={rowStyle(0)}>
            <Text style={styles.eyebrow}>LEVEL COMPLETE</Text>
            <Text style={styles.headline}>{kinds.length} games, all finished</Text>
          </Animated.View>

          <View style={styles.tally}>
            {kinds.map((kind, i) => (
              <Animated.View
                key={`${kind}-${i}`}
                style={[
                  styles.tallyRow,
                  {
                    opacity: places[i],
                    transform: [
                      { scale: places[i].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                      { translateX: places[i].interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) },
                    ],
                  },
                ]}
              >
                <GameEmblem kind={kind} size={40} />
                <Text style={[styles.tallyLabel, { color: accentColorForKind(kind) }]}>{gameLabelForKind(kind)}</Text>
              </Animated.View>
            ))}
          </View>

          <Animated.View style={[styles.cardRule, rowStyle(2)]}>
            <GeometricRule variant="quiet" />
          </Animated.View>

          <Animated.Text style={[styles.closing, rowStyle(2)]}>
            That is the whole set. Take a breather - the next one is ready when you are.
          </Animated.Text>

          <Animated.View style={rowStyle(3)}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Continue"
              onPress={onContinue}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={styles.buttonLabel}>Continue ›</Text>
            </PressableScale>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const CREST = 68;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.overlay,
  },
  cardShadow: {
    borderRadius: theme.radii.lg,
    shadowColor: '#3B1F52',
    shadowOpacity: 0.28,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxWidth: 340,
  },
  /** The level's own number, as a struck medal - this card belongs to a
   * level rather than to any one game, so it takes the app's ink and ochre
   * rather than borrowing a single game's accent. */
  crest: {
    width: CREST,
    height: CREST,
    borderRadius: CREST / 2,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  crestNumber: {
    fontFamily: theme.typography.families.display,
    fontSize: 30,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  eyebrow: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 3,
    color: theme.colors.accent,
    textAlign: 'center',
  },
  headline: {
    fontFamily: theme.typography.families.display,
    fontSize: theme.typography.sizes.title,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  tally: {
    alignSelf: 'stretch',
    marginBottom: theme.spacing.md,
  },
  cardRule: {
    alignSelf: 'stretch',
    marginBottom: theme.spacing.md,
  },
  tallyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  tallyLabel: {
    fontFamily: theme.typography.families.mono,
    fontSize: theme.typography.sizes.caption,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1.5,
  },
  closing: {
    fontSize: theme.typography.sizes.body,
    lineHeight: theme.typography.lineHeights.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 270,
    marginBottom: theme.spacing.lg,
  },
  button: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
  },
  pressed: { opacity: 0.85 },
  buttonLabel: {
    color: theme.colors.surfaceHi,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
  },
});
