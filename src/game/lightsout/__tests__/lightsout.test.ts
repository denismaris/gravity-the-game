import { initialLightsOutState, isLightsOutSolved, litCount, press, pressedCells } from '../logic';
import { assertValidLightsOut, parFor, revealLightsOutHint, solveLightsOut } from '../solver';
import { generateLightsOut, shapeForDifficulty } from '../generator';
import { getLightsOutByDifficulty, getLightsOutById, LIGHTS_OUT } from '../puzzles';
import { LightsOutPuzzle, LightsOutState } from '../types';

function fromRows(rows: ReadonlyArray<string>, id = 'fixture'): LightsOutPuzzle {
  return {
    id,
    difficulty: 'easy',
    size: rows.length,
    initial: rows.map(row => row.split('').map(ch => ch === '#')),
    // Fixtures declare a nominal par; the tests that care compute the
    // real one via `parFor` instead of trusting this.
    par: 1,
  };
}

describe('pressedCells - the cross, clipped at the edge', () => {
  test('a centre press flips itself and four neighbours', () => {
    expect(pressedCells(5, 2, 2)).toHaveLength(5);
  });

  test('a corner press flips only three cells', () => {
    expect(pressedCells(5, 0, 0)).toHaveLength(3);
  });

  test('an edge press flips four', () => {
    expect(pressedCells(5, 0, 2)).toHaveLength(4);
  });

  test('never includes a diagonal neighbour', () => {
    const cells = pressedCells(5, 2, 2);
    expect(cells.some(c => c.row === 1 && c.col === 1)).toBe(false);
    expect(cells.some(c => c.row === 3 && c.col === 3)).toBe(false);
  });
});

describe('press', () => {
  const puzzle = fromRows(['.....', '.....', '.....', '.....', '.....']);

  test('flips the pressed cell and its orthogonal neighbours', () => {
    const next = press(initialLightsOutState(puzzle), 5, 2, 2);
    expect(next.lights[2][2]).toBe(true);
    expect(next.lights[1][2]).toBe(true);
    expect(next.lights[3][2]).toBe(true);
    expect(next.lights[2][1]).toBe(true);
    expect(next.lights[2][3]).toBe(true);
    expect(next.lights[1][1]).toBe(false);
    expect(litCount(next)).toBe(5);
  });

  test('is its own inverse - pressing twice restores the board', () => {
    const start = initialLightsOutState(puzzle);
    const twice = press(press(start, 5, 1, 3), 5, 1, 3);
    expect(twice).toEqual(start);
  });

  test('presses commute - order never changes the result', () => {
    const start = initialLightsOutState(puzzle);
    const ab = press(press(start, 5, 0, 0), 5, 3, 4);
    const ba = press(press(start, 5, 3, 4), 5, 0, 0);
    expect(ab).toEqual(ba);
  });
});

describe('solveLightsOut', () => {
  test('a solved board needs no presses at all', () => {
    const puzzle = fromRows(['.....', '.....', '.....', '.....', '.....']);
    expect(solveLightsOut(puzzle, initialLightsOutState(puzzle))).toEqual([]);
  });

  test('the solution it returns actually turns every light off', () => {
    const puzzle = getLightsOutById('lightsout-medium-01')!;
    let state: LightsOutState = initialLightsOutState(puzzle);
    const solution = solveLightsOut(puzzle, state)!;
    expect(solution.length).toBeGreaterThan(0);
    for (const cell of solution) state = press(state, puzzle.size, cell.row, cell.col);
    expect(isLightsOutSolved(state)).toBe(true);
  });

  test('still solves correctly from a half-played board, not just the dealt one', () => {
    const puzzle = getLightsOutById('lightsout-hard-01')!;
    // Wander a few presses away from the start, then ask again.
    let state: LightsOutState = initialLightsOutState(puzzle);
    for (const [r, c] of [[0, 0], [2, 3], [4, 1]] as const) state = press(state, puzzle.size, r, c);

    for (const cell of solveLightsOut(puzzle, state)!) state = press(state, puzzle.size, cell.row, cell.col);
    expect(isLightsOutSolved(state)).toBe(true);
  });

  /** The check has to be able to fail, or it isn't a check. On a 5x5
   * board the press matrix has rank 23, so two whole dimensions of
   * configurations cannot be switched off at all - a single lit corner
   * is the classic one. */
  test('reports an genuinely unsolvable 5x5 configuration as unsolvable', () => {
    const impossible = fromRows(['#....', '.....', '.....', '.....', '.....']);
    expect(solveLightsOut(impossible, initialLightsOutState(impossible))).toBeNull();
  });

  test('assertValidLightsOut throws on that same unsolvable board, and on an already-dark one', () => {
    const impossible = fromRows(['#....', '.....', '.....', '.....', '.....']);
    expect(() => assertValidLightsOut(impossible)).toThrow(/cannot be solved/);

    const alreadyDark = fromRows(['.....', '.....', '.....', '.....', '.....']);
    expect(() => assertValidLightsOut(alreadyDark)).toThrow(/already off/);
  });
});

describe('revealLightsOutHint', () => {
  test('repeated hints finish the board', () => {
    const puzzle = getLightsOutById('lightsout-easy-01')!;
    let state: LightsOutState = initialLightsOutState(puzzle);
    for (let i = 0; i < puzzle.size * puzzle.size; i += 1) {
      const hint = revealLightsOutHint(puzzle, state);
      if (!hint) break;
      state = hint.state;
    }
    expect(isLightsOutSolved(state)).toBe(true);
  });

  test('hands back nothing once every light is already off', () => {
    const puzzle = getLightsOutById('lightsout-easy-01')!;
    const dark: LightsOutState = { lights: puzzle.initial.map(row => row.map(() => false)) };
    expect(revealLightsOutHint(puzzle, dark)).toBeNull();
  });
});

describe('generation', () => {
  test('is deterministic - the same id always builds the same board', () => {
    const a = generateLightsOut('lightsout-determinism', 'Twice', 'medium', 5);
    const b = generateLightsOut('lightsout-determinism', 'Twice', 'medium', 5);
    expect(a.initial).toEqual(b.initial);
  });

  test('different ids build different boards', () => {
    const a = generateLightsOut('lightsout-alpha', 'A', 'medium', 5);
    const b = generateLightsOut('lightsout-beta', 'B', 'medium', 5);
    expect(a.initial).not.toEqual(b.initial);
  });
});

describe('the shipped pool', () => {
  test('every id round-trips', () => {
    for (const puzzle of LIGHTS_OUT) expect(getLightsOutById(puzzle.id)).toBe(puzzle);
  });

  test('difficulty filters partition the pool with no overlap', () => {
    const easy = getLightsOutByDifficulty('easy');
    const medium = getLightsOutByDifficulty('medium');
    const hard = getLightsOutByDifficulty('hard');
    expect(easy.length + medium.length + hard.length).toBe(LIGHTS_OUT.length);
    expect(easy.every(p => p.difficulty === 'easy')).toBe(true);
    expect(medium.every(p => p.difficulty === 'medium')).toBe(true);
    expect(hard.every(p => p.difficulty === 'hard')).toBe(true);
  });

  test('grid size and par match each tier\'s own declared band', () => {
    for (const puzzle of LIGHTS_OUT) {
      const shape = shapeForDifficulty(puzzle.difficulty);
      expect(puzzle.size).toBe(shape.size);
      expect(puzzle.par).toBeGreaterThanOrEqual(shape.minPar);
      expect(puzzle.par).toBeLessThanOrEqual(shape.maxPar);
    }
  });

  test('par climbs across the pool, so difficulty actually scales', () => {
    const pars = LIGHTS_OUT.map(p => p.par);
    // Non-decreasing end to end: easy 2..4, medium 5..6, hard 7..9.
    for (let i = 1; i < pars.length; i += 1) expect(pars[i]).toBeGreaterThanOrEqual(pars[i - 1]);
  });

  /** A one-press board is over before it begins - and level sets deal at
   * random, so a "teaching" single cross could land at any point in play.
   * The tutorial teaches the rule; every real board asks at least two. */
  test('no board in the pool is a single press', () => {
    for (const puzzle of LIGHTS_OUT) expect(puzzle.par).toBeGreaterThanOrEqual(2);
  });
});

describe.each(LIGHTS_OUT.map(p => [p.id, p] as const))('%s', (_id, puzzle) => {
  test('is a valid, solvable puzzle', () => {
    expect(() => assertValidLightsOut(puzzle)).not.toThrow();
  });

  test('its stored par is the real shortest solution, not a claim', () => {
    expect(parFor(puzzle)).toBe(puzzle.par);
  });
});
