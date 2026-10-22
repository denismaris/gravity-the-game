/**
 * The line of praise a completion card shows, and the one thing on that
 * card that is different every time.
 *
 * A finish screen that says the same sentence on the tenth solve as on the
 * first stops being praise and becomes furniture - the player reads it
 * once and never again. These rotate, never repeat back to back, and are
 * graded by how the solve actually went, so the best lines are reserved
 * for the best runs and never spent on a scraped one.
 *
 * The voice is the almanac's: dry, observational, understated - a note
 * from whoever set the puzzle rather than a scoreboard congratulating
 * you. An earlier pool leaned on bare superlatives used as whole
 * sentences ("Flawless." "Textbook." "Confident work.") and on the
 * dash-that-explains-itself ("You stuck with it - that is the hard
 * part."). Both read as generated filler: praise that could be pasted
 * under any result in any app. Lines here say something about the run
 * instead of grading it.
 *
 * Each game also has a few lines of its own, saying what was actually
 * done on that board ("The frog made it home") - half the time one of
 * those is shown instead. Graded lines alone, the same twelve sentences
 * under every game, read as praise that could sit under anything.
 */

import type { GameKind } from './gameKind';

/** How well the solve went. Never "bad" - a finished puzzle is a finished
 * puzzle, and the weakest tier is still encouraging, just honest about
 * there being room left. */
export type EncouragementTier = 'flawless' | 'strong' | 'solid';

/** A perfect star rating with no hints taken - the run nothing can beat. */
const FLAWLESS: ReadonlyArray<string> = [
  'Straight through. No wrong turns.',
  'Not one wasted move.',
  'You never looked stuck.',
  'Nothing to fault there.',
  'Start to finish, no help.',
  'That went quickly.',
];

/** Either full stars or a hint-free run, but not both. */
const STRONG: ReadonlyArray<string> = [
  'That one had a knot in it.',
  'You found the way through.',
  'Tidier than it looked.',
  'That board gave little away.',
  'A good line through that.',
  'Worth the time it took.',
];

/** Solved, with help or with room to spare. Warm, never a consolation
 * prize - the point is that finishing is the achievement. */
const SOLID: ReadonlyArray<string> = [
  'You saw it out.',
  'Stubborn board. You outlasted it.',
  'It came good in the end.',
  'That one made you work.',
  'Not the short way round, but you got there.',
  'Another one behind you.',
];

/** What was done, game by game - plain statements of the finished board,
 * true however the solve went. */
const GAME_LINES: Record<GameKind, ReadonlyArray<string>> = {
  gravity: ['Every piece where it belongs.', 'Rolled home.', 'Gravity did the rest.'],
  mirror: ['The light found every gem.', 'Lit from end to end.', 'Every mirror earned its place.'],
  lilypads: ['The frog made it home.', 'Every pad, once.', 'Not a pad left behind.'],
  vanes: ['Every vane points true.', 'The whole roof agrees.', 'The wind has settled.'],
  binairo: ['Every row in balance.', 'Not a three in sight.', 'Each line its own.'],
  arukone: ['Every pair joined.', 'Every square covered.', 'Not one thread crossed.'],
  glass: ['Every pane in its place.', 'The window is whole.', 'Light through every pane.'],
  lightsout: ['Every lantern out.', 'Dark, all the way across.', 'Not one left burning.'],
  adjacent: ['The score came in.', 'Every group counted.', 'The tray gave way.'],
  bloom: ['Every line joined.', 'In full bloom.', 'No loose ends.'],
  mosaic: ['Every piece set.', 'The picture is whole.', 'Nothing left in the tray.'],
  bridges: ['Every island reached.', 'Every number met.', 'The bridges hold.'],
};

/** A game's own lines - exported for the tests. */
export function gameLinesFor(kind: GameKind): ReadonlyArray<string> {
  return GAME_LINES[kind];
}

const POOLS: Record<EncouragementTier, ReadonlyArray<string>> = {
  flawless: FLAWLESS,
  strong: STRONG,
  solid: SOLID,
};

/**
 * Grades a solve. `stars` is the rating this run earned and `hintsUsed`
 * how much help it took - both are needed, since three stars bought with
 * hints is a different run from three stars earned cold.
 */
export function encouragementTier(stars: number, hintsUsed: number): EncouragementTier {
  if (stars >= 3 && hintsUsed === 0) return 'flawless';
  if (stars >= 3 || hintsUsed === 0) return 'strong';
  return 'solid';
}

/** Every line a given tier can show - exported so a test can assert the
 * pools are non-empty and free of duplicates. */
export function encouragementsFor(tier: EncouragementTier): ReadonlyArray<string> {
  return POOLS[tier];
}

/**
 * One line for this solve. `previous` is whatever was shown last time;
 * it is never returned again while the tier has anything else to say, so
 * two solves in a row can't land on the same sentence.
 *
 * `random` is injectable purely so tests can pin the choice - callers pass
 * nothing and get `Math.random`.
 */
export function pickEncouragement(
  tier: EncouragementTier,
  previous?: string,
  random: () => number = Math.random,
  kind?: GameKind,
): string {
  // Half the time, a line about this game's own board.
  const pool = kind && random() < 0.5 ? GAME_LINES[kind] : POOLS[tier];
  const choices = pool.length > 1 ? pool.filter(line => line !== previous) : pool;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}
