import { PuzzleDifficulty } from '../puzzleDifficulty';
import { isSolvableByLogic, solveFillaPix } from './solver';
import { FillaPixCell, FillaPixPuzzle } from './types';
import { FillaPixImage } from './pixelArt';

/**
 * Turns a hand-authored picture (`pixelArt.ts`) into a played puzzle: the
 * picture itself becomes `solution`, and clues are revealed one at a time
 * until the revealed subset both pins the picture down to exactly one
 * grid *and* can be reasoned to that grid without guessing - verified
 * with `solveFillaPix` and `isSolvableByLogic` rather than assumed. The
 * second half of that is the one that was missing, and it is the one
 * that decides whether these are puzzles or coin flips. Deterministic from the puzzle's own id, like every other
 * seeded game in this app - `fillapix-easy-01` is the same board on every
 * device and every launch, which matters because `PlayerProgress.levels`
 * stores a best result per id.
 */

/* eslint-disable no-bitwise -- mulberry32 and FNV-1a are bitwise by definition */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* eslint-enable no-bitwise */

function shuffled<T>(items: ReadonlyArray<T>, random: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface FillaPixShape {
  readonly size: number;
  /** A floor on how many clues to reveal, applied *on top of* the real
   * stopping condition (unique and solvable by logic). Mostly slack now:
   * requiring a puzzle to be reachable by pure reasoning needs more
   * clues than either tier's floor asks for, so in practice every board
   * stops at its logic-solvable minimum and difficulty scales with grid
   * size. Kept because it still binds if a picture ever turns out to be
   * unusually easy to pin down. */
  readonly minReveal: (totalCells: number) => number;
}

/**
 * Board size scales with difficulty per the game's own spec (5x5 up to
 * 7x7/8x8); hard ships entirely at 7x7, leaving 8x8 for a later pool
 * expansion.
 *
 * Dropping hard to 6x6 was considered when this game was reported as too
 * hard, and rejected once the real causes were measured (a clue rule
 * that excluded its own square, and puzzles that needed guessing). With
 * both fixed, shrinking hard would have made it the same size as medium
 * and left the two tiers separated by nothing at all - size is now the
 * only axis that genuinely distinguishes them.
 */
export function shapeForDifficulty(difficulty: PuzzleDifficulty): FillaPixShape {
  switch (difficulty) {
    case 'easy':
      return { size: 5, minReveal: total => Math.ceil(total * 0.55) };
    case 'medium':
      return { size: 6, minReveal: total => Math.ceil(total * 0.35) };
    case 'hard':
      return { size: 7, minReveal: () => 0 };
  }
}

function parseSolution(rows: ReadonlyArray<string>): ReadonlyArray<ReadonlyArray<boolean>> {
  return rows.map(row => row.split('').map(ch => ch === '#'));
}

function allCells(size: number): FillaPixCell[] {
  const cells: FillaPixCell[] = [];
  for (let row = 0; row < size; row += 1) for (let col = 0; col < size; col += 1) cells.push({ row, col });
  return cells;
}

export interface GenerateFillaPixOptions {
  /** Reveal every cell's clue rather than the tier's usual subset - the
   * most a player can ever be told, and therefore the least deduction a
   * solve can ever demand. Used for exactly one puzzle (see
   * `FIRST_PUZZLE_REVEAL_ALL` in `puzzles.ts`): a brand-new player's very
   * first Fill-a-Pix, where the point is to teach the rule by direct
   * application, not to test anyone's deduction. */
  readonly revealAll?: boolean;
}

export function generateFillaPix(
  id: string,
  name: string,
  difficulty: PuzzleDifficulty,
  image: FillaPixImage,
  options: GenerateFillaPixOptions = {},
): FillaPixPuzzle {
  const shape = shapeForDifficulty(difficulty);
  const solution = parseSolution(image.rows);
  const total = shape.size * shape.size;
  const minReveal = options.revealAll ? total : shape.minReveal(total);
  const random = mulberry32(hashId(id));
  const order = shuffled(allCells(shape.size), random);

  const revealed: FillaPixCell[] = [];
  for (const cell of order) {
    revealed.push(cell);
    const candidate: FillaPixPuzzle = { id, name, difficulty, size: shape.size, solution, clues: revealed };
    // Uniqueness alone is not enough and never was: a unique puzzle can
    // still be unreachable without guessing (see `isSolvableByLogic`).
    // Both are required, so every shipped board can be *reasoned* to its
    // answer rather than merely having one.
    const unique = solveFillaPix(candidate, 2).length === 1;
    if (unique && revealed.length >= minReveal && isSolvableByLogic(candidate)) {
      return candidate;
    }
  }

  // Revealing every cell still didn't pin the picture down uniquely - a
  // real authoring bug in the picture itself, not something to paper
  // over. Thrown here so it fails loudly at module load / in the pool
  // test, never silently shipping an ambiguous puzzle.
  throw new Error(
    `Fill-a-Pix ${id}: image "${image.id}" is not uniquely solvable by logic even with every clue revealed.`,
  );
}
