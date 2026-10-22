import { TWOS, LANTERN_PAIR, MIRROR_TWICE, BLOOM_FREE } from '../gridLessons';
import { BinairoState, isBinairoSolved, setValue } from '../../../game/binairo';
import { isLightsOutSolved, press } from '../../../game/lightsout';
import { isMirrorMazeSolved, setMirror } from '../../../game/mirror';
import { isBloomSolved } from '../../../game/bloom';

/** Each lesson's last step is a whole board the player finishes alone -
 * so it must be solvable, and must not start solved. */
describe('the lessons\' own boards', () => {
  test('Twos fills to a solved board', () => {
    let s: BinairoState = { values: TWOS.givens.map(r => r.slice()) };
    expect(isBinairoSolved(TWOS, s)).toBe(false);
    const answer = [
      [1, 1, 0, 0],
      [0, 1, 0, 1],
      [1, 0, 1, 0],
      [0, 0, 1, 1],
    ];
    answer.forEach((line, r) => line.forEach((v, c) => {
      if (TWOS.givens[r][c] === null) s = setValue(s, TWOS, r, c, v as 0 | 1);
    }));
    expect(isBinairoSolved(TWOS, s)).toBe(true);
  });

  test('Lanterns clears in two taps', () => {
    let s = LANTERN_PAIR.state;
    expect(isLightsOutSolved(s)).toBe(false);
    s = press(s, 3, 0, 0);
    s = press(s, 3, 2, 2);
    expect(isLightsOutSolved(s)).toBe(true);
  });

  test('Mirror Maze takes two mirrors', () => {
    let s = { mirrors: [[null, null, null], [null, null, null], [null, null, null]] } as { mirrors: Array<Array<'fwd' | 'back' | null>> };
    expect(isMirrorMazeSolved(MIRROR_TWICE, s)).toBe(false);
    s = setMirror(s, MIRROR_TWICE, 0, 2, 'back') as typeof s;
    s = setMirror(s, MIRROR_TWICE, 2, 2, 'fwd') as typeof s;
    expect(isMirrorMazeSolved(MIRROR_TWICE, s)).toBe(true);
  });

  test('Bloom closes at its solution, and starts open', () => {
    expect(isBloomSolved(BLOOM_FREE, { rotations: BLOOM_FREE.start.map(r => r.slice()) })).toBe(false);
    expect(isBloomSolved(BLOOM_FREE, { rotations: BLOOM_FREE.solution.map(r => r.slice()) })).toBe(true);
    // The pinned tile is already where the solution has it.
    expect(BLOOM_FREE.start[0][0]).toBe(BLOOM_FREE.solution[0][0]);
  });
});
