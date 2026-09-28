import {
  applyTap,
  cascadeScore,
  groupAt,
  hasLegalMove,
  initialAdjacentState,
  isAdjacentSolved,
  isAdjacentStuck,
  isLegalTap,
  legalMoves,
  multiplierFor,
  settle,
  tileCount,
} from '../logic';
import { assertValidAdjacent, reachesTargetWithin, replayLine, searchBestScore } from '../solver';
import { generateAdjacent, minTapsToTargetFor, shapeForDifficulty } from '../generator';
import { ADJACENT, getAdjacentByDifficulty, getAdjacentById } from '../puzzles';
import { AdjacentCell, AdjacentPuzzle } from '../types';

/**
 * Boards are written as strings for legibility: a digit is that colour,
 * a dot is an empty square. Row 0 is the top, so these read exactly as
 * they appear on screen.
 */
function fromRows(rows: ReadonlyArray<string>, overrides: Partial<AdjacentPuzzle> = {}): AdjacentPuzzle {
  const grid: AdjacentCell[][] = rows.map(row =>
    row.split('').map(ch => (ch === '.' ? null : Number(ch))),
  );
  return {
    id: 'fixture',
    difficulty: 'easy',
    size: rows.length,
    colors: 5,
    initial: grid,
    targetScore: 100,
    ...overrides,
  };
}

/** A deterministic stand-in for `Math.random`, so a search in a test is
 * reproducible run to run. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('groupAt - the connected run under a tap', () => {
  const puzzle = fromRows([
    '......',
    '......',
    '......',
    '.11...',
    '.121..',
    '111.2.',
  ]);

  test('collects every orthogonally connected tile of the same colour', () => {
    const group = groupAt(puzzle.initial, 5, 0);
    expect(group).toHaveLength(6);
  });

  test('stops at a different colour', () => {
    expect(groupAt(puzzle.initial, 4, 2)).toHaveLength(1);
  });

  test('never connects through a diagonal', () => {
    // The lone 2 at row 5 col 4 touches row 4 col 3's 1 only diagonally.
    expect(groupAt(puzzle.initial, 5, 4)).toHaveLength(1);
  });

  test('an empty square has no run at all', () => {
    expect(groupAt(puzzle.initial, 0, 0)).toEqual([]);
  });

  test('a coordinate off the board is handled rather than thrown', () => {
    expect(groupAt(puzzle.initial, -1, 0)).toEqual([]);
    expect(groupAt(puzzle.initial, 0, 99)).toEqual([]);
  });

  test('isLegalTap needs two - a lone tile is not a move', () => {
    expect(isLegalTap(puzzle.initial, 5, 0)).toBe(true);
    expect(isLegalTap(puzzle.initial, 5, 4)).toBe(false);
    expect(isLegalTap(puzzle.initial, 0, 0)).toBe(false);
  });
});

describe('scoring', () => {
  test('the bands are the ones the player is shown', () => {
    expect(multiplierFor(2)).toBe(1);
    expect(multiplierFor(3)).toBe(1);
    expect(multiplierFor(4)).toBe(2);
    expect(multiplierFor(5)).toBe(2);
    expect(multiplierFor(6)).toBe(3);
    expect(multiplierFor(7)).toBe(3);
    expect(multiplierFor(8)).toBe(5);
    expect(multiplierFor(20)).toBe(5);
  });

  test('a run below the minimum is worth nothing', () => {
    expect(cascadeScore(0)).toBe(0);
    expect(cascadeScore(1)).toBe(0);
  });

  test('the first tile of a run pays nothing - the connection scores', () => {
    expect(cascadeScore(2)).toBe(100);
    expect(cascadeScore(3)).toBe(200);
  });

  test('a bigger run is worth strictly more, both in total and per tile', () => {
    for (let n = 2; n < 20; n += 1) {
      expect(cascadeScore(n + 1)).toBeGreaterThan(cascadeScore(n));
      expect(cascadeScore(n + 1) / (n + 1)).toBeGreaterThan(cascadeScore(n) / n - 1e-9);
    }
  });
});

describe('settle - gravity', () => {
  test('drops tiles to the floor of their own column and reports the fall', () => {
    const { grid, falls } = settle(fromRows(['.1.', '...', '.2.']).initial);
    expect(grid[2][1]).toBe(2);
    expect(grid[1][1]).toBe(1);
    expect(grid[0][1]).toBeNull();
    expect(falls).toEqual([{ col: 1, fromRow: 0, toRow: 1 }]);
  });

  test('a column that is already settled does not move', () => {
    const { falls } = settle(fromRows(['...', '.1.', '.2.']).initial);
    expect(falls).toEqual([]);
  });

  test('columns are independent - an emptied one stays empty, nothing slides sideways', () => {
    const { grid } = settle(fromRows(['1..', '2..', '3..']).initial);
    expect(grid.map(row => row[0])).toEqual([1, 2, 3]);
    expect(grid.every(row => row[1] === null && row[2] === null)).toBe(true);
  });

  test('preserves every tile it moves', () => {
    const before = fromRows(['12.', '.3.', '..4']).initial;
    expect(tileCount(settle(before).grid)).toBe(tileCount(before));
  });
});

describe('applyTap', () => {
  const puzzle = fromRows([
    '....',
    '3...',
    '1...',
    '1123',
  ]);

  test('clears the run, scores it, and settles what was above', () => {
    const move = applyTap(initialAdjacentState(puzzle), 3, 0);
    expect(move).not.toBeNull();
    // Four 1s connected: (3,0) (3,1) (2,0) and... (3,1)'s neighbour (3,2)
    // is a 2, so the run is three tiles.
    expect(move!.removed).toHaveLength(3);
    expect(move!.gained).toBe(cascadeScore(3));
    expect(move!.state.score).toBe(cascadeScore(3));
    expect(move!.state.cascades).toBe(1);
    // The 3 that sat on top of the column falls to the floor.
    expect(move!.state.grid[3][0]).toBe(3);
    expect(move!.falls).toContainEqual({ col: 0, fromRow: 1, toRow: 3 });
  });

  test('refuses a tap on a lone tile, and on an empty square', () => {
    const state = initialAdjacentState(puzzle);
    expect(applyTap(state, 3, 2)).toBeNull();
    expect(applyTap(state, 0, 0)).toBeNull();
  });

  test('never invents or loses tiles', () => {
    const state = initialAdjacentState(puzzle);
    const move = applyTap(state, 3, 0)!;
    expect(tileCount(move.state.grid)).toBe(tileCount(state.grid) - move.removed.length);
  });

  test('leaves the board it was given untouched', () => {
    const state = initialAdjacentState(puzzle);
    const before = JSON.stringify(state);
    applyTap(state, 3, 0);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('legalMoves', () => {
  test('reports one tap per run, not one per tile', () => {
    const puzzle = fromRows(['....', '....', '11..', '1122']);
    const moves = legalMoves(puzzle.initial);
    expect(moves).toHaveLength(2);
  });

  test('agrees with hasLegalMove on a dead board', () => {
    const dead = fromRows(['....', '....', '....', '1212']);
    expect(hasLegalMove(dead.initial)).toBe(false);
    expect(legalMoves(dead.initial)).toEqual([]);
  });

  test('an empty board has no moves and is not a crash', () => {
    const empty = fromRows(['..', '..']);
    expect(hasLegalMove(empty.initial)).toBe(false);
    expect(legalMoves(empty.initial)).toEqual([]);
  });
});

describe('finishing', () => {
  const puzzle = fromRows(['....', '....', '....', '1122'], { targetScore: 500 });

  test('reaching the target finishes the board', () => {
    const state = { ...initialAdjacentState(puzzle), score: 500 };
    expect(isAdjacentSolved(puzzle, state)).toBe(true);
    expect(isAdjacentStuck(puzzle, state)).toBe(false);
  });

  test('clearing the board finishes it even from under the target', () => {
    const state = { grid: fromRows(['..', '..']).initial, score: 10, cascades: 9 };
    expect(isAdjacentSolved(puzzle, state)).toBe(true);
  });

  test('out of moves and short of the target is stuck, not solved', () => {
    const state = { grid: fromRows(['....', '....', '....', '1212']).initial, score: 100, cascades: 1 };
    expect(isAdjacentSolved(puzzle, state)).toBe(false);
    expect(isAdjacentStuck(puzzle, state)).toBe(true);
  });
});

describe('generation', () => {
  test('is deterministic - the same id always deals the same board', () => {
    const a = generateAdjacent('adjacent-test-01', 'A', 'easy');
    const b = generateAdjacent('adjacent-test-01', 'A', 'easy');
    expect(a.initial).toEqual(b.initial);
  });

  test('different ids deal different boards', () => {
    const a = generateAdjacent('adjacent-test-01', 'A', 'easy');
    const b = generateAdjacent('adjacent-test-02', 'B', 'easy');
    expect(a.initial).not.toEqual(b.initial);
  });

  test('deals a board that is already settled, so nothing falls before the first tap', () => {
    const puzzle = generateAdjacent('adjacent-test-03', 'C', 'medium');
    expect(settle(puzzle.initial).falls).toEqual([]);
  });
});

describe('the shipped pool', () => {
  test('every id round-trips', () => {
    for (const puzzle of ADJACENT) expect(getAdjacentById(puzzle.id)).toBe(puzzle);
    expect(getAdjacentById('adjacent-nope')).toBeUndefined();
  });

  test('difficulty filters partition the pool with no overlap', () => {
    const easy = getAdjacentByDifficulty('easy');
    const medium = getAdjacentByDifficulty('medium');
    const hard = getAdjacentByDifficulty('hard');
    expect(easy.length + medium.length + hard.length).toBe(ADJACENT.length);
    expect(new Set([...easy, ...medium, ...hard]).size).toBe(ADJACENT.length);
  });

  test('every board matches its own tier\'s declared shape', () => {
    for (const puzzle of ADJACENT) {
      const shape = shapeForDifficulty(puzzle.difficulty);
      expect(puzzle.size).toBe(shape.size);
      expect(puzzle.colors).toBe(shape.colors);
      expect(puzzle.targetScore).toBe(shape.targetScore);
      expect(tileCount(puzzle.initial)).toBe(Math.round(shape.fill * shape.size * shape.size));
    }
  });

  test('every shipped board is exactly what its own id generates', () => {
    // `puzzles.ts` holds these as literal rows rather than calling the
    // generator at module load - building the pool measured ~970ms in
    // Node against Lights Out's 4ms, which is a second of blocked
    // JavaScript on every cold start. That makes the literals a *cache*,
    // and this is the test that stops a cache going stale: regenerate
    // each board from its id and require a tile-for-tile match. Change
    // the generator and this fails until the literals are re-emitted,
    // which is the intended workflow rather than a nuisance.
    for (const puzzle of ADJACENT) {
      const regenerated = generateAdjacent(puzzle.id, puzzle.name ?? '', puzzle.difficulty);
      expect(regenerated.initial).toEqual(puzzle.initial);
      expect(regenerated.targetScore).toBe(puzzle.targetScore);
      expect(regenerated.colors).toBe(puzzle.colors);
      expect(regenerated.size).toBe(puzzle.size);
    }
  });

  test('targets climb with difficulty, and so does the share of the board they ask for', () => {
    expect(shapeForDifficulty('easy').targetScore).toBeLessThan(shapeForDifficulty('medium').targetScore);
    expect(shapeForDifficulty('medium').targetScore).toBeLessThan(shapeForDifficulty('hard').targetScore);
  });
});

describe.each(ADJACENT.map(p => [p.id, p] as const))('%s', (_id, puzzle) => {
  test('is structurally valid and provably beatable', () => {
    expect(() =>
      assertValidAdjacent(puzzle, {
        rng: seededRandom(7),
        minTapsToTarget: minTapsToTargetFor(puzzle.difficulty),
      }),
    ).not.toThrow();
  });

  test('its target takes a sequence of clears, not one lucky run', () => {
    // The regression this locks down actually shipped for a moment: a
    // medium board held a five-tile run worth exactly its 800 target, so
    // tapping it once on the opening position won the whole puzzle. Every
    // check at the time passed, because they all asked "can this be won"
    // and the answer was an emphatic yes.
    expect(reachesTargetWithin(puzzle, minTapsToTargetFor(puzzle.difficulty) - 1)).toBe(false);
  });

  test('its target is reached by a line that actually replays under the real rules', () => {
    // The search's own claimed score is not taken on trust: the sequence
    // it found is replayed move by move through `applyTap`, and both the
    // final score and the target are checked against *that*. A search bug
    // that inflated its own number would otherwise pass a suite that only
    // ever asked the search.
    const best = searchBestScore(puzzle, { rng: seededRandom(11) });
    const replayed = replayLine(puzzle, best.taps);
    expect(replayed).not.toBeNull();
    expect(replayed!.score).toBe(best.score);
    expect(replayed!.score).toBeGreaterThanOrEqual(puzzle.targetScore);
    expect(isAdjacentSolved(puzzle, replayed!)).toBe(true);
  });
});

describe('assertValidAdjacent rejects boards a player should never see', () => {
  const base = fromRows(['....', '....', '11..', '1122'], { targetScore: 100 });

  test('a floating tile - the board as dealt must already be settled', () => {
    expect(() => assertValidAdjacent(fromRows(['1...', '....', '....', '....']))).toThrow(/floating/);
  });

  test('a colour outside the declared palette', () => {
    expect(() => assertValidAdjacent({ ...base, colors: 2 })).toThrow(/palette/);
  });

  test('a board with no legal move anywhere', () => {
    expect(() => assertValidAdjacent(fromRows(['....', '....', '....', '1212']))).toThrow(/no legal move/);
  });

  test('a target no line of play can reach', () => {
    expect(() => assertValidAdjacent({ ...base, targetScore: 999999 })).toThrow(/unreachable/);
  });

  test('a target that falls to a single tap', () => {
    // One run of four, worth 600, against a target of 100.
    const oneTap = fromRows(['....', '....', '.11.', '.11.'], { targetScore: 100 });
    expect(() => assertValidAdjacent(oneTap)).toThrow(/fewer than/);
  });

  test('a ragged grid', () => {
    expect(() => assertValidAdjacent({ ...base, size: 5 })).toThrow(/rows/);
  });
});
