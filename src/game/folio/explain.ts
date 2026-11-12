import { count, HintReason } from '../hints';
import { applyFold, foldingSide, sheetOf } from './logic';
import { shortestFolds, solveFolio } from './solver';
import { FolioFold, FolioPuzzle, FolioSheet, FolioState } from './types';

/** "the crease between columns 2 and 3", and which part turns over. */
export function describeFold(sheet: FolioSheet, fold: FolioFold): { crease: string; side: string } {
  const side = foldingSide(sheet, fold);
  if (fold.axis === 'v') {
    return { crease: `the crease between columns ${fold.at} and ${fold.at + 1}`, side: side === 'low' ? 'the left side' : 'the right side' };
  }
  return { crease: `the crease between rows ${fold.at} and ${fold.at + 1}`, side: side === 'low' ? 'the top' : 'the bottom' };
}

const TIP = 'A square that turns over shows the colour of its folded corner. Find the squares that must change, and fold the side they are on.';

/**
 * The next fold on a shortest way to the target from the sheet as it is.
 * If the folds so far can no longer get there, it unfolds them back to
 * the last point that still can and makes the right fold from there.
 */
export function explainFolioHint(puzzle: FolioPuzzle, state: FolioState): ({ state: FolioState; fold: FolioFold } & HintReason) | null {
  const ahead = solveFolio(puzzle, state);
  if (ahead && ahead.length > 0) {
    const sheet = sheetOf(puzzle, state);
    const { crease, side } = describeFold(sheet, ahead[0]);
    const left = ahead.length - 1;
    return {
      fold: ahead[0],
      state: applyFold(puzzle, state, ahead[0]),
      kind: 'rule',
      reason: left > 0 ? `Fold along ${crease}: ${side} turns over. ${count(left, 'more fold')} after this one.` : `Fold along ${crease}: ${side} turns over, and the sheet shows the target.`,
      tip: TIP,
    };
  }
  if (ahead) return null;
  for (let keep = state.folds.length - 1; keep >= 0; keep -= 1) {
    const back: FolioState = { folds: state.folds.slice(0, keep) };
    const sheet = sheetOf(puzzle, back);
    const path = shortestFolds(puzzle, sheet);
    if (!path || path.length === 0) continue;
    const { crease, side } = describeFold(sheet, path[0]);
    const undone = state.folds.length - keep;
    return {
      fold: path[0],
      state: applyFold(puzzle, back, path[0]),
      kind: 'fix',
      reason: `The sheet cannot make the target from here, so ${undone === 1 ? 'the last fold is' : `the last ${undone} folds are`} opened out. Then fold along ${crease}: ${side} turns over.`,
      tip: TIP,
    };
  }
  return null;
}
