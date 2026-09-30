import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, endlessSeed, parseEndlessId } from '../endlessId';
import { BinairoGrid, BinairoShape, generateBinairo } from './generator';
import { BAKED_BINAIRO } from './pool.generated';
import { BinairoPuzzle, BinairoValue } from './types';

type FullGrid = BinairoGrid;

/**
 * The generated part of the pool: ids, names, tiers and shapes. Boards
 * come from \`generateBinairo\` - random grids, stripped to a target given
 * share while staying uniquely solvable - rather than the first pool's
 * rotated-row grids, which were so regular that the 6x6 boards read
 * themselves off. Sizes stop at 8x8 (10x10 was too much to hold on a phone
 * screen), and difficulty comes from how little is given:
 *
 * - easy: 6x6, ~45% given;
 * - medium: 6x6 at ~30% given (a small board that genuinely asks), and 8x8
 *   at ~42%;
 * - hard: 8x8 at ~30% given, with more \`=\`/\`x\` tiles.
 *
 * Ids are frozen; the two hand-built mechanic debuts (#013 twin cells,
 * #014 count clues) follow below, unchanged.
 */
const GENERATED: ReadonlyArray<readonly [string, string, PuzzleDifficulty, BinairoShape]> = [
  ['binairo-001', 'Even Split', 'easy', { size: 6, givenShare: 0.45, constraints: 2 }],
  ['binairo-002', 'Twin Ranks', 'easy', { size: 6, givenShare: 0.45, constraints: 2 }],
  ['binairo-003', 'Mirror Rows', 'easy', { size: 6, givenShare: 0.44, constraints: 2 }],
  ['binairo-004', 'Balanced Six', 'easy', { size: 6, givenShare: 0.42, constraints: 2 }],
  ['binairo-005', 'Wide Grid', 'medium', { size: 6, givenShare: 0.3, constraints: 3 }],
  ['binairo-006', 'Counterpoint', 'medium', { size: 6, givenShare: 0.3, constraints: 3 }],
  ['binairo-007', 'Reflected Eight', 'medium', { size: 8, givenShare: 0.42, constraints: 4 }],
  ['binairo-008', 'Grand Grid', 'hard', { size: 8, givenShare: 0.32, constraints: 5 }],
  ['binairo-009', 'Full Balance', 'hard', { size: 8, givenShare: 0.3, constraints: 5 }],
  ['binairo-010', 'Final Split', 'hard', { size: 8, givenShare: 0.3, constraints: 5 }],
  ['binairo-011', 'Crossed Signals', 'hard', { size: 8, givenShare: 0.28, constraints: 6 }],
  ['binairo-012', 'Final Signal', 'hard', { size: 8, givenShare: 0.28, constraints: 6 }],
];

/** Builds the generated part of the pool, with each board's solution. Run
 * once, offline, to write \`pool.generated.ts\`; the app loads that, and the
 * pool test checks the two still agree. */
export function buildBinairoPool(): Array<{ puzzle: BinairoPuzzle; solution: FullGrid }> {
  return GENERATED.map(([id, name, difficulty, shape]) => generateBinairo(id, name, difficulty, shape));
}

/** The twin-cells debut's grid is one base row rotated a step per row -
 * valid by construction (see the git history for the full argument), and
 * kept as it was: that puzzle's givens were tuned against this grid. */
function rotateGrid(base: ReadonlyArray<0 | 1>): FullGrid {
  const n = base.length;
  return Array.from({ length: n }, (_row, r) => Array.from({ length: n }, (_col, c) => base[(c + r) % n]));
}

const BASE_6_ALT: ReadonlyArray<0 | 1> = [0, 1, 0, 0, 1, 1];
const GRID_6_ALT = rotateGrid(BASE_6_ALT);

const GRID_6_COUNT: FullGrid = [
  [0, 0, 1, 0, 1, 1],
  [0, 0, 1, 1, 0, 1],
  [1, 1, 0, 0, 1, 0],
  [0, 1, 0, 0, 1, 1],
  [1, 0, 1, 1, 0, 0],
  [1, 1, 0, 1, 0, 0],
];

function grid(rows: ReadonlyArray<ReadonlyArray<BinairoValue>>): ReadonlyArray<ReadonlyArray<BinairoValue>> {
  return rows;
}

/** The two hand-built puzzles that each debut a mechanic on a small board. */
const HAND_BUILT: ReadonlyArray<{ puzzle: BinairoPuzzle; solution: FullGrid }> = (
  [
  {
    id: 'binairo-013',
    difficulty: 'medium',
    name: 'Across the Center',
    size: 6,
    givens: grid([
      [0, 1, 0, 0, 1, 1],
      [1, 0, 0, 1, 1, 0],
      [null, null, 1, null, 0, null],
      [0, 1, null, 0, null, null],
      [null, 1, 0, 1, null, null],
      [null, 0, null, 0, 0, null],
    ]),
    twinCells: [{ row: 1, col: 1 }],
  },
  {
    id: 'binairo-014',
    difficulty: 'medium',
    name: 'Look Around',
    size: 6,
    // Count clues in isolation - no `=`/`x` badges, no twins - the same
    // teach-one-thing shape `binairo-013` uses for twin cells, and tagged
    // by real complexity rather than its position in the ramp.
    //
    // Was down to ten givens (28% of the board), on the reasoning that
    // with the board this bare the three clues would do most of the
    // deductive work. Measured against the rest of the pool, that reasoning
    // didn't hold up: every other puzzle here sits at 54-64% given, and this
    // one was sparser than even the hardest 10x10s while tagged `medium` -
    // which is what "too hard" actually meant. Raised to 21 givens (58%),
    // landing inside this size's own 54-64% tier, by revealing more of the
    // same solution rather than re-authoring the puzzle. The exact set was
    // chosen by brute-force search over every combination of the candidate
    // reveals (`solveBinairo` run with and without `countClues` on each),
    // keeping the largest one that still leaves the board ambiguous with
    // the clues stripped out - i.e. the clues are still load-bearing, not
    // decorative, which `binairo.test.ts`'s pool-wide test enforces. Every
    // clue keeps its full ring of blank neighbours untouched (see
    // `countClueOpenNeighbours`) - only cells away from all three clues
    // were candidates for reveal.
    givens: grid([
      [0, 0, null, 0, null, 1],
      [null, null, 1, null, 0, null],
      [1, 1, null, 0, null, null],
      [0, 1, 0, null, 1, 1],
      [null, 0, 1, 1, null, null],
      [1, 1, 0, 1, null, null],
    ]),
    countClues: [
      { row: 1, col: 2, count: 2 },
      { row: 1, col: 4, count: 4 },
      { row: 3, col: 4, count: 2 },
    ],
  },
  ] as BinairoPuzzle[]
).map((puzzle, i) => ({ puzzle, solution: [GRID_6_ALT, GRID_6_COUNT][i] }));

const ALL = [...BAKED_BINAIRO, ...HAND_BUILT];

export const BINAIRO: ReadonlyArray<BinairoPuzzle> = ALL.map(entry => entry.puzzle);

/** Each puzzle's full solution, index-aligned with \`BINAIRO\` - for the
 * pool tests, which check every board against it. */
export const BINAIRO_SOLUTION_GRIDS: ReadonlyArray<FullGrid> = ALL.map(entry => entry.solution);

/**
 * The endless board's shape for a tier, varied board to board within the
 * curated pool's bands: easy 6x6 generously given, medium a sparser 6x6 or
 * a well-given 8x8, hard a sparse 8x8 with more `=`/`x` tiles. 8x8 is the
 * ceiling (the owner's rule), so hard gets harder by sparseness, not size.
 */
export function endlessBinairoShape(id: string, tier: PuzzleDifficulty): BinairoShape {
  const seed = endlessSeed(id);
  const choices: Record<PuzzleDifficulty, ReadonlyArray<BinairoShape>> = {
    easy: [
      { size: 6, givenShare: 0.46, constraints: 2 },
      { size: 6, givenShare: 0.43, constraints: 2 },
      { size: 6, givenShare: 0.4, constraints: 3 },
    ],
    medium: [
      { size: 6, givenShare: 0.3, constraints: 3 },
      { size: 6, givenShare: 0.28, constraints: 4 },
      { size: 8, givenShare: 0.4, constraints: 4 },
    ],
    hard: [
      { size: 8, givenShare: 0.31, constraints: 5 },
      { size: 8, givenShare: 0.29, constraints: 6 },
      { size: 8, givenShare: 0.27, constraints: 6 },
    ],
  };
  return choices[tier][seed % 3];
}

const endlessCache = new Map<string, { puzzle: BinairoPuzzle; solution: FullGrid }>();

function endlessBinairo(id: string): { puzzle: BinairoPuzzle; solution: FullGrid } | undefined {
  const endless = parseEndlessId(id);
  if (!endless || endless.kind !== 'binairo') return undefined;
  const cached = endlessCache.get(id);
  if (cached) return cached;
  const built = generateBinairo(id, endlessName(endless.index, 'binairo'), endless.tier, endlessBinairoShape(id, endless.tier));
  endlessCache.set(id, built);
  return built;
}

export function getBinairoById(id: string): BinairoPuzzle | undefined {
  return BINAIRO.find(puzzle => puzzle.id === id) ?? endlessBinairo(id)?.puzzle;
}

/** The full solution of any board, curated or endless - for hints. */
export function getBinairoSolutionById(id: string): FullGrid | undefined {
  const index = BINAIRO.findIndex(puzzle => puzzle.id === id);
  return index !== -1 ? BINAIRO_SOLUTION_GRIDS[index] : endlessBinairo(id)?.solution;
}

export function getBinairoByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<BinairoPuzzle> {
  return BINAIRO.filter(puzzle => puzzle.difficulty === difficulty);
}
