import { createContext } from 'react';
import { GameKind } from '../../game/journey';

/** How a game is played with a finger - what the guide card's little cue
 * acts out while the player tries a step. */
export type LessonGesture = 'tap' | 'swipe' | 'drag';

export interface LessonGuide {
  readonly kind: GameKind;
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
    goal: 'Tilt the board until every piece rests on a ring.',
    gesture: 'swipe',
    recap: [
      'Swipe, and every piece slides that way at once.',
      'A piece only stops at a wall, another piece or the edge.',
      'Put a piece on every ring. Fewer moves earn more stars.',
    ],
  },
  lightsout: {
    kind: 'lightsout',
    goal: 'Put out every lantern on the board.',
    gesture: 'tap',
    recap: [
      'A tap switches a lantern and the ones directly beside it.',
      'Put out every lantern to solve the board.',
      'Tapping the same lantern twice undoes it, so no tap is ever wasted.',
    ],
  },
  adjacent: {
    kind: 'adjacent',
    goal: 'Clear runs of matching tiles until you reach the target score.',
    gesture: 'tap',
    recap: [
      'Tap two or more touching tiles of one colour to clear them.',
      'Tiles above fall into the gap and can join into bigger runs.',
      'Bigger runs score far more. Reach the target score to solve.',
    ],
  },
  binairo: {
    kind: 'binairo',
    goal: 'Fill the grid with squares and circles, following three simple rules.',
    gesture: 'tap',
    recap: [
      'Fill every square with a square or a circle.',
      'Never three of the same in a row, across or down.',
      'Every row and column holds as many of each, and no two are alike.',
    ],
  },
  tents: {
    kind: 'tents',
    goal: 'Pitch one tent beside every tree.',
    gesture: 'tap',
    recap: [
      'Every tree has its own tent right beside it, never diagonally.',
      'Tents never touch, not even at the corners.',
      'The edge numbers count the tents in each row and column.',
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
      'Tap the water between two islands for a bridge, again for a double.',
      'Each number says how many bridges its island needs.',
      'Bridges never cross, and every island joins up into one group.',
    ],
  },
  mirror: {
    kind: 'mirror',
    goal: 'Place mirrors that guide the light to its target.',
    gesture: 'tap',
    recap: [
      'Light runs straight until a mirror turns it.',
      'Tap a square for a mirror, and again to flip it.',
      'Guide the beam through every gem to its target.',
    ],
  },
  bloom: {
    kind: 'bloom',
    goal: 'Turn the tiles until every line joins into closed loops.',
    gesture: 'tap',
    recap: [
      'Tap a tile to turn it a quarter.',
      'Pinned tiles never turn, so start from them.',
      'Every line has to meet another until the loops close.',
    ],
  },
  fillapix: {
    kind: 'fillapix',
    goal: 'Use the number clues to fill in a hidden picture.',
    gesture: 'tap',
    recap: [
      'Each number counts the filled squares around it, its own included.',
      'A 0 keeps its whole block empty, and a full count fills it.',
      'What one number proves helps you read the next.',
    ],
  },
  towers: {
    kind: 'towers',
    goal: 'Place towers so each clue sees the right number of them.',
    gesture: 'tap',
    recap: [
      'Each row and column holds every height once.',
      'A clue counts the towers seen from its side. Tall ones hide short ones.',
      'Start from the 1s and the highest clues: they tell you the most.',
    ],
  },
  arukone: {
    kind: 'arukone',
    goal: 'Join every pair of numbers and fill the whole board.',
    gesture: 'drag',
    recap: [
      'Drag to join each pair of matching numbers.',
      'Whatever you draw is mirrored across the fold for you.',
      'Paths never cross, and together they fill every square.',
    ],
  },
};

/** The verb on the lesson's opening card: "You play by tapping". */
export const GESTURE_VERB: Record<LessonGesture, string> = { tap: 'tapping', swipe: 'swiping', drag: 'dragging' };

/** The guide for the lesson on screen, provided by `GameLesson`. */
export const LessonGuideContext = createContext<LessonGuide | null>(null);
