import { ARUKONE } from '../../arukone';
import { BINAIRO } from '../../binairo';
import { FILLAPIX } from '../../fillapix';
import { LEVELS } from '../../levels';
import { LIGHTS_OUT } from '../../lightsout';
import { MIRROR_MAZES } from '../../mirror';
import { TENTS_TREES } from '../../tents';
import { TOWERS } from '../../towers';
import { getWorldForLevel } from '../../worlds';
import { puzzleDisplayInfo, ROTATION } from '../gameKind';

describe('ROTATION', () => {
  test('lists every game kind exactly once', () => {
    expect(ROTATION).toEqual(['gravity', 'mirror', 'tents', 'towers', 'binairo', 'arukone', 'fillapix', 'lightsout', 'adjacent', 'bloom', 'mosaic', 'bridges']);
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

  test('resolves a Tents and Trees puzzle to the game display name', () => {
    const puzzle = TENTS_TREES[0];
    expect(puzzleDisplayInfo('tents', puzzle.id)).toEqual({
      name: puzzle.name ?? puzzle.id,
      chapter: 'Tents and Trees',
      difficulty: puzzle.difficulty,
    });
  });

  test('resolves a Towers puzzle to the game display name', () => {
    const puzzle = TOWERS[0];
    expect(puzzleDisplayInfo('towers', puzzle.id)).toEqual({
      name: puzzle.name ?? puzzle.id,
      chapter: 'Skyscrapers',
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
    ['tents', TENTS_TREES],
    ['towers', TOWERS],
    ['binairo', BINAIRO],
    ['arukone', ARUKONE],
    ['fillapix', FILLAPIX],
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
  test('gravity: every level reports a tier, with expert collapsed to hard', () => {
    for (const level of LEVELS) {
      const reported = puzzleDisplayInfo('gravity', level.id)?.difficulty;
      expect(reported).toBe(level.difficulty === 'expert' ? 'hard' : level.difficulty);
    }
    // And the collapse is actually exercised - there are expert levels.
    expect(LEVELS.some(level => level.difficulty === 'expert')).toBe(true);
  });
});
