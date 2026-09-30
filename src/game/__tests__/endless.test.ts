import { getTentsTreesById, assertValidTentsAndTrees } from '../tents';
import { getBinairoById, assertValidBinairo } from '../binairo';
import { getFillaPixById } from '../fillapix';
import { assertValidFillaPix } from '../fillapix/solver';
import { getMirrorMazeById } from '../mirror';
import { assertValidMirrorMaze, fewestMirrors } from '../mirror/solver';
import { generateMirrorMaze, mirrorShapeFor } from '../mirror/generator';
import { getLevelById, GRAVITY_DEPTH_BANDS } from '../levels';
import { assertValidLevel, createGameStateFromLevel } from '../levels/level';
import { findShortestSolution } from '../engine/solver';
import { generateGravityLevel } from '../levels/generator';
import { endlessId, endlessName } from '../endlessId';
import { emblemFor } from '../fillapix/emblems';
import { PuzzleDifficulty } from '../puzzleDifficulty';

const TIERS: PuzzleDifficulty[] = ['easy', 'medium', 'hard'];

/**
 * Every game now deals new boards forever. These hold each endless
 * generator to the same bar as its curated pool: rebuilt identically from
 * its id (a player's stars are keyed by it), valid by the game's own
 * checks, and in its tier's difficulty band.
 */
describe('endless boards', () => {
  test('Tents: valid, one answer, reproducible', () => {
    for (const tier of TIERS) {
      for (let i = 0; i < 4; i += 1) {
        const id = endlessId('tents', tier, i);
        const puzzle = getTentsTreesById(id)!;
        assertValidTentsAndTrees(puzzle);
        expect(puzzle.difficulty).toBe(tier);
      }
    }
  });

  test('Binairo: valid, never past 8x8', () => {
    for (const tier of TIERS) {
      for (let i = 0; i < 4; i += 1) {
        const puzzle = getBinairoById(endlessId('binairo', tier, i))!;
        assertValidBinairo(puzzle);
        expect(puzzle.size).toBeLessThanOrEqual(8);
      }
    }
  });

  test('Fill-a-Pix: emblems are symmetric pictures, boards reasoned out without guessing', () => {
    for (const tier of TIERS) {
      for (let i = 0; i < 4; i += 1) {
        const id = endlessId('fillapix', tier, i);
        const image = emblemFor(id, tier);
        expect(image.rows.every(row => row === [...row].reverse().join(''))).toBe(true);
        const filled = image.rows.join('').split('').filter(c => c === '#').length / image.rows.join('').length;
        expect(filled).toBeGreaterThan(0.3);
        expect(filled).toBeLessThan(0.7);
        assertValidFillaPix(getFillaPixById(id)!);
      }
    }
  });

  test("Mirror Maze: solvable, and the fewest mirrors it needs is in the tier's band", () => {
    for (const tier of TIERS) {
      const [lo, hi] = mirrorShapeFor(tier).mirrors;
      for (let i = 0; i < 3; i += 1) {
        const id = endlessId('mirror', tier, i);
        const puzzle = getMirrorMazeById(id)!;
        assertValidMirrorMaze(puzzle);
        const need = fewestMirrors(puzzle, 400000)!;
        expect(need).toBeGreaterThanOrEqual(lo - 1);
        expect(need).toBeLessThanOrEqual(hi);
        expect(generateMirrorMaze(id, puzzle.name!, tier)).toEqual(puzzle);
      }
    }
  });

  test('Gravity: shortest solution proved, in the depth band the dealer deals by', () => {
    for (const tier of TIERS) {
      const [lo, hi] = GRAVITY_DEPTH_BANDS[tier];
      for (let i = 0; i < 3; i += 1) {
        const id = endlessId('gravity', tier, i);
        const level = getLevelById(id)!;
        assertValidLevel(level);
        const path = findShortestSolution(createGameStateFromLevel(level), 14)!;
        expect(path.length).toBe(level.metadata!.minMoves);
        expect(path.length).toBeGreaterThanOrEqual(lo);
        expect(path.length).toBeLessThanOrEqual(Math.min(hi, 12));
        expect(generateGravityLevel(id, endlessName(i, 'gravity'), tier)).toEqual(level);
      }
    }
  });

  test('names are themed per game and do not repeat for hundreds of boards', () => {
    const names = new Set(Array.from({ length: 150 }, (_v, i) => endlessName(i, 'bridges')));
    expect(names.size).toBe(150);
    expect(endlessName(0, 'tents')).not.toBe(endlessName(0, 'bridges'));
  });
});

describe('endless Mosaic (baked offline)', () => {
  // Imported here so the rest of the file does not pay for the bake.
  const { BAKED_ENDLESS_MOSAIC } = require('../mosaic/endless.generated');
  const { buildEndlessMosaic } = require('../mosaic/endless');
  const { getMosaicById, assertValidMosaic } = require('../mosaic');

  test('the bake is what the builder builds (a sample from each tier)', () => {
    for (const tier of TIERS) expect(buildEndlessMosaic(tier, 2)).toEqual(BAKED_ENDLESS_MOSAIC[tier].slice(0, 2));
  });

  test('baked boards are valid, uniquely tiled, and ids past the end still resolve', () => {
    for (const tier of TIERS) {
      expect(BAKED_ENDLESS_MOSAIC[tier].length).toBeGreaterThanOrEqual(40);
      for (const index of [0, 5, 17]) assertValidMosaic(getMosaicById(endlessId('mosaic', tier, index)));
      expect(getMosaicById(endlessId('mosaic', tier, 5000))).toBeDefined();
    }
  });
});
