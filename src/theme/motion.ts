import { Easing } from 'react-native';

/**
 * Shared animation "physics" for the whole app - one place so every card,
 * button and star row moves with the same weight instead of each component
 * hand-rolling its own numbers (which is how `PuzzleSolved` ended up with a
 * bouncier, longer entrance than `LevelCompleteCard`/`LevelFailedCard` even
 * though all three are the same kind of thing - a card reacting to the same
 * moment). Springs use the stiffness/damping/mass form rather than the
 * speed/bounciness shorthand: the same `damping` reads the same way
 * regardless of `stiffness`, which speed/bounciness does not guarantee.
 */
export const motion = {
  spring: {
    /** A button dipping under a press and springing back - stiff and quick,
     * controlled rather than playful. Used by `PressableScale`. */
    press: { stiffness: 500, damping: 30, mass: 1 },
    /** A small glyph (a star) popping into place - the one spot a little
     * overshoot is welcome, since it is a reward rather than UI chrome. */
    pop: { stiffness: 420, damping: 15, mass: 0.9 },
  },
  /** A card/overlay reacting to a moment (solved, failed, a tutorial) -
   * fade + scale up from `scaleFrom`. The same curve everywhere so those
   * cards read as one considered thing, not several built at different
   * times. */
  cardEnter: {
    duration: 220,
    scaleFrom: 0.9,
    easing: Easing.out(Easing.cubic),
  },
  /** A whole screen fading/rising into view on navigation. */
  screenEnter: {
    duration: 280,
    easing: Easing.out(Easing.cubic),
  },
} as const;
