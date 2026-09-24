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
 * Deliberately game-agnostic: the card already says which game it was, and
 * per-game copy would multiply this pool by five for no extra warmth.
 */

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
): string {
  const pool = POOLS[tier];
  const choices = pool.length > 1 ? pool.filter(line => line !== previous) : pool;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}
