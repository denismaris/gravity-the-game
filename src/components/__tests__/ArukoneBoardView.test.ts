import { describeCell } from '../ArukoneBoardView';
import { beginDraw, extendDraw, emptyArukoneState, getArukoneById } from '../../game/arukone';

describe('describeCell', () => {
  const puzzle = getArukoneById('arukone-001')!;

  test('an obstacle reads as blocked', () => {
    const obstacle = puzzle.obstacles[0];
    expect(describeCell(puzzle, emptyArukoneState(), obstacle.row, obstacle.col)).toBe(
      `Row ${obstacle.row + 1}, column ${obstacle.col + 1}, blocked`,
    );
  });

  test('an endpoint reads as its own number, unjoined', () => {
    const pair = puzzle.pairs[0];
    expect(describeCell(puzzle, emptyArukoneState(), pair.a.row, pair.a.col)).toBe(
      `Row ${pair.a.row + 1}, column ${pair.a.col + 1}, number ${pair.value}`,
    );
  });

  test('a joined endpoint says so', () => {
    const pair = puzzle.pairs[0];
    const answer = puzzle.solution[pair.value];
    const started = beginDraw(puzzle, emptyArukoneState(), answer[0])!;
    const state = answer.slice(1).reduce((s, cell) => extendDraw(puzzle, s, started.value, cell), started.state);
    expect(describeCell(puzzle, state, pair.a.row, pair.a.col)).toBe(
      `Row ${pair.a.row + 1}, column ${pair.a.col + 1}, number ${pair.value}, joined`,
    );
  });

  test('an empty free cell reads as empty', () => {
    const isBlocked = (row: number, col: number): boolean => puzzle.obstacles.some(o => o.row === row && o.col === col);
    const isEndpoint = (row: number, col: number): boolean =>
      puzzle.pairs.some(p => (p.a.row === row && p.a.col === col) || (p.b.row === row && p.b.col === col));

    let free: { row: number; col: number } | undefined;
    for (let row = 0; row < puzzle.size && !free; row += 1) {
      for (let col = 0; col < puzzle.size && !free; col += 1) {
        if (!isBlocked(row, col) && !isEndpoint(row, col)) free = { row, col };
      }
    }
    expect(free).toBeDefined();
    expect(describeCell(puzzle, emptyArukoneState(), free!.row, free!.col)).toBe(`Row ${free!.row + 1}, column ${free!.col + 1}, empty`);
  });

  test('a cell mid-path reads as part of that path, before it joins', () => {
    // A pair whose solution has a real interior cell (not just its two
    // endpoints), so drawing everything but the last step leaves a cell
    // that is genuinely "on the path" without the pair reading as joined.
    const pair = puzzle.pairs.find(p => puzzle.solution[p.value].length >= 3)!;
    expect(pair).toBeDefined();
    const answer = puzzle.solution[pair.value];
    const started = beginDraw(puzzle, emptyArukoneState(), answer[0])!;
    const state = answer.slice(1, -1).reduce((s, cell) => extendDraw(puzzle, s, started.value, cell), started.state);

    const interior = answer[answer.length - 2];
    expect(describeCell(puzzle, state, interior.row, interior.col)).toBe(
      `Row ${interior.row + 1}, column ${interior.col + 1}, part of ${pair.value}'s path`,
    );
  });
});
