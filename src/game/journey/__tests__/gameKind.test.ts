import { ARUKONE } from '../../arukone';
import { BINAIRO } from '../../binairo';
import { GLASS_WINDOWS } from '../../glass';
import { gravityTierOf, LEVELS } from '../../levels';
import { LIGHTS_OUT } from '../../lightsout';
import { MIRROR_MAZES } from '../../mirror';
import { LILY_PONDS } from '../../lilypads';
import { VANE_ROOFS } from '../../vanes';
import { getWorldForLevel } from '../../worlds';
import { puzzleDisplayInfo, ROTATION } from '../gameKind';

describe('ROTATION', () => {
  test('lists every game kind exactly once', () => {
    expect(ROTATION).toEqual(['gravity', 'mirror', 'lilypads', 'vanes', 'binairo', 'arukone', 'glass', 'lightsout', 'adjacent', 'bloom', 'mosaic', 'bridges']);
  });
});

describe('puzzleDisplayInfo', () => {
  test('resolves a Gravity level to its own world/chapter name', () => {
    const level = LEVELS[0];
    const info = puzzleDisplayInfo('gravity', level.id);
    expect(info).toEqual({
      name: level.name,
      chapter: getWorldForLevel(level.id)?.name ?? 'Gravity',
      difficulty: level.difficulty,
    });
  });

  test('resolves a Mirror Maze puzzle to the game display name', () => {
    const puzzle = MIRROR_MAZES[0];
    expect(puzzleDisplayInfo('mirror', puzzle.id)).toEqual({
      name: puzzle.name ?? puzzle.id,
      chapter: 'Mirror Maze',
      difficulty: puzzle.difficulty,
    });
  });

  test('resolves a Lily Pads pond to the game display name', () => {
    const puzzle = LILY_PONDS[0];
    expect(puzzleDisplayInfo('lilypads', puzzle.id)).toEqual({
      name: puzzle.name,
      chapter: 'Lily Pads',
      difficulty: puzzle.difficulty,
    });
  });

  test('resolves a Weathervanes roof to the game display name', () => {
    const puzzle = VANE_ROOFS[0];
    expect(puzzleDisplayInfo('vanes', puzzle.id)).toEqual({
      name: puzzle.name,
      chapter: 'Weathervanes',
      difficulty: puzzle.difficulty,
    });
  });

  test('resolves a Twos (binairo) puzzle to the game display name', () => {
    const puzzle = BINAIRO[0];
    expect(puzzleDisplayInfo('binairo', puzzle.id)).toEqual({
      name: puzzle.name ?? puzzle.id,
      chapter: 'Twos',
      difficulty: puzzle.difficulty,
    });
  });

  test('returns undefined for a puzzle id that does not exist in its own game', () => {
    expect(puzzleDisplayInfo('binairo', 'not-a-real-id')).toBeUndefined();
  });
});

/**
 * Home and every game screen now *show* a difficulty, so a label that
 * disagrees with the pool it came from is a lie told to the player rather
 * than a cosmetic slip. These check the reporting, pool-wide: the
 * per-game checks that each pool's tiers match its own measured
 * difficulty live in each game's own test file.
 */
describe('difficulty is reported faithfully for every game', () => {
  const POOLS = [
    ['mirror', MIRROR_MAZES],
    ['lilypads', LILY_PONDS],
    ['vanes', VANE_ROOFS],
    ['binairo', BINAIRO],
    ['arukone', ARUKONE],
    ['glass', GLASS_WINDOWS],
    ['lightsout', LIGHTS_OUT],
  ] as const;

  test.each(POOLS)('%s: every puzzle reports its own tier', (kind, pool) => {
    for (const puzzle of pool) {
      expect(puzzleDisplayInfo(kind, puzzle.id)?.difficulty).toBe(puzzle.difficulty);
    }
  });

  /** Gravity is the one game with a fourth tier, and the shared vocabulary
   * has three. Its `expert` levels have to arrive as *something* - reading
   * back `undefined`, or quietly as `easy`, would put the calmest chip in
   * the app on the app's hardest levels. */
  test('gravity: every level reports the tier it is dealt at, and no short expert board reads as easy', () => {
    for (const level of LEVELS) {
      const reported = puzzleDisplayInfo('gravity', level.id)?.difficulty;
      expect(reported).toBe(gravityTierOf(level) ?? 'easy');
      if (level.difficulty === 'expert') expect(reported).not.toBe('easy');
    }
  });
});
