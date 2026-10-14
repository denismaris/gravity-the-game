import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, parseEndlessId } from '../endlessId';
import { BridgesRules, generateBridges } from './generator';
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

/**
 * Later boards with islands in fog, each dealt after the plain board it
 * follows (by index). Their ids are their own, so no plain board's id
 * ever moves.
 */
const RULED: Record<PuzzleDifficulty, ReadonlyArray<{ id: string; name: string; after: number; rules: BridgesRules }>> = {
  easy: [],
  medium: [
    { id: 'bridges-medium-m01', name: 'Sea Mist', after: 2, rules: { fog: 1 } },
    { id: 'bridges-medium-m02', name: 'Haar', after: 5, rules: { fog: 2 } },
  ],
  hard: [
    { id: 'bridges-hard-m01', name: 'Fog Bank', after: 1, rules: { fog: 2 } },
    { id: 'bridges-hard-m02', name: 'The Hidden Isles', after: 4, rules: { fog: 3 } },
  ],
};

/** No board repeats another, however it is turned or mirrored - a repeat
 * is re-drawn with a salt. `noDuplicatePuzzles` checks independently. */
function poolFor(difficulty: PuzzleDifficulty, shapesSeen: Set<string>): BridgesPuzzle[] {
  const make = (id: string, name: string, rules: BridgesRules = {}): BridgesPuzzle => {
    for (let salt = 0; ; salt += 1) {
      const puzzle = generateBridges(id, name, difficulty, salt, rules);
      const key = bridgesShapeKey(puzzle);
      if (shapesSeen.has(key) && salt < 50) continue;
      shapesSeen.add(key);
      return puzzle;
    }
  };
  // Plain boards first, so their salts never depend on the ruled ones.
  const plain = BOARDS[difficulty].map((name, index) => make(`bridges-${difficulty}-${String(index + 1).padStart(2, '0')}`, name));
  const out: BridgesPuzzle[] = [];
  plain.forEach((puzzle, index) => {
    out.push(puzzle);
    for (const r of RULED[difficulty]) if (r.after === index) out.push(make(r.id, r.name, r.rules));
  });
  return out;
}

/** Builds the pool. Run offline to write `pool.generated.ts`; the pool
 * test checks the two still agree. */
export function buildBridgesPool(): BridgesPuzzle[] {
  const shapesSeen = new Set<string>();
  const easy = poolFor('easy', shapesSeen);
  const medium = poolFor('medium', shapesSeen);
  const hard = poolFor('hard', shapesSeen);
  return [...easy, ...medium, ...hard];
}

/** What an endless board brings, from its id: an island or two in fog,
 * often. */
function endlessRules(id: string, tier: PuzzleDifficulty): BridgesRules {
  /* eslint-disable no-bitwise -- FNV-1a */
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const roll = (h >>> 0) % 100;
  /* eslint-enable no-bitwise */
  if (tier === 'medium' && roll < 40) return { fog: 1 };
  if (tier === 'hard' && roll < 45) return { fog: roll < 15 ? 3 : 2 };
  return {};
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
  const puzzle = generateBridges(id, endlessName(endless.index, 'bridges'), endless.tier, 0, endlessRules(id, endless.tier));
  endlessCache.set(id, puzzle);
  return puzzle;
}

export function getBridgesByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<BridgesPuzzle> {
  return BRIDGES.filter(puzzle => puzzle.difficulty === difficulty);
}
