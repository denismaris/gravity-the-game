import { deriveClues } from './clues';
import { ConstellationPuzzle } from './types';

/**
 * Builds a puzzle from ASCII art: `#` is a lit cell, anything else is dark.
 * Clues are always derived (never hand-written) so they cannot drift from
 * the picture. Every puzzle here is checked for a *unique* solution by
 * `assertValidConstellation` in the test suite.
 */
function fromArt(id: string, name: string, art: string[]): ConstellationPuzzle {
  const solution = art.map(row => Array.from(row, ch => ch === '#'));
  const { rowClues, colClues } = deriveClues(solution);
  return {
    id,
    name,
    rows: solution.length,
    cols: solution[0].length,
    solution,
    rowClues,
    colClues,
  };
}

/** Hand-authored Constellation puzzles, easy -> harder. Named for real
 * constellations whose shape the picture echoes. */
export const CONSTELLATIONS: ReadonlyArray<ConstellationPuzzle> = [
  fromArt('con-001', 'Sagitta', [
    '..#..',
    '.###.',
    '#.#.#',
    '..#..',
    '..#..',
  ]),
  fromArt('con-002', 'Crux', [
    '..#..',
    '..#..',
    '#####',
    '..#..',
    '..#..',
  ]),
  fromArt('con-003', 'The Diamond', [
    '..#..',
    '.###.',
    '#####',
    '.###.',
    '..#..',
  ]),
  fromArt('con-004', 'Comet', [
    '#.....',
    '##....',
    '.###..',
    '...###',
    '.....#',
    '.....#',
  ]),
  fromArt('con-005', 'Fornax', [
    '######',
    '#....#',
    '#.##.#',
    '#.##.#',
    '#....#',
    '######',
  ]),
  fromArt('con-006', 'Lyra', [
    '##.....',
    '.##....',
    '.###...',
    '...##..',
    '....##.',
    '.....##',
    '......#',
  ]),
  fromArt('con-007', 'Draco', [
    '#.......',
    '##......',
    '.####...',
    '....###.',
    '.......#',
    '.......#',
    '......##',
    '.....###',
  ]),
  fromArt('con-008', 'Orion', [
    '..###...',
    '.##.....',
    '##......',
    '#.......',
    '##......',
    '.###....',
    '...####.',
    '.......#',
  ]),
  fromArt('con-009', 'Perseus', [
    '#........',
    '###......',
    '..##.....',
    '...###...',
    '.....#...',
    '.....##..',
    '.......##',
    '........#',
    '.......##',
  ]),
];

export function getConstellationById(id: string): ConstellationPuzzle | undefined {
  return CONSTELLATIONS.find(puzzle => puzzle.id === id);
}
