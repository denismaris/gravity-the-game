import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { AdjacentAnimation, AdjacentBoardView, adjacentTileColor, TILE_SCALE } from '../AdjacentBoardView';
import { AdjacentPuzzle, AdjacentState } from '../../game/adjacent';

/**
 * Regression test for a fall that visibly teleported.
 *
 * The grid is updated the instant a tap applies, so a tile that is about
 * to fall is *already* recorded at the bottom of its column. The board
 * held the drop back by `FALL_DELAY_MS` so the cleared run could fade
 * first - but during that delay it returned no falling tiles at all,
 * which left the static layer free to draw them at their landed
 * positions. Every move therefore played as: tile jumps to the floor,
 * sits there for 90ms, snaps back up to where it came from, then falls.
 *
 * The fix holds the fall at progress 0 through the delay. This test
 * pins the tile's actual drawn `y` at three points - before the drop,
 * during it, and after - because "where is it drawn" is the only
 * question that was ever wrong, and reading the code is what missed it
 * the first time.
 */

const CELL = 60;
const SIZE = 4;
/** The colour of the one tile that falls in this fixture. */
const FALLING_COLOUR = 2;

/** A settled 4x4. Column 1 holds a 2 at the top with a gap beneath it
 * once the run below clears, so it has somewhere to fall to. */
const PUZZLE: AdjacentPuzzle = {
  id: 'adjacent-fall-fixture',
  difficulty: 'easy',
  size: SIZE,
  colors: 4,
  initial: [
    [null, null, null, null],
    [null, 2, null, null],
    [null, 1, null, null],
    [3, 1, 1, 0],
  ],
  targetScore: 10_000,
};

/** The board *after* the run of three 1s has cleared and settled: the 2
 * that was at row 1 is now on the floor at row 3. */
const AFTER: AdjacentState = {
  grid: [
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null],
    [3, 2, null, 0],
  ],
  score: 200,
  cascades: 1,
};

const ANIMATION: AdjacentAnimation = {
  at: 1_000_000,
  removed: [
    { row: 2, col: 1, colour: 1 },
    { row: 3, col: 1, colour: 1 },
    { row: 3, col: 2, colour: 1 },
  ],
  // The 2 falls from row 1 to row 3.
  falls: [{ col: 1, fromRow: 1, toRow: 3 }],
};

/**
 * Which row the falling tile is currently drawn at, as a float.
 *
 * Identified by its own glaze rather than by position, which matters:
 * the run clearing underneath it is in the same column, so anything that
 * merely picked the topmost tile-shaped rectangle would sometimes be
 * reporting a *cleared* tile mid-fade instead. The falling tile is the
 * only colour-2 tile on this board.
 */
function fallingTileRow(renderer: ReactTestRenderer.ReactTestRenderer): number | null {
  const tileWidth = CELL * TILE_SCALE;
  const inset = (CELL - tileWidth) / 2;
  const faces = renderer.root.findAll(
    node =>
      (node.type as unknown) === 'SkiaRoundedRectMock' &&
      node.props.color === adjacentTileColor(FALLING_COLOUR) &&
      Math.abs(node.props.width - tileWidth) < 0.5,
    { deep: true },
  );
  if (faces.length === 0) return null;
  expect(faces).toHaveLength(1);
  expect(faces[0].props.x).toBeCloseTo(1 * CELL + inset, 1);
  return (faces[0].props.y - inset) / CELL;
}

function renderAt(elapsed: number): ReactTestRenderer.ReactTestRenderer {
  jest.spyOn(Date, 'now').mockReturnValue(ANIMATION.at + elapsed);
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <AdjacentBoardView
        puzzle={PUZZLE}
        state={AFTER}
        maxWidth={CELL * SIZE}
        maxHeight={CELL * SIZE}
        animation={ANIMATION}
        solved={false}
      />,
    );
  });
  return renderer;
}

describe('AdjacentBoardView - a falling tile never teleports', () => {
  beforeEach(() => {
    jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1 as unknown as number);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('sits at its origin while the cleared run is still fading', () => {
    // The move has applied and the grid already says row 3 - but nothing
    // has visibly moved yet, so the tile must still be drawn at row 1.
    for (const elapsed of [0, 45, 89]) {
      const renderer = renderAt(elapsed);
      expect(fallingTileRow(renderer)).toBeCloseTo(1, 1);
      act(() => renderer.unmount());
    }
  });

  test('is somewhere between origin and floor while dropping', () => {
    const renderer = renderAt(90 + 120);
    const row = fallingTileRow(renderer)!;
    expect(row).toBeGreaterThan(1);
    expect(row).toBeLessThan(3);
    act(() => renderer.unmount());
  });

  test('only ever moves downward, frame by frame', () => {
    // The teleport this guards against was a *backwards* jump, so the
    // property worth asserting is monotonicity across the whole window
    // rather than the endpoints alone.
    let previous = -Infinity;
    for (let elapsed = 0; elapsed <= 90 + 240; elapsed += 10) {
      const renderer = renderAt(elapsed);
      const row = fallingTileRow(renderer);
      expect(row).not.toBeNull();
      expect(row!).toBeGreaterThanOrEqual(previous - 1e-6);
      previous = row!;
      act(() => renderer.unmount());
    }
  });

  test('has landed on the floor once the drop is over', () => {
    const renderer = renderAt(90 + 240 + 50);
    expect(fallingTileRow(renderer)).toBeCloseTo(3, 1);
    act(() => renderer.unmount());
  });
});
