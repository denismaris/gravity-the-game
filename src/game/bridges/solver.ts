import { bridgeLinks, isBridgesSolved, linksByIsland, setBridges } from './logic';
import { BridgesPuzzle, BridgesState } from './types';

/**
 * What is known about every link: at least `lo` and at most `hi` bridges.
 * A link is decided once the two meet.
 */
export interface BridgeBounds {
  readonly lo: ReadonlyArray<number>;
  readonly hi: ReadonlyArray<number>;
}

export interface Deduction extends BridgeBounds {
  /** The rules ran into a contradiction - no answer from here. */
  readonly broken: boolean;
  /** Every link decided. */
  readonly complete: boolean;
}

/**
 * The reasoning a player does, as rules that only ever narrow the bounds -
 * never a guess. Two families:
 *
 * - **Counting** (always): an island's number less what its other lanes
 *   can carry at most is a floor on this lane; less what they carry at
 *   least, a ceiling. A lane with a bridge on it closes every lane it
 *   crosses.
 * - **Connection** (`connected`): the archipelago must end up as one. A
 *   lane is forced if dropping it would cut the islands in two, and a lane
 *   cannot be filled if that would seal off a finished group - the rule
 *   that says two 1s never join each other.
 *
 * Easy boards fall to counting alone; hard ones need connection too. That
 * split is what the generator grades difficulty by.
 */
export function deduceBridges(puzzle: BridgesPuzzle, connected = true, start?: BridgeBounds): Deduction {
  const links = bridgeLinks(puzzle);
  const byIsland = linksByIsland(puzzle);
  const islands = puzzle.islands;
  const lo = start ? start.lo.slice() : links.map(() => 0);
  const hi = start ? start.hi.slice() : links.map(link => Math.min(2, islands[link.a].need, islands[link.b].need));
  const fail = (): Deduction => ({ lo, hi, broken: true, complete: false });

  // Union-find over the islands, joined along `use` links.
  const groupsOf = (include: (l: number) => boolean): number[] => {
    const parent = islands.map((_island, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (const link of links) if (include(link.index)) parent[find(link.a)] = find(link.b);
    return islands.map((_island, i) => find(i));
  };
  const oneGroup = (include: (l: number) => boolean): boolean => {
    const roots = groupsOf(include);
    return roots.every(r => r === roots[0]);
  };
  /** Whether bounds `lo` seal off a finished group short of everything. */
  const sealsOff = (floor: ReadonlyArray<number>): boolean => {
    const roots = groupsOf(l => floor[l] > 0);
    const full = new Map<number, boolean>();
    const size = new Map<number, number>();
    islands.forEach((island, i) => {
      const sum = byIsland[i].reduce((s, l) => s + floor[l], 0);
      full.set(roots[i], (full.get(roots[i]) ?? true) && sum === island.need);
      size.set(roots[i], (size.get(roots[i]) ?? 0) + 1);
    });
    for (const [root, isFull] of full) if (isFull && (size.get(root) ?? 0) < islands.length) return true;
    return false;
  };

  for (let guard = 0; guard < 400; guard += 1) {
    let changed = false;
    const narrow = (l: number, nextLo: number, nextHi: number): boolean => {
      if (nextLo > lo[l]) {
        lo[l] = nextLo;
        changed = true;
      }
      if (nextHi < hi[l]) {
        hi[l] = nextHi;
        changed = true;
      }
      return lo[l] <= hi[l];
    };

    // Counting.
    for (let i = 0; i < islands.length; i += 1) {
      const lanes = byIsland[i];
      const sumLo = lanes.reduce((s, l) => s + lo[l], 0);
      const sumHi = lanes.reduce((s, l) => s + hi[l], 0);
      const need = islands[i].need;
      if (sumLo > need || sumHi < need) return fail();
      for (const l of lanes) {
        if (!narrow(l, need - (sumHi - hi[l]), need - (sumLo - lo[l]))) return fail();
      }
    }
    for (const link of links) {
      if (lo[link.index] === 0) continue;
      for (const j of link.crosses) {
        if (!narrow(j, lo[j], 0)) return fail();
      }
    }

    if (connected && islands.length > 1) {
      if (!oneGroup(l => hi[l] > 0)) return fail();
      if (sealsOff(lo)) return fail();
      for (const link of links) {
        const l = link.index;
        if (lo[l] === hi[l]) continue;
        // Forced: without this lane the islands fall apart.
        if (lo[l] === 0 && !oneGroup(j => j !== l && hi[j] > 0)) {
          if (!narrow(l, 1, hi[l])) return fail();
        }
        // Capped: filling it all the way would seal a finished group.
        const trial = lo.slice();
        trial[l] = hi[l];
        if (sealsOff(trial)) {
          if (!narrow(l, lo[l], hi[l] - 1)) return fail();
        }
      }
    }

    if (!changed) break;
  }

  const complete = lo.every((v, l) => v === hi[l]);
  return { lo, hi, broken: false, complete };
}

/** Whether a player can reason the board out from nothing, with or
 * without the connection rules. */
export function isSolvableByLogic(puzzle: BridgesPuzzle, connected = true): boolean {
  const result = deduceBridges(puzzle, connected);
  return !result.broken && result.complete && isBridgesSolved(puzzle, { bridges: result.lo });
}

/**
 * Counts answers, up to `limit`, by deduction plus branching - exhaustive,
 * so a count of one is a proof the board is fair, independent of whether
 * the rules above could find it unaided.
 */
export function countBridgesSolutions(puzzle: BridgesPuzzle, limit = 2): number {
  let found = 0;
  const search = (start?: BridgeBounds): void => {
    if (found >= limit) return;
    const result = deduceBridges(puzzle, true, start);
    if (result.broken) return;
    if (result.complete) {
      if (isBridgesSolved(puzzle, { bridges: result.lo })) found += 1;
      return;
    }
    let pick = -1;
    for (let l = 0; l < result.lo.length; l += 1) {
      if (result.lo[l] === result.hi[l]) continue;
      if (pick === -1 || result.hi[l] - result.lo[l] < result.hi[pick] - result.lo[pick]) pick = l;
    }
    for (let v = result.lo[pick]; v <= result.hi[pick] && found < limit; v += 1) {
      const lo = result.lo.slice();
      const hi = result.hi.slice();
      lo[pick] = v;
      hi[pick] = v;
      search({ lo, hi });
    }
  };
  search();
  return found;
}

/**
 * One step toward the answer: first take away a bridge that should not be
 * there, then lay one that should - the lane that is already most certain,
 * so a hint teaches the same step a player would take next.
 */
export function revealBridgesHint(puzzle: BridgesPuzzle, state: BridgesState): { state: BridgesState; link: number } | null {
  const wrong = state.bridges.findIndex((n, l) => n > puzzle.solution[l]);
  if (wrong !== -1) return { state: setBridges(state, wrong, puzzle.solution[wrong]), link: wrong };
  const missing = state.bridges.map((n, l) => ({ l, gap: puzzle.solution[l] - n })).filter(({ gap }) => gap > 0);
  if (missing.length === 0) return null;
  // Prefer lanes the counting rules alone already pin down.
  const known = deduceBridges(puzzle, false);
  const certain = missing.find(({ l }) => !known.broken && known.lo[l] > state.bridges[l]);
  const { l } = certain ?? missing[0];
  return { state: setBridges(state, l, puzzle.solution[l]), link: l };
}

/** Everything the pool test holds every shipped board to. */
export function assertValidBridges(puzzle: BridgesPuzzle): void {
  const seen = new Set<string>();
  for (const island of puzzle.islands) {
    const key = `${island.row}:${island.col}`;
    if (seen.has(key)) throw new Error(`${puzzle.id}: two islands at ${key}`);
    seen.add(key);
    if (island.row < 0 || island.col < 0 || island.row >= puzzle.rows || island.col >= puzzle.cols) throw new Error(`${puzzle.id}: island off the board at ${key}`);
    if (island.need < 1 || island.need > 8) throw new Error(`${puzzle.id}: island ${key} needs ${island.need}`);
  }
  const links = bridgeLinks(puzzle);
  if (puzzle.solution.length !== links.length) throw new Error(`${puzzle.id}: solution has ${puzzle.solution.length} lanes, board has ${links.length}`);
  if (!isBridgesSolved(puzzle, { bridges: puzzle.solution })) throw new Error(`${puzzle.id}: stored solution does not solve the board`);
  for (const link of links) {
    if (puzzle.solution[link.index] > 0 && link.crosses.some(j => puzzle.solution[j] > 0)) throw new Error(`${puzzle.id}: solution crosses itself`);
  }
  if (countBridgesSolutions(puzzle, 2) !== 1) throw new Error(`${puzzle.id}: not exactly one answer`);
  if (!isSolvableByLogic(puzzle)) throw new Error(`${puzzle.id}: cannot be reasoned out without guessing`);
}
