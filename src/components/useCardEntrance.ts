import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { motion } from '../theme';

/** Gap between consecutive rows arriving. Long enough to read as a
 * deliberate cascade, short enough that the last row lands well inside
 * half a second - a celebration the player has to sit through stops being
 * a reward. */
const ROW_STAGGER_MS = 70;
/** The card follows the dimming slightly rather than racing it. */
const CARD_DELAY_MS = 90;
/** Contents wait until the card has somewhere to land. */
const ROWS_DELAY_MS = 200;

/** The emblem lands just after the card itself, ahead of the text rows -
 * it is the hero of this card, so it arrives first and on its own spring
 * rather than queued behind the cascade. */
const HERO_DELAY_MS = 150;
/** The light sweep runs once, after the contents have all landed. */
const SHEEN_DELAY_MS = 460;
const SHEEN_MS = 720;

export interface CardEntranceOptions {
  /** Arrive heavily and without overshoot, and skip the light sweep
   * entirely. For a card reporting a failure rather than a win - the
   * choreography is the same, the physics and the gleam are not. */
  readonly subdued?: boolean;
}

export interface CardEntrance {
  /** Opacity for the dimmed scrim behind the card. */
  backdrop: Animated.Value;
  /** Drives the card's own fade, scale and rise. */
  card: Animated.Value;
  /** Drives the game emblem's own entrance - a bigger, later spring than
   * the card's, so the mark visibly *lands* on an already-present card. */
  hero: Animated.Value;
  /** 0 -> 1 once, after everything has settled. Drives the diagonal light
   * sweep across the card - the small "this is a finished, polished
   * object" cue, and the reason the card needs a clipped inner surface. */
  sheen: Animated.Value;
  /** Fade-and-rise style for the `index`-th staggered row. */
  rowStyle: (index: number) => {
    opacity: Animated.Value;
    transform: [{ translateY: Animated.AnimatedInterpolation<number> }];
  };
}

/**
 * The shared entrance choreography for a "you finished it" card.
 *
 * Three overlapping beats rather than one: the ground dims, the card
 * springs up out of it, then its contents arrive in reading order. Both
 * completion cards previously ran everything off a single timing curve,
 * so the dim backdrop snapped to full opacity in the same instant the card
 * appeared and every line of the card landed together - which is what made
 * the moment feel abrupt instead of celebratory.
 *
 * Lives here rather than in either card so the two stay identical, for the
 * same reason `motion.ts` exists at all: these are the same kind of thing
 * reacting to the same kind of moment, and they drifted apart once before.
 */
export function useCardEntrance(rowCount: number, options: CardEntranceOptions = {}): CardEntrance {
  const backdrop = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  const hero = useRef(new Animated.Value(0)).current;
  const sheen = useRef(new Animated.Value(0)).current;
  const rows = useRef(Array.from({ length: rowCount }, () => new Animated.Value(0))).current;
  // Read once on mount, like the animation it configures - flipping this
  // mid-entrance would mean two different physics in one arrival.
  const subdued = useRef(options.subdued ?? false).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 220,
        easing: motion.cardEnter.easing,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(CARD_DELAY_MS),
        Animated.spring(card, { toValue: 1, useNativeDriver: true, ...(subdued ? motion.spring.settle : motion.spring.pop) }),
      ]),
      Animated.sequence([
        Animated.delay(HERO_DELAY_MS),
        Animated.spring(hero, { toValue: 1, useNativeDriver: true, ...(subdued ? motion.spring.settle : motion.spring.pop) }),
      ]),
      Animated.sequence([
        Animated.delay(ROWS_DELAY_MS),
        Animated.stagger(
          ROW_STAGGER_MS,
          rows.map(value => Animated.spring(value, { toValue: 1, useNativeDriver: true, ...motion.spring.kick })),
        ),
      ]),
      // Omitted outright when subdued rather than delayed out of the way:
      // a card reporting a loss should not gleam at all.
      ...(subdued
        ? []
        : [
            Animated.sequence([
              Animated.delay(SHEEN_DELAY_MS),
              Animated.timing(sheen, {
                toValue: 1,
                duration: SHEEN_MS,
                easing: motion.cardEnter.easing,
                useNativeDriver: true,
              }),
            ]),
          ]),
    ]).start();
    // Mount-only choreography: these cards are mounted exactly when a
    // puzzle is finished, so "on mount" already means "the moment worth
    // celebrating". All three are stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    backdrop,
    card,
    hero,
    sheen,
    rowStyle: (index: number) => {
      const value = rows[index];
      // `rowCount` is hand-maintained against hand-written indices, and
      // getting it wrong produces no error here at all - just an
      // `undefined` that blows up deep inside Animated with "undefined is
      // not an object". That shipped once: a card gained a row, the count
      // was not bumped with it, and the crash only surfaced when a player
      // actually finished a level. Fail here instead, naming both numbers.
      if (!value) {
        throw new Error(
          `useCardEntrance: row ${index} requested but only ${rowCount} were created. ` +
            'Raise the rowCount passed by this card to match the rows it renders.',
        );
      }
      return {
        opacity: value,
        transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      };
    },
  };
}
