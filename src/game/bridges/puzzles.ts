import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, parseEndlessId } from '../endlessId';
import { generateBridges } from './generator';
import { bridgesShapeKey } from './logic';
import { BridgesPuzzle } from './types';
import { BAKED_BRIDGES } from './pool.generated';

/**
 * The shipped pool, named for places where water meets land. Ids are
 * positional and frozen: new boards are appended, never inserted.
 */
const BOARDS: Record<PuzzleDifficulty, ReadonlyArray<string>> = {
  easy: ['Stepping Stones', 'Ferry Crossing', 'Low Tide', 'Two Harbours', 'Causeway', 'Rock Pools', 'The Jetty', 'Lighthouse Point'],
  medium: ['Archipelago', 'Harbour Lights', 'Salt Marsh', 'Fishing Village', 'The Estuary', 'Lagoon', 'Trade Winds', 'Coral Reef'],
  hard: ['Venice', 'The Fjords', 'Spice Islands', 'Atoll', 'The Delta', 'Mangroves', 'Canal City', 'Sea of Isles'],
};

/** No board repeats another, however it is turned or mirrored - a repeat
 * is re-drawn with a salt. `noDuplicatePuzzles` checks independently. */
function poolFor(difficulty: PuzzleDifficulty, shapesSeen: Set<string>): BridgesPuzzle[] {
  return BOARDS[difficulty].map((name, index) => {
    const id = `bridges-${difficulty}-${String(index + 1).padStart(2, '0')}`;
    for (let salt = 0; ; salt += 1) {
      const puzzle = generateBridges(id, name, difficulty, salt);
      const key = bridgesShapeKey(puzzle);
      if (shapesSeen.has(key) && salt < 50) continue;
      shapesSeen.add(key);
      return puzzle;
    }
  });
}

/** Builds the pool. Run offline to write `pool.generated.ts`; the pool
 * test checks the two still agree. */
export function buildBridgesPool(): BridgesPuzzle[] {
  const shapesSeen = new Set<string>();
  return [...poolFor('easy', shapesSeen), ...poolFor('medium', shapesSeen), ...poolFor('hard', shapesSeen)];
}

/** The shipped pool, baked, so a cold start does no generation. */
export const BRIDGES: ReadonlyArray<BridgesPuzzle> = BAKED_BRIDGES;

const endlessCache = new Map<string, BridgesPuzzle>();

export function getBridgesById(id: string): BridgesPuzzle | undefined {
  const found = BRIDGES.find(puzzle => puzzle.id === id);
  if (found) return found;
  const endless = parseEndlessId(id);
  if (!endless || endless.kind !== 'bridges') return undefined;
  const cached = endlessCache.get(id);
  if (cached) return cached;
  const puzzle = generateBridges(id, endlessName(endless.index, 'bridges'), endless.tier);
  endlessCache.set(id, puzzle);
  return puzzle;
}

export function getBridgesByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<BridgesPuzzle> {
  return BRIDGES.filter(puzzle => puzzle.difficulty === difficulty);
}
