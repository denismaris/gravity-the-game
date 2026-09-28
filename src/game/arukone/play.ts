import {
  cellKey,
  isAdjacent,
  isOnAxis,
  isPathComplete,
  mirrorCell,
  mirrorPairOf,
  obstacleSet,
  pairFor,
  sameCell,
} from './logic';
import { ArukoneCell, ArukonePair, ArukonePuzzle, ArukoneState } from './types';

/**
 * The drawing layer: every way a touch can change an Arukone+ board.
 *
 * Pure and React-free, like the rest of this module, but it is also where
 * this game's one real design decision lives. The player draws in one half
 * of the board; the other half is written at the same time, by this file,
 * from the same gesture. Symmetry is therefore not a rule that can be
 * broken and reported - it is a property of every state that can exist.
 *
 * Illegal moves are refused rather than recorded and flagged. A board that
 * always holds a legal position is worth more than one that lets a player
 * build a tangle and then explains, several moves later, that it was
 * doomed from the third one. `isArukoneSolved`'s own crossing check stays
 * as an independent guard - nothing here is allowed to be the only thing
 * standing between the player and an invalid board.
 */

/** A pair whose two endpoints are each other's mirror image: the one pair
 * on a board that folds onto itself, and so is drawn from both ends at
 * once rather than paired off with a partner elsewhere. */
export function isSelfSymmetric(puzzle: ArukonePuzzle, pair: ArukonePair): boolean {
  const twin = mirrorPairOf(puzzle, pair);
  return twin !== undefined && twin.value === pair.value;
}

/**
 * A pair that is genuinely drawn from both ends at once.
 *
 * Not every self-symmetric pair is. If the fold *fixes* both of a pair's
 * numbers rather than swapping them, it fixes every cell of any symmetric
 * path between them too - such a path is a straight run along the fold
 * line with no second arm to grow, and folding it would splice it onto
 * itself and revisit its own cells. `generateArukone` never produces one;
 * this check is what makes that a design decision rather than an
 * assumption the drawing layer would corrupt a board over.
 */
function foldsFromBothEnds(puzzle: ArukonePuzzle, pair: ArukonePair): boolean {
  return isSelfSymmetric(puzzle, pair) && !isOnAxis(puzzle.axis, puzzle.size, pair.a);
}

function mirrorOf(puzzle: ArukonePuzzle, cell: ArukoneCell): ArukoneCell {
  return mirrorCell(puzzle.axis, puzzle.size, cell);
}

/** Whether a self-symmetric pair's two arms have met - on the fold line
 * itself, or by ending on adjacent cells either side of it. */
function armsMeet(puzzle: ArukonePuzzle, half: ReadonlyArray<ArukoneCell>): boolean {
  if (half.length === 0) return false;
  const head = half[half.length - 1];
  const reflected = mirrorOf(puzzle, head);
  return sameCell(head, reflected) || isAdjacent(head, reflected);
}

/**
 * A self-symmetric pair's full run, built from the half the player drew:
 * the half, then its mirror walked back the other way. A cell sitting on
 * the fold is shared by both arms and appears once.
 */
function fold(puzzle: ArukonePuzzle, half: ReadonlyArray<ArukoneCell>): ArukoneCell[] {
  const head = half[half.length - 1];
  const reflected = half.map(cell => mirrorOf(puzzle, cell));
  const other = isOnAxis(puzzle.axis, puzzle.size, head) ? reflected.slice(0, -1) : reflected;
  return [...half, ...other.reverse()];
}

/**
 * The half a stored run came from.
 *
 * A self-symmetric run is only ever stored folded once its arms have met,
 * and a folded run is complete - so `isPathComplete` is exactly the test
 * for "this needs unfolding", and a symmetric run's first half is its
 * first `ceil(n / 2)` cells either way (odd means the middle cell sits on
 * the fold and belongs to both arms).
 */
function halfOf(
  puzzle: ArukonePuzzle,
  pair: ArukonePair,
  run: ReadonlyArray<ArukoneCell>,
): ReadonlyArray<ArukoneCell> {
  if (!foldsFromBothEnds(puzzle, pair)) return run;
  if (!isPathComplete(pair, run)) return run;
  return run.slice(0, Math.ceil(run.length / 2));
}

/** The half currently drawn for `pair`, or an empty run. */
export function drawnHalf(
  puzzle: ArukonePuzzle,
  state: ArukoneState,
  pair: ArukonePair,
): ReadonlyArray<ArukoneCell> {
  return halfOf(puzzle, pair, state.paths[pair.value] ?? []);
}

/**
 * The arm mirrored in from `pair`'s own half but not yet part of its
 * stored run - a self-symmetric pair's second arm, before the two meet.
 * Purely something to draw: it is implied by the half, so storing it would
 * be storing the same thing twice.
 */
export function pendingArm(
  puzzle: ArukonePuzzle,
  state: ArukoneState,
  pair: ArukonePair,
): ReadonlyArray<ArukoneCell> {
  if (!foldsFromBothEnds(puzzle, pair)) return [];
  const run = state.paths[pair.value] ?? [];
  if (run.length === 0 || isPathComplete(pair, run)) return [];
  return run.map(cell => mirrorOf(puzzle, cell));
}

/** Writes `half` in for `pair`, mirroring it into whichever pair takes the
 * other side - a partner pair, or this pair's own second arm. */
function withHalf(
  puzzle: ArukonePuzzle,
  state: ArukoneState,
  pair: ArukonePair,
  half: ReadonlyArray<ArukoneCell>,
): ArukoneState {
  const paths: Record<number, ReadonlyArray<ArukoneCell>> = { ...state.paths };
  if (foldsFromBothEnds(puzzle, pair)) {
    paths[pair.value] = armsMeet(puzzle, half) ? fold(puzzle, half) : half;
    return { paths };
  }
  paths[pair.value] = half;
  const twin = mirrorPairOf(puzzle, pair);
  if (twin && twin.value !== pair.value) paths[twin.value] = half.map(cell => mirrorOf(puzzle, cell));
  return { paths };
}

/** Clears `pair`'s path and the one mirrored from it - they are drawn by
 * one gesture, so they are cleared by one action too. */
export function clearPair(puzzle: ArukonePuzzle, state: ArukoneState, pair: ArukonePair): ArukoneState {
  const paths: Record<number, ReadonlyArray<ArukoneCell>> = { ...state.paths };
  delete paths[pair.value];
  const twin = mirrorPairOf(puzzle, pair);
  if (twin) delete paths[twin.value];
  return { paths };
}

/** Every cell held by a pair other than `pair` and its mirror partner. */
function blockedByOthers(
  puzzle: ArukonePuzzle,
  state: ArukoneState,
  pair: ArukonePair,
): ReadonlySet<string> {
  const twin = mirrorPairOf(puzzle, pair);
  const mine = new Set<number>([pair.value, ...(twin ? [twin.value] : [])]);
  const taken = new Set<string>();
  for (const [valueText, run] of Object.entries(state.paths)) {
    if (mine.has(Number(valueText))) continue;
    for (const cell of run) taken.add(cellKey(cell));
  }
  return taken;
}

export interface DrawStart {
  readonly state: ArukoneState;
  /** The pair the gesture is now drawing. */
  readonly value: number;
}

/**
 * Begins (or resumes) a gesture at `cell`.
 *
 * Touching a number starts that pair fresh. Touching a cell of a path
 * already on the board picks that path back up there, dropping whatever
 * came after - the standard "drag back along the line to undo it" of this
 * kind of puzzle, and the reason a wrong turn costs one drag rather than a
 * restart. Anywhere else, nothing happens.
 */
export function beginDraw(puzzle: ArukonePuzzle, state: ArukoneState, cell: ArukoneCell): DrawStart | null {
  const endpoint = puzzle.pairs.find(pair => sameCell(pair.a, cell) || sameCell(pair.b, cell));
  if (endpoint) {
    const cleared = clearPair(puzzle, state, endpoint);
    return { state: withHalf(puzzle, cleared, endpoint, [cell]), value: endpoint.value };
  }

  for (const pair of puzzle.pairs) {
    const run = state.paths[pair.value];
    if (!run || run.length === 0) continue;
    // A self-symmetric run holds both arms once joined, so the touched
    // cell may belong to the half drawn from either end. Both are real
    // halves of the same run - whichever contains the cell is the one this
    // gesture continues from.
    const candidates = foldsFromBothEnds(puzzle, pair)
      ? [halfOf(puzzle, pair, run), halfOf(puzzle, pair, [...run].reverse())]
      : [run];
    for (const half of candidates) {
      const index = half.findIndex(c => sameCell(c, cell));
      if (index < 0) continue;
      const cleared = clearPair(puzzle, state, pair);
      return { state: withHalf(puzzle, cleared, pair, half.slice(0, index + 1)), value: pair.value };
    }
  }
  return null;
}

/**
 * Extends the path being drawn for `value` to `cell`, or walks it back if
 * `cell` is the step before the current head. Returns `state` unchanged
 * when the move is not a legal one - `cell` not adjacent, an obstacle,
 * another number, a cell either this path or its own mirror already holds,
 * or a cell another pair has taken.
 */
export function extendDraw(
  puzzle: ArukonePuzzle,
  state: ArukoneState,
  value: number,
  cell: ArukoneCell,
): ArukoneState {
  const pair = pairFor(puzzle, value);
  if (!pair) return state;
  const half = drawnHalf(puzzle, state, pair);
  if (half.length === 0) return state;

  const head = half[half.length - 1];
  if (sameCell(head, cell)) return state;
  // Walking back down the line the player just drew.
  if (half.length >= 2 && sameCell(half[half.length - 2], cell)) {
    return withHalf(puzzle, state, pair, half.slice(0, -1));
  }
  // Once a pair is joined there is nothing left to extend; the player has
  // to drag back into it first, which the branch above handles.
  if (isPathComplete(pair, state.paths[value] ?? [])) return state;
  if (!isAdjacent(head, cell)) return state;

  if (cell.row < 0 || cell.col < 0 || cell.row >= puzzle.size || cell.col >= puzzle.size) return state;
  if (obstacleSet(puzzle).has(cellKey(cell))) return state;
  if (half.some(c => sameCell(c, cell))) return state;

  // Any endpoint other than this pair's own far end is somebody else's
  // number, and no path may run through one.
  const otherEndpoint = puzzle.pairs.some(
    other => other.value !== value && (sameCell(other.a, cell) || sameCell(other.b, cell)),
  );
  if (otherEndpoint) return state;

  const reflected = mirrorOf(puzzle, cell);
  // The mirror image is about to be drawn too, so it has to be free on the
  // same terms. A cell that reflects onto this very path would have the
  // pair cross its own twin - legal to attempt, never part of a solution.
  if (!sameCell(reflected, cell) && half.some(c => sameCell(c, reflected))) return state;

  const taken = blockedByOthers(puzzle, state, pair);
  if (taken.has(cellKey(cell)) || taken.has(cellKey(reflected))) return state;

  return withHalf(puzzle, state, pair, [...half, cell]);
}

/**
 * Fills in one unsolved pair from the board's own known solution, clearing
 * anything in its way. The pair with the least drawn so far, so repeated
 * hints spread across the board rather than piling onto one number.
 */
export function revealArukoneHint(puzzle: ArukonePuzzle, state: ArukoneState): ArukoneState | null {
  const unsolved = puzzle.pairs.filter(pair => !isPathComplete(pair, state.paths[pair.value] ?? []));
  if (unsolved.length === 0) return null;

  const target = unsolved.reduce((best, pair) =>
    (state.paths[pair.value]?.length ?? 0) < (state.paths[best.value]?.length ?? 0) ? pair : best,
  );
  const answer = puzzle.solution[target.value];
  if (!answer || answer.length === 0) return null;

  // The answer needs the cells it needs, so anything of another pair's
  // sitting on them goes - a hint that lands the player in an illegal
  // position would be worse than no hint.
  const wanted = new Set(answer.map(cellKey));
  let next: ArukoneState = state;
  for (const pair of puzzle.pairs) {
    if (pair.value === target.value) continue;
    const run = next.paths[pair.value];
    if (run && run.some(c => wanted.has(cellKey(c)))) next = clearPair(puzzle, next, pair);
  }

  const cleared = clearPair(puzzle, next, target);
  const half = halfOf(puzzle, target, answer);
  return withHalf(puzzle, cleared, target, half);
}
