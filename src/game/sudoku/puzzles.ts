import { SudokuPuzzle, SudokuValue } from './types';

/**
 * Builds a puzzle from ASCII art: digits `1`-`9` are givens, `.` is a blank
 * cell the player fills in. Every puzzle here is checked for a *unique*
 * solution by `assertValidSudoku` in the test suite - generated (not
 * hand-typed) by a standard "solve a random full grid, then remove cells
 * one at a time as long as the solution stays unique" script, easy -> harder
 * purely by how many givens are left.
 */
function fromGrid(id: string, name: string, rows: string[]): SudokuPuzzle {
  const givens = rows.map(row =>
    Array.from(row, ch => (ch === '.' ? 0 : Number(ch)) as SudokuValue),
  );
  return { id, name, givens };
}

/** Hand-picked (procedurally generated, solver-verified), easy -> harder. */
export const SUDOKUS: ReadonlyArray<SudokuPuzzle> = [
  fromGrid('sudoku-001', 'Warm-Up', [
    '8.567.3..',
    '.16.487.5',
    '.43.518..',
    '.52.3.6..',
    '9...2..3.',
    '6.1..42.9',
    '12.86.543',
    '.64.1.98.',
    '..749312.',
  ]), // 46 givens
  fromGrid('sudoku-002', 'First Light', [
    '83792...4',
    '921....58',
    '5...8372.',
    '3842..9..',
    '7.534.21.',
    '...59.843',
    '65.73.48.',
    '......6.7',
    '.7..69..1',
  ]), // 44 givens
  fromGrid('sudoku-003', 'Steady Hand', [
    '.9..73..2',
    '62394.17.',
    '.5..28943',
    '.4.5.....',
    '2.84.7.5.',
    '..5.1.4..',
    '5..3...1.',
    '912.8...5',
    '.3.2...9.',
  ]), // 38 givens
  fromGrid('sudoku-004', 'Clear Thinking', [
    '..6.1...4',
    '1.3.57...',
    '.9..2.3..',
    '24.5.6...',
    '9.823..5.',
    '.3..7..82',
    '8.2.4573.',
    '4...9..2.',
    '..98...41',
  ]), // 36 givens
  fromGrid('sudoku-005', 'Long Division', [
    '.3..85.6.',
    '..94..538',
    '8.1.63..9',
    '..2......',
    '.1...4...',
    '4.7529...',
    '29.3..1..',
    '......392',
    '....9.78.',
  ]), // 32 givens
  fromGrid('sudoku-006', 'Narrow Margins', [
    '..1829...',
    '..61....4',
    '92...6..5',
    '39..7.5.2',
    '.1..84...',
    '5..29..78',
    '.........',
    '...9.7..3',
    '.....846.',
  ]), // 30 givens
  fromGrid('sudoku-007', 'Deep Focus', [
    '3.6...5..',
    '..8.97.1.',
    '....8.269',
    '....1.9.8',
    '..29.....',
    '4..7...2.',
    '1.......2',
    '....5.6..',
    '..746...1',
  ]), // 27 givens
  fromGrid('sudoku-008', 'Last Word', [
    '.9....3..',
    '8.7...6..',
    '6..1.....',
    '.....3..2',
    '....659.3',
    '2.1..9.8.',
    '1..3.....',
    '...9..17.',
    '..5.81...',
  ]), // 25 givens
];

export function getSudokuById(id: string): SudokuPuzzle | undefined {
  return SUDOKUS.find(puzzle => puzzle.id === id);
}
