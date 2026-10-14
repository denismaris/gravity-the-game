import { ADJACENT, applyTap, crumbling, getAdjacentById, groupAt, hasLegalMove, initialAdjacentState, legalMoves, searchBestScore, STONE_BONUS, tileCount, GOLD, STONE } from '..';
import { parseAdjacentRows } from '../puzzles';

const grid = (rows: string[]) => parseAdjacentRows(rows);
const seeded = (seed: number) => {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return x / 2147483647;
  };
};

describe('Adjacent: stones and gold', () => {
  test('a stone joins nothing and falls, and crumbles for a bonus when it reaches the floor', () => {
    const g = grid(['#2', '00', '12']);
    expect(groupAt(g, 0, 0)).toEqual([]);
    // Something still under it: it only drops.
    const move = applyTap({ grid: g, score: 0, cascades: 0 }, 1, 0)!;
    expect(move.state.grid[1][0]).toBe(STONE);
    expect(move.crumbled).toBe(0);
    expect(hasLegalMove(grid(['#', '#']))).toBe(false);
    // Dug out from under: it crumbles, and scores.
    const dug = applyTap({ grid: grid(['#1', '00', '00']), score: 0, cascades: 0 }, 2, 0)!;
    expect(dug.crumbled).toBe(1);
    expect(dug.state.grid.flat().includes(STONE)).toBe(false);
    expect(dug.gained).toBe(applyTap({ grid: grid(['.1', '00', '00']), score: 0, cascades: 0 }, 2, 0)!.gained + STONE_BONUS);
    expect(tileCount(dug.state.grid)).toBe(1);
  });

  test('no shipped board starts with a stone on the floor', () => {
    for (const p of ADJACENT) expect(crumbling(p.initial)).toEqual([]);
  });

  test('gold joins a run of any colour and doubles it', () => {
    const g = grid(['.1.', '0*1', '021']);
    expect(groupAt(g, 0, 1)).toHaveLength(4);
    const plain = applyTap({ grid: grid(['.1.', '011', '021']), score: 0, cascades: 0 }, 0, 1)!;
    const golden = applyTap({ grid: g, score: 0, cascades: 0 }, 0, 1)!;
    expect(golden.gained).toBe(plain.gained * 2);
    // Tapped itself, gold clears the biggest run it can join.
    expect(groupAt(g, 1, 1)).toHaveLength(4);
    expect(hasLegalMove(grid(['*0']))).toBe(true);
    expect(hasLegalMove(grid(['**']))).toBe(false);
    expect(legalMoves(grid(['0*1']))).toHaveLength(2);
  });

  test('ruled boards carry their tiles and are beatable', () => {
    for (const id of ['adjacent-medium-s01', 'adjacent-medium-s02', 'adjacent-medium-s03', 'adjacent-hard-g01', 'adjacent-hard-g02', 'adjacent-hard-g03']) {
      const p = ADJACENT.find(x => x.id === id)!;
      const cells = p.initial.flat();
      expect(cells.includes(id.includes('-s') ? STONE : GOLD)).toBe(true);
      expect(searchBestScore(p, { attempts: 400, rng: seeded(11) }).score).toBeGreaterThanOrEqual(p.targetScore);
    }
  });

  test('endless trays bring the rules sometimes', () => {
    const boards = [0, 1, 2, 3, 4, 5, 6, 7].map(i => getAdjacentById(`adjacent-e-hard-${i}`)!);
    expect(boards.some(b => b.initial.flat().includes(GOLD))).toBe(true);
    for (const b of boards) expect(initialAdjacentState(b).score).toBe(0);
  });
});
