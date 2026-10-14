import { PuzzleDifficulty } from '../puzzleDifficulty';
import { cellKey, mirrorCell, sameCell } from './logic';
import { ArukoneAxis, ArukoneCell, ArukonePair, ArukonePuzzle } from './types';

/**
 * Puzzle generation for Arukone+.
 *
 * A symmetric solution has to exist, and the only dependable way to get
 * that is to build the solution *first* and derive the puzzle from it -
 * scattering endpoints and obstacles and hoping is how you ship a board
 * nobody can finish. So: carve symmetric obstacles, grow paths on what is
 * left in mirror-matched groups, then throw the paths away and keep their
 * endpoints. Whatever the player eventually draws, at least one symmetric
 * solution is known to exist, because one was used to make the board.
 *
 * Generated from a seed rather than hand-authored, but *deterministically*
 * so: `arukone-003` is the same board on every device and every launch.
 * That is not optional - this app stores a best result per puzzle id (see
 * `PlayerProgress.levels`), so a puzzle that regenerated differently each
 * time would make "your best on this one" meaningless.
 */

/* eslint-disable no-bitwise -- mulberry32 and FNV-1a are bitwise by definition */

/** Small, fast, well-distributed PRNG - the same mulberry32 this repo has
 * used elsewhere for seeded generation. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a puzzle id, so the seed follows the id rather
 * than a list position that could shift when puzzles are reordered. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* eslint-enable no-bitwise */

export interface ArukoneShape {
  readonly size: number;
  readonly pairs: number;
  readonly obstacles: number;
}

/** Board shape per tier. Pair count is the number of *numbers on the
 * board*; because paths come in mirror groups the player only ever draws
 * about half of them by hand. */
export function shapeForDifficulty(difficulty: PuzzleDifficulty): ArukoneShape {
  switch (difficulty) {
    case 'easy':
      return { size: 5, pairs: 3, obstacles: 2 };
    case 'medium':
      return { size: 6, pairs: 4, obstacles: 4 };
    case 'hard':
      return { size: 7, pairs: 5, obstacles: 6 };
  }
}

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function inBounds(size: number, cell: ArukoneCell): boolean {
  return cell.row >= 0 && cell.col >= 0 && cell.row < size && cell.col < size;
}

function shuffled<T>(items: ReadonlyArray<T>, random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function freeNeighbours(
  size: number,
  cell: ArukoneCell,
  used: ReadonlySet<string>,
  local: ReadonlySet<string>,
): ArukoneCell[] {
  return DIRECTIONS.map(([dr, dc]) => ({ row: cell.row + dr, col: cell.col + dc })).filter(
    next => inBounds(size, next) && !used.has(cellKey(next)) && !local.has(cellKey(next)),
  );
}

/**
 * Grows one self-avoiding walk from `start` across free cells, stopping at
 * `maxLength`.
 *
 * Steps into the *most constrained* neighbour available - the one with the
 * fewest onward moves of its own. This is Warnsdorff's rule, the same
 * heuristic used for knight's tours, and it is what makes filling the
 * board practical rather than a lottery: taking the tight cell first and
 * leaving the roomy ones for later is what stops a walk sealing off a
 * pocket it can never come back for. Measured over 3000 seeds per tier it
 * raises the rate of boards that fill completely by four to eight times.
 */
function growPath(
  size: number,
  start: ArukoneCell,
  used: ReadonlySet<string>,
  maxLength: number,
  random: () => number,
): ArukoneCell[] {
  const path: ArukoneCell[] = [start];
  const local = new Set<string>([cellKey(start)]);

  while (path.length < maxLength) {
    const head = path[path.length - 1];
    // Shuffled first, so equally-constrained options are picked between
    // fairly rather than always in compass order.
    const options = shuffled(freeNeighbours(size, head, used, local), random);
    if (options.length === 0) break;

    let best = options[0];
    let bestOnward = Infinity;
    for (const option of options) {
      local.add(cellKey(option));
      const onward = freeNeighbours(size, option, used, local).length;
      local.delete(cellKey(option));
      if (onward < bestOnward) {
        bestOnward = onward;
        best = option;
      }
    }
    path.push(best);
    local.add(cellKey(best));
  }
  return path;
}

/**
 * One generation attempt. Returns `null` whenever the board it grew is not
 * good enough, so the caller can simply try again with the next seed -
 * far simpler than trying to repair a bad layout in place, and at these
 * sizes attempts are cheap.
 */
function attempt(shape: ArukoneShape, axis: ArukoneAxis, random: () => number, crossing = 0): {
  obstacles: ArukoneCell[];
  pairs: ArukonePair[];
  solution: Record<number, ArukoneCell[]>;
} | null {
  const { size } = shape;
  const all: ArukoneCell[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) all.push({ row, col });
  }

  // Obstacles, placed only in *complete* mirror groups.
  //
  // This is the invariant the whole generator rests on: the set of
  // unavailable cells stays symmetric at every step. Given that, any path
  // grown on the free cells has a mirror that is also free, for nothing -
  // no second search, no repair pass. An earlier version added a cell and
  // then skipped its twin whenever the budget ran out mid-group, which
  // broke the invariant quietly and let mirrored paths run straight
  // through obstacles.
  const blocked = new Set<string>();
  const obstacles: ArukoneCell[] = [];
  // On an odd board with a straight fold, the fold is a whole line of
  // squares that are their own mirrors, and each path across covers just
  // one of them - so the rest are walls: a wall down the middle with a gap
  // for each crossing.
  const onFold = all.filter(cell => sameCell(cell, mirrorCell(axis, size, cell)));
  if (onFold.length > 1) {
    const walls = onFold.length - crossing;
    if (walls < 0 || walls > shape.obstacles) return null;
    for (const cell of shuffled(onFold, random).slice(0, walls)) {
      blocked.add(cellKey(cell));
      obstacles.push(cell);
    }
  }
  for (const cell of shuffled(all, random)) {
    const twin = mirrorCell(axis, size, cell);
    const group = sameCell(cell, twin) ? [cell] : [cell, twin];
    if (obstacles.length + group.length > shape.obstacles) continue;
    if (group.some(c => blocked.has(cellKey(c)))) continue;
    for (const c of group) {
      blocked.add(cellKey(c));
      obstacles.push(c);
    }
    if (obstacles.length >= shape.obstacles) break;
  }

  // Paths, grown in mirror groups until every free cell is on one.
  //
  // The board has to end up *full*. A set of paths that merely joins the
  // numbers and leaves half the grid blank is a weaker puzzle - the blank
  // squares are visibly doing nothing, and a player who has joined
  // everything is left looking at a board that plainly is not finished.
  // Filling the grid is the rule this kind of puzzle is actually built on,
  // and it is what makes a route *forced* rather than merely possible.
  //
  // Any failure here abandons the whole attempt rather than skipping the
  // offending start: with full coverage there is no such thing as leaving
  // a cell out, so there is nothing to skip to.
  const used = new Set<string>(blocked);
  const pairs: ArukonePair[] = [];
  const solution: Record<number, ArukoneCell[]> = {};
  let value = 1;
  const mirror = (cell: ArukoneCell) => mirrorCell(axis, size, cell);
  const maxLength = maxLengthFor(shape, obstacles.length);

  // Paths across the fold, grown on purpose. A path can only cross the
  // fold if it is its own mirror image, and left to chance the generator
  // all but never makes one - so every board came out as mirrored pairs on
  // either side, with at most one crossing path, always last. These are
  // grown first: half a path out from the fold (from a square on it, or one
  // beside its own mirror), then mirrored back the other way.
  for (let k = 0; k < crossing; k += 1) {
    const free = all.filter(cell => !used.has(cellKey(cell)));
    const starts = free.filter(cell => {
      const twin = mirror(cell);
      return (sameCell(cell, twin) || isAdjacentCell(cell, twin)) && !used.has(cellKey(twin));
    });
    if (starts.length === 0) return null;
    const start = shuffled(starts, random)[0];
    const twin = mirror(start);
    const onFold = sameCell(start, twin);
    const half = growPath(size, start, onFold ? used : new Set([...used, cellKey(twin)]), Math.max(3, Math.round(maxLengthFor(shape, obstacles.length) / 2) + 1), random);
    const halfKeys = new Set(half.map(cellKey));
    // The half may not touch its own mirror anywhere but the fold.
    if (half.some((cell, i) => (i > 0 || !onFold) && halfKeys.has(cellKey(mirror(cell))))) return null;
    const mirrored = half.map(mirror).reverse();
    const full = onFold ? [...mirrored.slice(0, -1), ...half] : [...mirrored, ...half];
    if (full.length < 4 || full.some(cell => used.has(cellKey(cell)))) return null;
    for (const cell of full) used.add(cellKey(cell));
    pairs.push({ value, a: full[0], b: full[full.length - 1] });
    solution[value] = full;
    value += 1;
  }

  while (used.size < size * size) {
    if (pairs.length >= shape.pairs) return null;
    const free = all.filter(cell => !used.has(cellKey(cell)));
    const start = shuffled(free, random)[0];

    const path = growPath(size, start, used, maxLength, random);
    // Under four cells there is no route to find. Three is the trap: a
    // self-symmetric three-cell path puts its two numbers either side of
    // the fold with one square between them, which the player solves by
    // dragging one cell - a free pair, and on a hard board a giveaway.
    if (path.length < 4) return null;

    const mirrored = path.map(cell => mirrorCell(axis, size, cell));
    const pathKeys = new Set(path.map(cellKey));
    const mirrorKeys = new Set(mirrored.map(cellKey));
    const sameCells = mirrorKeys.size === pathKeys.size && [...mirrorKeys].every(k => pathKeys.has(k));
    const overlaps = [...mirrorKeys].some(k => pathKeys.has(k));

    // The endpoints have to *swap*. Letting the fold fix them both
    // instead looks like it should be allowed, and is the degenerate
    // case: if the fold fixes both ends of a self-symmetric path it
    // fixes every cell of it, so the path is a straight run along the
    // fold line - one route, no decision, and nothing for the mirroring
    // to do. Those are not puzzles, and the drawing layer would have to
    // carry a whole second mode to handle them.
    const head = path[0];
    const tail = path[path.length - 1];
    const endpointsSwap =
      sameCell(mirrorCell(axis, size, head), tail) && sameCell(mirrorCell(axis, size, tail), head);

    if (sameCells && endpointsSwap) {
      // Self-symmetric: one path that is its own mirror.
      for (const key of pathKeys) used.add(key);
      pairs.push({ value, a: head, b: tail });
      solution[value] = path;
      value += 1;
      continue;
    }
    // Anything else that touches its own mirror - including a set-matching
    // path whose endpoints are not preserved - cannot be split into two
    // clean paths.
    if (overlaps) return null;
    if (pairs.length + 2 > shape.pairs) return null;
    // `used` is symmetric by construction, so this should always hold -
    // checked rather than assumed, because if it ever stops holding the
    // symptom is a board with no symmetric solution, which is exactly the
    // failure this generator exists to rule out.
    if ([...mirrorKeys].some(key => used.has(key))) return null;

    for (const key of pathKeys) used.add(key);
    for (const key of mirrorKeys) used.add(key);
    pairs.push({ value, a: head, b: tail });
    pairs.push({ value: value + 1, a: mirrored[0], b: mirrored[mirrored.length - 1] });
    solution[value] = path;
    solution[value + 1] = mirrored;
    value += 2;
  }

  if (pairs.length !== shape.pairs) return null;
  if (obstacles.length !== shape.obstacles) return null;

  // Two squares apart is still a pair with no decision in it - one
  // intermediate cell, and only ever one way through it. Real routes only.
  const tooEasy = pairs.some(
    pair => Math.abs(pair.a.row - pair.b.row) + Math.abs(pair.a.col - pair.b.col) <= 2,
  );
  if (tooEasy) return null;

  // Every endpoint must be distinct - two numbers cannot share a cell.
  const endpointKeys = pairs.flatMap(p => [cellKey(p.a), cellKey(p.b)]);
  if (new Set(endpointKeys).size !== endpointKeys.length) return null;

  // Numbered at random: a mirrored pair need not be 1 and 2, nor the path
  // across the fold the highest number - the numbers should not give the
  // board's shape away.
  const order = shuffled(pairs.map(p => p.value), random);
  const renumber = new Map(pairs.map((p, i) => [p.value, order[i]]));
  const renumbered = pairs.map(p => ({ ...p, value: renumber.get(p.value)! })).sort((x, y) => x.value - y.value);
  const resolved: Record<number, ArukoneCell[]> = {};
  for (const [v, path] of Object.entries(solution)) resolved[renumber.get(Number(v))!] = path;
  return { obstacles, pairs: renumbered, solution: resolved };
}

/** Paths come out one per pair, so the average path is this long. Capping
 * at the average (rather than above it) is what actually lands the pair
 * count on target - measured across tiers, a looser cap produces one
 * greedy path that swallows the board and a pair count of one. */
function maxLengthFor(shape: ArukoneShape, obstacles: number): number {
  return Math.max(4, Math.round((shape.size * shape.size - obstacles) / shape.pairs));
}

function isAdjacentCell(a: ArukoneCell, b: ArukoneCell): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

const AXES: ReadonlyArray<ArukoneAxis> = ['vertical', 'horizontal', 'rotational'];

/**
 * Builds the puzzle for `id`. Always returns the same board for the same
 * id - the seed is a hash of the id itself.
 *
 * Retries with a fresh seed until an attempt succeeds. The failure modes
 * are all "this random layout was not good enough", never "this id is
 * impossible", so the loop terminates in practice within a handful of
 * tries; the cap exists only so a pathological shape cannot hang the app.
 */
export function generateArukone(
  id: string,
  difficulty: PuzzleDifficulty,
  name?: string,
  /**
   * Shifts this id onto a different board without changing the id.
   *
   * Ids are frozen forever (`PlayerProgress` keys a best result per id),
   * so when two of them happened to generate the same board - and two
   * did, `arukone-004` being `arukone-001` turned a half turn - neither
   * could simply be renamed. This is the escape hatch: same id, same
   * determinism, different draw. `puzzles.ts` walks it upward until the
   * board is one the pool has not already shipped, which also means no
   * future id can quietly collide either.
   */
  salt = 0,
): ArukonePuzzle {
  return generatePlain(id, difficulty, name, salt);
}

function generatePlain(id: string, difficulty: PuzzleDifficulty, name: string | undefined, salt: number): ArukonePuzzle {
  const shape = shapeForDifficulty(difficulty);
  const base = hashId(id) + salt * 0x7f4a7c15;

  // Roughly one attempt in forty succeeds at the easier tiers and one in
  // a hundred and fifty at the hardest, and an attempt costs well under a
  // tenth of a millisecond - so the budget is set by what makes a
  // fall-through effectively impossible, not by what is usually needed.
  // The fold is chosen per board, in turn - left to chance, the rotational
  // one won almost every time, since it is the easiest to fill - and with
  // it how many paths cross the fold: one or three on an odd board (one
  // pair is left over to cross), none or two on an even one, where a path
  // can only cross a straight fold (a turned one has no squares beside
  // their own mirror).
  const fold = AXES[Math.floor(base) % AXES.length];
  const odd = shape.size % 2 === 1;
  const wanted = odd ? (shape.pairs >= 5 && Math.floor(base / 8) % 2 === 1 ? 3 : 1) : fold === 'rotational' ? 0 : Math.floor(base / 8) % 2 === 1 ? 2 : 0;
  // A straight fold on an odd board needs walls for the squares on the
  // fold no path crosses, so at least that many crossings.
  const crossings = odd && fold !== 'rotational' ? Math.max(wanted, shape.size - shape.obstacles) : wanted;
  for (let tries = 0; tries < 4000; tries += 1) {
    const random = mulberry32(base + tries * 0x9e3779b9);
    const late = tries >= 3000;
    const axis = late ? AXES[Math.floor(random() * AXES.length)] : fold;
    // An odd board always needs a path across: the squares on its fold can
    // be covered by nothing else.
    const result = attempt(shape, axis, random, late ? (odd ? 1 : 0) : crossings);
    if (result) {
      return { id, name, difficulty, size: shape.size, axis, obstacles: result.obstacles, pairs: result.pairs, solution: result.solution };
    }
  }

  // Falling back to a smaller shape is better than throwing in a player's
  // face; an easy board is still a board. Reaching here means the shape
  // itself is too tight, which the test suite is there to catch first.
  const relaxed: ArukoneShape = { ...shape, obstacles: 0, pairs: Math.max(2, shape.pairs - 1) };
  console.warn(`Arukone ${id}: falling back to a relaxed shape.`);
  for (let tries = 0; tries < 400; tries += 1) {
    // eslint-disable-next-line no-bitwise -- a different seed mix than the first pass
    const random = mulberry32(base ^ (tries * 0x85ebca6b));
    const axis = AXES[Math.floor(random() * AXES.length)];
    const result = attempt(relaxed, axis, random, shape.size % 2 === 1 ? 1 : 0);
    if (result) {
      return { id, name, difficulty, size: relaxed.size, axis, obstacles: result.obstacles, pairs: result.pairs, solution: result.solution };
    }
  }
  throw new Error(`Arukone ${id}: could not generate a board.`);
}
