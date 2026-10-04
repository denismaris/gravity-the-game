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
  /** The general pattern behind this step, so the player can spot it on
   * their own next time ("Two alike side by side? Both ends are the other
   * shape."). Shown under the reason. */
  readonly tip?: string;
}

/** "row 3, column 2" - 1-based, the way a player counts squares. */
export function place(row: number, col: number): string {
  return `row ${row + 1}, column ${col + 1}`;
}

/** Plural helper: "1 tent", "2 tents". */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
