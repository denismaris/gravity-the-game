import { BridgeLink, BridgesIsland, BridgesPuzzle, BridgesState } from './types';

const linkCache = new WeakMap<BridgesPuzzle, ReadonlyArray<BridgeLink>>();

/**
 * Every place a bridge could go: each island joined to the nearest island
 * straight to its right and straight below it, and which of those lanes
 * cross each other. Derived from the islands alone (cached per puzzle), so
 * a puzzle never has to store its own lanes.
 */
export function bridgeLinks(puzzle: Pick<BridgesPuzzle, 'rows' | 'cols' | 'islands'>): ReadonlyArray<BridgeLink> {
  const cached = linkCache.get(puzzle as BridgesPuzzle);
  if (cached) return cached;

  const at = new Map<string, number>();
  puzzle.islands.forEach((island, i) => at.set(`${island.row}:${island.col}`, i));
  const raw: Array<{ a: number; b: number; horizontal: boolean }> = [];
  puzzle.islands.forEach((island, a) => {
    for (let col = island.col + 1; col < puzzle.cols; col += 1) {
      const b = at.get(`${island.row}:${col}`);
      if (b !== undefined) {
        raw.push({ a, b, horizontal: true });
        break;
      }
    }
    for (let row = island.row + 1; row < puzzle.rows; row += 1) {
      const b = at.get(`${row}:${island.col}`);
      if (b !== undefined) {
        raw.push({ a, b, horizontal: false });
        break;
      }
    }
  });

  const islands = puzzle.islands;
  const cross = (h: { a: number; b: number }, v: { a: number; b: number }): boolean => {
    const row = islands[h.a].row;
    const col = islands[v.a].col;
    return islands[h.a].col < col && col < islands[h.b].col && islands[v.a].row < row && row < islands[v.b].row;
  };
  const links = raw.map((link, index) => ({
    index,
    ...link,
    crosses: raw
      .map((other, j) => ({ other, j }))
      .filter(({ other }) => other.horizontal !== link.horizontal && (link.horizontal ? cross(link, other) : cross(other, link)))
      .map(({ j }) => j),
  }));
  linkCache.set(puzzle as BridgesPuzzle, links);
  return links;
}

/** The links touching each island, by island index. */
export function linksByIsland(puzzle: BridgesPuzzle): ReadonlyArray<ReadonlyArray<number>> {
  const byIsland: number[][] = puzzle.islands.map(() => []);
  for (const link of bridgeLinks(puzzle)) {
    byIsland[link.a].push(link.index);
    byIsland[link.b].push(link.index);
  }
  return byIsland;
}

export function emptyBridgesState(puzzle: BridgesPuzzle): BridgesState {
  return { bridges: bridgeLinks(puzzle).map(() => 0) };
}

/** Whether a bridge may be laid on `linkIndex` right now - nothing built
 * across its path. */
export function canBuild(puzzle: BridgesPuzzle, state: BridgesState, linkIndex: number): boolean {
  return bridgeLinks(puzzle)[linkIndex].crosses.every(j => state.bridges[j] === 0);
}

/** The link that would be blocking `linkIndex`, if any. */
export function blockingLink(puzzle: BridgesPuzzle, state: BridgesState, linkIndex: number): number | null {
  return bridgeLinks(puzzle)[linkIndex].crosses.find(j => state.bridges[j] > 0) ?? null;
}

export function setBridges(state: BridgesState, linkIndex: number, count: number): BridgesState {
  if (state.bridges[linkIndex] === count) return state;
  const bridges = state.bridges.slice();
  bridges[linkIndex] = count;
  return { bridges };
}

/**
 * The one move: another bridge on a link - none, one, two, then back to
 * none. Laying the first bridge across another one is refused (the same
 * state comes back); taking bridges away never is.
 */
export function cycleBridge(puzzle: BridgesPuzzle, state: BridgesState, linkIndex: number): BridgesState {
  const current = state.bridges[linkIndex];
  if (current === 0 && !canBuild(puzzle, state, linkIndex)) return state;
  return setBridges(state, linkIndex, (current + 1) % 3);
}

/** Bridges ending at each island. */
export function islandLoads(puzzle: BridgesPuzzle, state: BridgesState): number[] {
  const loads = puzzle.islands.map(() => 0);
  for (const link of bridgeLinks(puzzle)) {
    loads[link.a] += state.bridges[link.index];
    loads[link.b] += state.bridges[link.index];
  }
  return loads;
}

/** Islands grouped by the bridges between them (unbridged islands stand
 * alone). */
export function components(puzzle: BridgesPuzzle, state: BridgesState): number[][] {
  const parent = puzzle.islands.map((_island, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const link of bridgeLinks(puzzle)) {
    if (state.bridges[link.index] > 0) parent[find(link.a)] = find(link.b);
  }
  const groups = new Map<number, number[]>();
  puzzle.islands.forEach((_island, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), i]);
  });
  return Array.from(groups.values());
}

export function isBridgesSolved(puzzle: BridgesPuzzle, state: BridgesState): boolean {
  const loads = islandLoads(puzzle, state);
  if (puzzle.islands.some((island, i) => loads[i] !== island.need)) return false;
  return components(puzzle, state).length === 1;
}

/** Bridges still to lay: half the total of every number, less what is
 * down. Can go negative on an over-built board. */
export function bridgesLeft(puzzle: BridgesPuzzle, state: BridgesState): number {
  const total = puzzle.islands.reduce((sum, island) => sum + island.need, 0) / 2;
  return total - state.bridges.reduce((sum, n) => sum + n, 0);
}

/** The link between two islands, or null if they cannot see each other. */
export function linkBetween(puzzle: BridgesPuzzle, i: number, j: number): number | null {
  const [a, b] = i < j ? [i, j] : [j, i];
  return bridgeLinks(puzzle).find(link => link.a === a && link.b === b)?.index ?? null;
}

/** The link leaving island `i` in a direction, if there is one. */
export function linkFrom(puzzle: BridgesPuzzle, i: number, dc: number, dr: number): number | null {
  const island = puzzle.islands[i];
  for (const link of bridgeLinks(puzzle)) {
    if (link.a !== i && link.b !== i) continue;
    const other: BridgesIsland = puzzle.islands[link.a === i ? link.b : link.a];
    const sx = Math.sign(other.col - island.col);
    const sy = Math.sign(other.row - island.row);
    if (sx === dc && sy === dr) return link.index;
  }
  return null;
}

/** A shape key the same for every rotation and mirror of a board - so the
 * pool never deals the same archipelago twice, turned. */
export function bridgesShapeKey(puzzle: BridgesPuzzle): string {
  const keys: string[] = [];
  for (let t = 0; t < 8; t += 1) {
    const cells = puzzle.islands.map(({ row, col, need }) => {
      let r = row;
      let c = col;
      let rows = puzzle.rows;
      let cols = puzzle.cols;
      for (let k = 0; k < t % 4; k += 1) {
        [r, c] = [c, rows - 1 - r];
        [rows, cols] = [cols, rows];
      }
      if (t >= 4) c = cols - 1 - c;
      return `${r}.${c}.${need}`;
    });
    keys.push(cells.sort().join('|'));
  }
  return keys.sort()[0];
}
