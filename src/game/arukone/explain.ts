import { HintReason } from '../hints';
import { isPathComplete } from './logic';
import { revealArukoneHint } from './play';
import { ArukonePuzzle, ArukoneState } from './types';

/**
 * Joins the pair with the fewest choices: the unfinished pair whose path
 * is shortest, the one a player would usually see first, instead of
 * whichever number happens to be lowest.
 */
export function explainArukoneHint(puzzle: ArukonePuzzle, state: ArukoneState): (HintReason & { state: ArukoneState; value: number }) | null {
  const unsolved = puzzle.pairs.filter(pair => !isPathComplete(pair, state.paths[pair.value] ?? []));
  if (unsolved.length === 0) return null;
  const target = [...unsolved].sort((a, b) => (puzzle.solution[a.value]?.length ?? 99) - (puzzle.solution[b.value]?.length ?? 99))[0];
  const next = revealArukoneHint(puzzle, state, target.value);
  if (!next) return null;
  return { state: next, value: target.value, kind: 'rule', reason: `The ${target.value}s have only one way to meet that leaves room for every other pair.` };
}
