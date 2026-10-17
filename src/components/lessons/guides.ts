import { createContext, ReactNode } from 'react';
import { GameKind } from '../../game/journey';

/** How a game is played with a finger - what the guide card's little cue
 * acts out while the player tries a step. */
export type LessonGesture = 'tap' | 'swipe' | 'drag';

export interface LessonGuide {
  /** The game, for its emblem; absent for a game being tried out. */
  readonly kind?: GameKind;
  /** The intro card's picture, for a game with no emblem of its own yet
   * (one being tried out); otherwise the game's emblem. */
  readonly emblem?: ReactNode;
  /** What wins the game, in one sentence: the first thing a lesson says. */
  readonly goal: string;
  readonly gesture: LessonGesture;
  /** The rules in short, shown once the lesson is done: what to keep in
   * mind on the first real board. */
  readonly recap: ReadonlyArray<string>;
}

export const LESSON_GUIDES: Record<GameKind, LessonGuide> = {
  gravity: {
    kind: 'gravity',
    goal: 'Roll every ball onto a ring.',
    gesture: 'swipe',
    recap: [
      'Swipe, and every ball rolls that way at once.',
      'A ball only stops at a wall, another ball or the edge.',
      'Get a ball onto every ring, in as few moves as you can.',
    ],
  },
  lightsout: {
    kind: 'lightsout',
    goal: 'Turn off every lantern.',
    gesture: 'tap',
    recap: [
      'A tap switches a lantern and the ones right next to it.',
      'Turn off every lantern to win.',
      'Tapping the same lantern twice puts it back.',
    ],
  },
  adjacent: {
    kind: 'adjacent',
    goal: 'Clear groups of matching tiles until you reach the target score.',
    gesture: 'tap',
    recap: [
      'Tap two or more touching tiles of one colour to clear them.',
      'Tiles above fall down and can make bigger groups.',
      'Bigger groups score more. Reach the target score to win.',
    ],
  },
  binairo: {
    kind: 'binairo',
    goal: 'Fill the board with squares and circles, following three simple rules.',
    gesture: 'tap',
    recap: [
      'Fill every square with a square or a circle.',
      'Never three the same in a row, across or down.',
      'Every row and column has the same number of circles and squares.',
    ],
  },
  lilypads: {
    kind: 'lilypads',
    goal: 'Jump the frog to every pad. Each pad sinks when the frog leaves it.',
    gesture: 'tap',
    recap: [
      'Tap a pad in a straight line from the frog, or swipe toward it.',
      'The frog jumps to the nearest pad that way.',
      'A pad with a red ring can no longer be reached.',
    ],
  },
  mosaic: {
    kind: 'mosaic',
    goal: 'Fit every piece into the picture, with no gaps.',
    gesture: 'drag',
    recap: [
      'Drag pieces from the tray into the picture.',
      'Tap a piece in the tray to turn it.',
      'Fill every square to finish the mosaic.',
    ],
  },
  bridges: {
    kind: 'bridges',
    goal: 'Join all the islands with the right number of bridges.',
    gesture: 'tap',
    recap: [
      'Tap the water between two islands for a bridge. Tap again for a double.',
      'The number says how many bridges an island needs.',
      'Bridges cannot cross, and all the islands must be joined.',
    ],
  },
  mirror: {
    kind: 'mirror',
    goal: 'Place mirrors to bend the light into the gold ring.',
    gesture: 'tap',
    recap: [
      'Light goes straight until a mirror turns it.',
      'Tap a square for a mirror. Tap again to tilt it the other way.',
      'Send the light through every gem and into the gold ring.',
    ],
  },
  bloom: {
    kind: 'bloom',
    goal: 'Turn the tiles until every line joins up into loops.',
    gesture: 'tap',
    recap: [
      'Tap a tile to turn it.',
      'Tiles with a gold dot never turn, so start next to them.',
      'Every line must join another line. No loose ends.',
    ],
  },
  glass: {
    kind: 'glass',
    goal: 'Colour every piece of glass so no two touching pieces match.',
    gesture: 'tap',
    recap: [
      'Pick a colour below, then tap or drag over the glass.',
      'Pieces that touch along a side must be different. Corners do not count.',
      'Start with a piece that already touches two colours.',
    ],
  },
  vanes: {
    kind: 'vanes',
    goal: 'Turn the vanes so the wind goes round and round in loops.',
    gesture: 'tap',
    recap: [
      'A tap turns a vane. It points at the nearest vane that way.',
      'Every vane points at another vane, and gets wind from just one.',
      'No wind off the roof or into a chimney. Two vanes cannot point at each other.',
    ],
  },
  arukone: {
    kind: 'arukone',
    goal: 'Join every pair of numbers and fill the whole board.',
    gesture: 'drag',
    recap: [
      'Drag to join each pair of matching numbers.',
      'The board is a mirror: what you draw on one side is copied to the other.',
      'Paths cannot cross, and they must fill every square.',
    ],
  },
};

/** The guide for the lesson on screen, provided by `GameLesson`. */
export const LessonGuideContext = createContext<LessonGuide | null>(null);
