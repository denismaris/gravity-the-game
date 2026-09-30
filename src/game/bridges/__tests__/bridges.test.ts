import {
  BRIDGES,
  BridgesPuzzle,
  assertValidBridges,
  blockingLink,
  bridgeLinks,
  bridgesLeft,
  countBridgesSolutions,
  cycleBridge,
  emptyBridgesState,
  generateBridges,
  getBridgesByDifficulty,
  getBridgesById,
  isBridgesSolved,
  isSolvableByLogic,
  islandLoads,
  linkBetween,
  linkFrom,
  revealBridgesHint,
  shapeForDifficulty,
} from '..';

// 2 . 2        a cross: the top pair and the left column,
// . . .        with a lane through the middle each way
// 2 . 2
const SQUARE: BridgesPuzzle = {
  id: 'square',
  difficulty: 'easy',
  rows: 3,
  cols: 3,
  islands: [
    { row: 0, col: 0, need: 2 },
    { row: 0, col: 2, need: 2 },
    { row: 2, col: 0, need: 2 },
    { row: 2, col: 2, need: 2 },
  ],
  solution: [],
};

// . 1 .
// 1 . 1   a plus: the two lanes through the middle cross
// . 1 .
const PLUS: BridgesPuzzle = {
  id: 'plus',
  difficulty: 'easy',
  rows: 3,
  cols: 3,
  islands: [
    { row: 0, col: 1, need: 1 },
    { row: 1, col: 0, need: 1 },
    { row: 1, col: 2, need: 1 },
    { row: 2, col: 1, need: 1 },
  ],
  solution: [],
};

describe('lanes', () => {
  test('each island sees the nearest island right and below', () => {
    const links = bridgeLinks(SQUARE);
    expect(links.map(l => [l.a, l.b, l.horizontal])).toEqual([
      [0, 1, true],
      [0, 2, false],
      [1, 3, false],
      [2, 3, true],
    ]);
    expect(links.every(l => l.crosses.length === 0)).toBe(true);
  });

  test('lanes that cross know it', () => {
    const links = bridgeLinks(PLUS);
    expect(links).toHaveLength(2);
    expect(links[0].crosses).toEqual([1]);
    expect(links[1].crosses).toEqual([0]);
  });

  test('finds the lane between two islands, and leaving one by direction', () => {
    expect(linkBetween(SQUARE, 3, 1)).toBe(2);
    expect(linkBetween(SQUARE, 0, 3)).toBeNull();
    expect(linkFrom(SQUARE, 0, 1, 0)).toBe(0);
    expect(linkFrom(SQUARE, 0, 0, 1)).toBe(1);
    expect(linkFrom(SQUARE, 0, -1, 0)).toBeNull();
  });
});

describe('building', () => {
  test('a lane cycles none, one, two, none', () => {
    let state = emptyBridgesState(SQUARE);
    state = cycleBridge(SQUARE, state, 0);
    expect(state.bridges[0]).toBe(1);
    state = cycleBridge(SQUARE, state, 0);
    expect(state.bridges[0]).toBe(2);
    state = cycleBridge(SQUARE, state, 0);
    expect(state.bridges[0]).toBe(0);
  });

  test('a bridge may not be laid across another', () => {
    const one = cycleBridge(PLUS, emptyBridgesState(PLUS), 0);
    expect(blockingLink(PLUS, one, 1)).toBe(0);
    expect(cycleBridge(PLUS, one, 1)).toBe(one);
  });

  test('loads, bridges left and solved', () => {
    let state = emptyBridgesState(SQUARE);
    expect(bridgesLeft(SQUARE, state)).toBe(4);
    for (const l of [0, 1, 2, 3]) state = cycleBridge(SQUARE, state, l);
    expect(islandLoads(SQUARE, state)).toEqual([2, 2, 2, 2]);
    expect(bridgesLeft(SQUARE, state)).toBe(0);
    expect(isBridgesSolved(SQUARE, state)).toBe(true);
  });

  test('right numbers but two separate groups is not solved', () => {
    let state = emptyBridgesState(SQUARE);
    state = cycleBridge(SQUARE, cycleBridge(SQUARE, state, 0), 0);
    state = cycleBridge(SQUARE, cycleBridge(SQUARE, state, 3), 3);
    expect(islandLoads(SQUARE, state)).toEqual([2, 2, 2, 2]);
    expect(isBridgesSolved(SQUARE, state)).toBe(false);
  });
});

describe('reasoning', () => {
  test('the square has one answer, and it takes the connection rule to see it', () => {
    // Counting allows a ring of singles or two double pairs; only the
    // "never seal off a group" rule tells them apart.
    expect(countBridgesSolutions(SQUARE)).toBe(1);
    expect(isSolvableByLogic(SQUARE, false)).toBe(false);
    expect(isSolvableByLogic(SQUARE, true)).toBe(true);
  });

  test('the plus has no answer at all', () => {
    expect(countBridgesSolutions(PLUS)).toBe(0);
  });
});

describe('the shipped pool', () => {
  test('every board is fair: one answer, reasoned out without guessing', () => {
    for (const puzzle of BRIDGES) assertValidBridges(puzzle);
  });

  test('easy may be counted out; medium and hard need the connection rules', () => {
    for (const puzzle of BRIDGES) {
      if (puzzle.difficulty !== 'easy') expect({ id: puzzle.id, countingAlone: isSolvableByLogic(puzzle, false) }).toEqual({ id: puzzle.id, countingAlone: false });
    }
  });

  test('boards grow with the tier', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const shape = shapeForDifficulty(tier);
      const boards = getBridgesByDifficulty(tier);
      expect(boards.length).toBeGreaterThanOrEqual(8);
      for (const puzzle of boards) {
        expect(puzzle.rows).toBe(shape.size);
        expect(puzzle.islands.length).toBeGreaterThanOrEqual(shape.minIslands);
        expect(puzzle.islands.length).toBeLessThanOrEqual(shape.maxIslands);
      }
    }
  });

  test('no two islands touch', () => {
    for (const puzzle of BRIDGES) {
      const at = new Set(puzzle.islands.map(i => `${i.row}:${i.col}`));
      for (const island of puzzle.islands) {
        expect(at.has(`${island.row}:${island.col + 1}`) || at.has(`${island.row + 1}:${island.col}`)).toBe(false);
      }
    }
  });

  test('ids resolve, and endless ids build the same board every time', () => {
    expect(getBridgesById('bridges-easy-01')?.name).toBe('Stepping Stones');
    const endless = getBridgesById('bridges-e-hard-3');
    expect(endless).toBeDefined();
    expect(generateBridges('bridges-e-hard-3', endless!.name!, 'hard')).toEqual(endless);
    assertValidBridges(endless!);
  });
});

describe('hints', () => {
  test('take away a wrong bridge first, then lay a right one, until solved', () => {
    const puzzle = BRIDGES[0];
    let state = emptyBridgesState(puzzle);
    const wrong = puzzle.solution.findIndex(n => n < 2);
    state = { bridges: state.bridges.map((n, l) => (l === wrong ? 2 : n)) };
    const first = revealBridgesHint(puzzle, state)!;
    expect(first.link).toBe(wrong);
    state = first.state;
    for (let guard = 0; guard < 100 && !isBridgesSolved(puzzle, state); guard += 1) state = revealBridgesHint(puzzle, state)!.state;
    expect(isBridgesSolved(puzzle, state)).toBe(true);
    expect(revealBridgesHint(puzzle, state)).toBeNull();
  });
});
