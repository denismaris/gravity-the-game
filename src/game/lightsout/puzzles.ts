import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, endlessSeed, parseEndlessId } from '../endlessId';
import { generateLightsOut, shapeForDifficulty } from './generator';
import { LightsOutPuzzle } from './types';

/**
 * Each board's name and its par, in the order they are dealt. Names are
 * all dusk/lamplight, the one register this game's own board (amber
 * lights on a deep indigo night) already speaks in.
 *
 * Par climbs deliberately, and `easy-01` is a par of **one**: the board
 * is a single lit cross, so the very first thing a player meets is the
 * exact shape the tutorial just drew for them, and one press clears it.
 * That is the on-ramp this game had none of - the first pass opened on a
 * three-press board scattered across 25 cells, which is opaque in a
 * puzzle that gives no local foothold to reason from.
 */
const BOARDS: Record<PuzzleDifficulty, ReadonlyArray<readonly [name: string, par: number]>> = {
  easy: [
    ['Porch Light', 1],
    ['Nightfall', 2],
    ['Lamp Row', 2],
    ['Small Hours', 3],
    ['Curfew', 3],
    // Appended, never inserted: ids are positional
    // (`lightsout-easy-03` is the third entry here), so slotting a board
    // into the middle would hand an existing id a different puzzle and
    // orphan every result already recorded against it. Par therefore has
    // to start at or above the tier's current last, which the pool test
    // also enforces as a climbing curve.
    ['First Star', 3],
    ['Shutters', 3],
  ],
  medium: [
    ['Streetlamps', 4],
    ['Evening Watch', 4],
    ['Nine Windows', 5],
    ['Blackout', 5],
    ['Last Lamp', 6],
    ['Gaslight', 6],
    ['Midnight Round', 6],
  ],
  hard: [
    ['Dusk Patrol', 6],
    ['All Quiet', 7],
    ['Lights Down', 7],
    ['The Long Night', 8],
    ['The Late Shift', 8],
    ['The Last Round', 9],
  ],
};

function poolFor(difficulty: PuzzleDifficulty): LightsOutPuzzle[] {
  return BOARDS[difficulty].map(([name, par], index) =>
    generateLightsOut(`lightsout-${difficulty}-${String(index + 1).padStart(2, '0')}`, name, difficulty, par),
  );
}

export const LIGHTS_OUT: ReadonlyArray<LightsOutPuzzle> = [
  ...poolFor('easy'),
  ...poolFor('medium'),
  ...poolFor('hard'),
];

/**
 * Endless boards, built the first time they are asked for and kept.
 *
 * Cheap enough to do on demand - this game's whole curated pool builds
 * in about four milliseconds - but cached anyway, because a board gets
 * asked for repeatedly while it is being played and rebuilding it per
 * render would be pure waste.
 */
const endlessCache = new Map<string, LightsOutPuzzle>();

function buildEndless(id: string, tier: PuzzleDifficulty, index: number): LightsOutPuzzle {
  const cached = endlessCache.get(id);
  if (cached) return cached;
  const shape = shapeForDifficulty(tier);
  /**
   * Drawn from the tier's band with its very bottom rung skipped.
   *
   * Two reasons, and the second one is measurable. A player only reaches
   * an endless board after finishing every curated board in that tier,
   * so the tier's gentlest rung - which exists to teach - has already
   * done its job. And at the bottom of the easy band the board space is
   * genuinely tiny: a par-1 5x5 is "press one cell", of which there are
   * exactly 25, so drawing par 1 roughly a third of the time produced
   * visible repeats (measured: 54 distinct boards from 60 ids). Starting
   * one rung up puts every tier at 60 out of 60.
   */
  const floor = shape.minPar < shape.maxPar ? shape.minPar + 1 : shape.minPar;
  const span = shape.maxPar - floor + 1;
  const par = floor + (endlessSeed(id) % span);
  const puzzle = generateLightsOut(id, endlessName(index), tier, par);
  endlessCache.set(id, puzzle);
  return puzzle;
}

export function getLightsOutById(id: string): LightsOutPuzzle | undefined {
  const found = LIGHTS_OUT.find(puzzle => puzzle.id === id);
  if (found) return found;
  const endless = parseEndlessId(id);
  if (!endless || endless.kind !== 'lightsout') return undefined;
  return buildEndless(id, endless.tier, endless.index);
}

export function getLightsOutByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<LightsOutPuzzle> {
  return LIGHTS_OUT.filter(puzzle => puzzle.difficulty === difficulty);
}
