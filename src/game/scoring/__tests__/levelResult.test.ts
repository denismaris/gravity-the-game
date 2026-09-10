import { mergeLevelResult } from '../levelResult';

describe('mergeLevelResult', () => {
  test('first completion is stored verbatim', () => {
    expect(mergeLevelResult(undefined, { stars: 2, moves: 7 })).toEqual({
      completed: true,
      stars: 2,
      bestMoves: 7,
    });
  });

  test('a better replay raises stars and lowers bestMoves', () => {
    const previous = { completed: true, stars: 1, bestMoves: 12 } as const;
    expect(mergeLevelResult(previous, { stars: 3, moves: 8 })).toEqual({
      completed: true,
      stars: 3,
      bestMoves: 8,
    });
  });

  test('a worse replay never lowers stars or raises bestMoves', () => {
    const previous = { completed: true, stars: 3, bestMoves: 8 } as const;
    expect(mergeLevelResult(previous, { stars: 1, moves: 20 })).toEqual({
      completed: true,
      stars: 3,
      bestMoves: 8,
    });
  });

  test('mixed replay: keeps best stars, takes the better move count', () => {
    const previous = { completed: true, stars: 3, bestMoves: 10 } as const;
    expect(mergeLevelResult(previous, { stars: 2, moves: 6 })).toEqual({
      completed: true,
      stars: 3,
      bestMoves: 6,
    });
  });

  test('does not mutate the previous result', () => {
    const previous = { completed: true, stars: 2, bestMoves: 9 } as const;
    const frozen = Object.freeze({ ...previous });
    mergeLevelResult(frozen, { stars: 3, moves: 4 });
    expect(frozen).toEqual({ completed: true, stars: 2, bestMoves: 9 });
  });
});
