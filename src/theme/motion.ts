/**
 * The app's curves. Every eased moment uses one of these, so a card, a
 * tile and a coin arriving all move with the same hand. Plain worklet
 * functions: the same curve drives Animated, Reanimated and the boards'
 * own clocks, on either thread.
 */
export const curve = {
  /** Something arriving and settling: fast in, gentle at rest. */
  arrive(t: number): number {
    'worklet';
    return 1 - (1 - t) ** 3;
  },
  /** Something leaving: slow to go, quick once it is going. */
  leave(t: number): number {
    'worklet';
    return t * t * t;
  },
  /** Something moving from one place to another on the board. */
  glide(t: number): number {
    'worklet';
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  },
  /** A reward landing: one small overshoot, then home. Rare moments only. */
  reward(t: number): number {
    'worklet';
    const u = t - 1;
    return 1 + 2.5 * u * u * u + 1.5 * u * u;
  },
  /** An ambient loop breathing in and out. */
  breathe(t: number): number {
    'worklet';
    return (1 - Math.cos(Math.PI * t)) / 2;
  },
  linear(t: number): number {
    'worklet';
    return t;
  },
};


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
    /** A routine, high-frequency state tick - a "N left" kicker
     * decrementing on every correct placement, dozens of times a puzzle.
     * Quick and controlled, no real overshoot (damping ratio ~0.9): this
     * fires far too often to earn `pop`'s reward-tier bounce. */
    kick: { stiffness: 500, damping: 40, mass: 1 },
    /** A small glyph (a star, a one-time "SOLVED" badge) popping into
     * place - the one spot a little overshoot is welcome, since it is a
     * reward rather than UI chrome. Reserved for genuinely rare, once-per-
     * puzzle moments - see `kick` above for anything that repeats. */
    pop: { stiffness: 420, damping: 15, mass: 0.9 },
    /** A card arriving with weight and *no* overshoot - slightly
     * overdamped (critical damping at this stiffness is ~32). For a
     * moment that isn't a reward: a loss shouldn't bounce into view the
     * way a three-star finish does. Same plumbing, different physics. */
    settle: { stiffness: 260, damping: 34, mass: 1 },
  },
  /** A card/overlay reacting to a moment (solved, failed, a tutorial) -
   * fade + scale up from `scaleFrom`. The same curve everywhere so those
   * cards read as one considered thing, not several built at different
   * times. */
  cardEnter: {
    duration: 220,
    scaleFrom: 0.9,
    easing: curve.arrive,
  },
  /** A whole screen fading/rising into view on navigation. */
  screenEnter: {
    duration: 280,
    easing: curve.arrive,
  },
  /**
   * The app's pace, in one place: every beat that decides how long the
   * player waits for something. Each was a constant in its own file, and
   * they had drifted - one card waiting out another for longer than that
   * one took to leave, presses held for four different times.
   */
  beat: {
    /** A board's finish plays this long before its card comes in. */
    solveCelebration: 1600,
    /** A card takes this long to leave. */
    cardExit: 240,
    /** A press that leaves the screen waits this long, so the key is seen
     * going down: a key in a dialog, a key in a card. */
    pressHold: 110,
    cardPressHold: 150,
    /** The board deals in this long after its screen opens, once the
     * stage has risen. */
    dealBase: 320,
    /** Work done in the background waits this long after Home opens, and
     * this long after a set rolls over mid-game. */
    prepareOnHome: 700,
    prepareInGame: 2600,
  },
} as const;
