import { creasesOf, flatSheet, foldSheet, matchesTarget, sheetOf } from './logic';
import { FolioFold, FolioPuzzle, FolioSheet, FolioState } from './types';

/**
 * The fewest folds from `sheet` to the target, or null if no folding
 * gets there. Breadth first, so the first answer is a shortest one. The
 * whole tree is small: every fold at least halves one side, so a 5x4
 * sheet has at most five folds in it and a few thousand sheets in all.
 */
export function shortestFolds(puzzle: Pick<FolioPuzzle, 'squares' | 'target'>, sheet: FolioSheet): FolioFold[] | null {
  let frontier: Array<{ sheet: FolioSheet; path: FolioFold[] }> = [{ sheet, path: [] }];
  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      if (matchesTarget(puzzle, node.sheet)) return node.path;
      // A side already shorter than the target's can never grow back.
      if (node.sheet.width < puzzle.target.width || node.sheet.height < puzzle.target.height) continue;
      for (const fold of creasesOf(node.sheet)) next.push({ sheet: foldSheet(node.sheet, fold), path: [...node.path, fold] });
    }
    frontier = next;
  }
  return null;
}

/** The fewest folds that make the target from the flat sheet. */
export function parFor(puzzle: FolioPuzzle): number {
  const path = shortestFolds(puzzle, flatSheet(puzzle));
  return path ? path.length : -1;
}

/** The rest of the way from the board as it stands, if there is one. */
export function solveFolio(puzzle: FolioPuzzle, state: FolioState): FolioFold[] | null {
  return shortestFolds(puzzle, sheetOf(puzzle, state));
}

export function assertValidFolio(puzzle: FolioPuzzle): void {
  const { width, height, squares, target } = puzzle;
  if (squares.length !== width * height) throw new Error(`Folio ${puzzle.id}: ${squares.length} squares on a ${width}x${height} sheet.`);
  if (squares.some(s => s.front === s.back)) throw new Error(`Folio ${puzzle.id}: a square is the same on both sides.`);
  if (target.inks.length !== target.width * target.height) throw new Error(`Folio ${puzzle.id}: the target does not fill its shape.`);
  if (target.inks.length < 2) throw new Error(`Folio ${puzzle.id}: a one-square target.`);
  if (new Set(target.inks).size < 2) throw new Error(`Folio ${puzzle.id}: a target of one colour.`);
  const par = parFor(puzzle);
  if (par !== puzzle.par) throw new Error(`Folio ${puzzle.id}: par is ${par}, not ${puzzle.par}.`);
  if (par < 1) throw new Error(`Folio ${puzzle.id}: already solved as dealt.`);
}
