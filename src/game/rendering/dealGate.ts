/**
 * Holds a board's deal (see `DealIn`) while something covers the board -
 * the hand-off veil - so the pieces are dealt in view, not under the veil.
 * Without it the deal ran out of sight while the veil was still lifting.
 */
let holding = false;
const waiting = new Set<() => void>();

export function holdDeals(): void {
  holding = true;
}

export function releaseDeals(): void {
  holding = false;
  const now = [...waiting];
  waiting.clear();
  now.forEach(run => run());
}

/** Runs `start` now, or once the deal is released; returns a cancel. */
export function whenDealsReleased(start: () => void): () => void {
  if (!holding) {
    start();
    return () => {};
  }
  waiting.add(start);
  return () => {
    waiting.delete(start);
  };
}
