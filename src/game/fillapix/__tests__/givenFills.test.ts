import { FILLAPIX, GIVEN_FILL_SHARE, givenFills, initialFillaPixState, isFillaPixSolved } from '..';

/** Playtesting asked for a foothold: a share of each picture opens filled. */
describe('squares that open already filled', () => {
  test('are always part of the picture - never a square the answer leaves empty', () => {
    for (const puzzle of FILLAPIX) {
      givenFills(puzzle).forEach((line, row) => line.forEach((on, col) => on && expect(puzzle.solution[row][col]).toBe(true)));
    }
  });

  test("cover each tier's share of the picture, and the board is not solved at the start", () => {
    for (const puzzle of FILLAPIX) {
      const picture = puzzle.solution.flat().filter(Boolean).length;
      const given = givenFills(puzzle).flat().filter(Boolean).length;
      expect(given).toBe(Math.round(picture * GIVEN_FILL_SHARE[puzzle.difficulty]));
      expect(isFillaPixSolved(puzzle, initialFillaPixState(puzzle))).toBe(puzzle.solution.flat().every(on => !on));
    }
  });

  test('are the same every time a puzzle opens', () => {
    for (const puzzle of FILLAPIX) expect(givenFills(puzzle)).toEqual(givenFills(puzzle));
  });
});
