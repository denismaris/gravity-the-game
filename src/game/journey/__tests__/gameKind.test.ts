import { BINAIRO } from '../../binairo';
import { LEVELS } from '../../levels';
import { MIRROR_MAZES } from '../../mirror';
import { TENTS_TREES } from '../../tents';
import { TOWERS } from '../../towers';
import { getWorldForLevel } from '../../worlds';
import { puzzleDisplayInfo, ROTATION } from '../gameKind';

describe('ROTATION', () => {
  test('lists every game kind exactly once', () => {
    expect(ROTATION).toEqual(['gravity', 'mirror', 'tents', 'towers', 'binairo']);
  });
});

describe('puzzleDisplayInfo', () => {
  test('resolves a Gravity level to its own world/chapter name', () => {
    const level = LEVELS[0];
    const info = puzzleDisplayInfo('gravity', level.id);
    expect(info).toEqual({ name: level.name, chapter: getWorldForLevel(level.id)?.name ?? 'Gravity' });
  });

  test('resolves a Mirror Maze puzzle to the game display name', () => {
    const puzzle = MIRROR_MAZES[0];
    expect(puzzleDisplayInfo('mirror', puzzle.id)).toEqual({ name: puzzle.name ?? puzzle.id, chapter: 'Mirror Maze' });
  });

  test('resolves a Tents and Trees puzzle to the game display name', () => {
    const puzzle = TENTS_TREES[0];
    expect(puzzleDisplayInfo('tents', puzzle.id)).toEqual({ name: puzzle.name ?? puzzle.id, chapter: 'Tents and Trees' });
  });

  test('resolves a Towers puzzle to the game display name', () => {
    const puzzle = TOWERS[0];
    expect(puzzleDisplayInfo('towers', puzzle.id)).toEqual({ name: puzzle.name ?? puzzle.id, chapter: 'Skyscrapers' });
  });

  test('resolves a Binairo puzzle to the game display name', () => {
    const puzzle = BINAIRO[0];
    expect(puzzleDisplayInfo('binairo', puzzle.id)).toEqual({ name: puzzle.name ?? puzzle.id, chapter: 'Binairo' });
  });

  test('returns undefined for a puzzle id that does not exist in its own game', () => {
    expect(puzzleDisplayInfo('binairo', 'not-a-real-id')).toBeUndefined();
  });
});
