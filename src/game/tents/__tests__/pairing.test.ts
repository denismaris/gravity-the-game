import { isTentsTreesSolved } from '../logic';
import { TentMark, TentsTreesPuzzle } from '../types';

const board = (rows: string[]): TentMark[][] => rows.map(line => [...line].map(ch => (ch === 't' ? 'tent' : ch === 'm' ? 'marked' : 'empty')));

/**
 * Two trees in a row with a tent between and one beyond:
 *   T t T t      (row 0)
 * The middle tent touches both trees. Pairing it with the left tree and
 * the far tent with the right one is a perfectly good solve.
 */
const PUZZLE = {
  id: 'pairing',
  difficulty: 'easy',
  rows: 1,
  cols: 4,
  trees: [
    { row: 0, col: 0 },
    { row: 0, col: 2 },
  ],
  rowCounts: [2],
  colCounts: [0, 1, 0, 1],
} as TentsTreesPuzzle;

test('a tent between two trees counts, as long as every tree gets its own tent', () => {
  expect(isTentsTreesSolved(PUZZLE, { marks: board(['.t.t']) })).toBe(true);
});

test('two trees cannot share one tent', () => {
  const one = { ...PUZZLE, rowCounts: [1], colCounts: [0, 1, 0, 0] } as TentsTreesPuzzle;
  expect(isTentsTreesSolved(one, { marks: board(['.t..']) })).toBe(false);
});
