import { PuzzleDifficulty } from '../puzzleDifficulty';
import { litCount, press } from './logic';
import { parFor } from './solver';
import { LightsOutPuzzle, LightsOutState } from './types';

/**
 * Generation runs the puzzle backwards: start from the finished board
 * (every light off) and press a random set of cells. Because a press is
 * its own inverse, pressing that exact same set again turns everything
 * off - so the board handed to the player is solvable by construction,
 * and the generating set is *a* solution. Not necessarily the shortest
 * one, though, which is why every candidate is put back through the real
 * solver to find its true par before it is accepted (see `types.ts`).
 *
 * Deterministic from the puzzle's own id, like every other seeded game
 * here: `lightsout-easy-01` is the same board on every device and every
 * launch, which matters because `PlayerProgress.levels` stores a best
 * result per id.
 */

/* eslint-disable no-bitwise -- mulberry32 and FNV-1a are bitwise by definition */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* eslint-enable no-bitwise */

export interface LightsOutShape {
  readonly size: number;
  /** The par band this tier's boards must fall inside - the fewest
   * presses that can clear them. */
  readonly minPar: number;
  readonly maxPar: number;
}

/**
 * Difficulty is banded on **par**, not on how many lights start on.
 *
 * The first pass at this game banded on lit count, because that is what
 * reads as "harder" at a glance - and measuring the result showed it is
 * very nearly uncorrelated with the real thing: the easy board with the
 * *fewest* lights lit (8) needed more presses than one with 10, and the
 * easy and medium tiers overlapped almost entirely, both full of
 * five-press boards. Lights Out gives no local foothold - pressing
 * anything makes the board look worse before better - so the honest
 * measure of how much a player is being asked for is how many presses
 * the shortest answer takes, which `parFor` computes exactly.
 */
export function shapeForDifficulty(difficulty: PuzzleDifficulty): LightsOutShape {
  switch (difficulty) {
    // Raised after playtesting found the run "too easy": a one-press board
    // is over before it has begun, and level sets deal puzzles at random,
    // so the old single-cross "first board" could turn up at any point.
    case 'easy':
      return { size: 5, minPar: 2, maxPar: 4 };
    case 'medium':
      return { size: 5, minPar: 5, maxPar: 6 };
    case 'hard':
      return { size: 6, minPar: 7, maxPar: 9 };
  }
}

function allOff(size: number): LightsOutState {
  return { lights: Array.from({ length: size }, () => Array.from({ length: size }, () => false)) };
}

/** One attempt: press `count` distinct random cells on an empty board. */
function attempt(size: number, count: number, random: () => number): LightsOutState {
  const cells = new Set<number>();
  while (cells.size < count) cells.add(Math.floor(random() * size * size));

  let state = allOff(size);
  for (const index of cells) {
    state = press(state, size, Math.floor(index / size), index % size);
  }
  return state;
}

/** Pressing `k` random cells does not reliably produce a par-`k` board -
 * overlapping presses cancel, and a 5x5's four solutions are not the same
 * size - so attempts are checked against the real solver and retried.
 * Generous by a wide margin; it exists so a mis-tuned target fails loudly
 * at module load rather than hanging. */
const MAX_ATTEMPTS = 4000;

/**
 * Builds a board whose par is exactly `targetPar`, verified with the real
 * solver rather than assumed from the number of presses used to make it.
 * Deterministic from `id`.
 */
export function generateLightsOut(id: string, name: string, difficulty: PuzzleDifficulty, targetPar: number): LightsOutPuzzle {
  const shape = shapeForDifficulty(difficulty);
  if (targetPar < shape.minPar || targetPar > shape.maxPar) {
    throw new Error(`Lights Out ${id}: par ${targetPar} is outside the ${difficulty} band (${shape.minPar}-${shape.maxPar}).`);
  }
  const random = mulberry32(hashId(id));

  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    // Seeded from a press count at or just above the target: a smaller
    // set can never reach a larger par, and too large a set usually
    // collapses back down to something much shorter.
    const presses = targetPar + Math.floor(random() * 3);
    const state = attempt(shape.size, presses, random);
    if (litCount(state) === 0) continue;

    const candidate: LightsOutPuzzle = { id, name, difficulty, size: shape.size, initial: state.lights, par: targetPar };
    if (parFor(candidate) === targetPar) return candidate;
  }

  throw new Error(`Lights Out ${id}: no board with par exactly ${targetPar} after ${MAX_ATTEMPTS} attempts.`);
}
