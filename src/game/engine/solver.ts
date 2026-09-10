import { applyGravity } from './gravity';
import { isPuzzleSolved } from './completion';
import { ALL_DIRECTIONS, Direction, GameState } from './types';

/** Serializes the movable positions of a state for de-duplication in the
 * solver's search - two states with the same set of (row, col) positions
 * are equivalent for gravity/completion purposes regardless of which
 * specific object id sits where. Anchored objects are omitted: they are
 * identical in every reachable state, so they add nothing to the key. */
function serialize(state: GameState): string {
  return state.movables
    .filter(m => !m.anchored)
    .map(m => `${m.row}:${m.col}`)
    .sort()
    .join('|');
}

/**
 * Breadth-first search for the shortest sequence of gravity moves that
 * solves `initial`.
 *
 * This is verification/tooling, not a player-facing hint system: it exists
 * so hand-authored levels can be checked automatically - every level must
 * be solvable, and this also reveals how many moves the *shortest*
 * solution actually takes (used to catch levels that are accidentally
 * trivial, or accidentally impossible, before they ship).
 *
 * Pure and deterministic. Returns `null` if no solution exists within
 * `maxMoves`.
 */
export function findShortestSolution(
  initial: GameState,
  maxMoves = 20,
): Direction[] | null {
  if (isPuzzleSolved(initial)) return [];

  interface Node {
    readonly state: GameState;
    readonly path: ReadonlyArray<Direction>;
  }

  let frontier: Node[] = [{ state: initial, path: [] }];
  const visited = new Set<string>([serialize(initial)]);

  for (let depth = 0; depth < maxMoves; depth += 1) {
    const nextFrontier: Node[] = [];

    for (const node of frontier) {
      for (const direction of ALL_DIRECTIONS) {
        const candidate = applyGravity(node.state, direction);
        const candidateKey = serialize(candidate);

        if (candidateKey === serialize(node.state)) continue; // no-op move
        if (visited.has(candidateKey)) continue;

        const path = [...node.path, direction];

        if (isPuzzleSolved(candidate)) {
          return path;
        }

        visited.add(candidateKey);
        nextFrontier.push({ state: candidate, path });
      }
    }

    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  return null;
}
