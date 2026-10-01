/**
 * What every game's explaining hint returns on top of its move: one plain
 * sentence saying *why*, in that game's own words, and which kind of help
 * it is - a mistake set right, a rule the board makes plain, or (when no
 * single rule settles anything yet) a nudge toward the tightest spot.
 *
 * Hints pick their step from the board as it stands - the mistake that
 * matters, the deduction the player is closest to - never the next cell
 * in reading order.
 */
export type HintKind = 'fix' | 'rule' | 'nudge';

export interface HintReason {
  readonly reason: string;
  readonly kind: HintKind;
}

/** Plural helper: "1 tent", "2 tents". */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
