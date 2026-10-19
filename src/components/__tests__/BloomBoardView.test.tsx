import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { BloomBoardView } from '../BloomBoardView';
import { getBloomById, initialBloomState, isRotatable, rotateTile } from '../../game/bloom';

/**
 * Regression test for a turn that stuttered on device. A turn used to be
 * redrawn from a JavaScript clock every frame; now each tile is drawn once
 * in its unturned facing and turned by an angle on the UI thread - so a
 * tap must change a tile's rotation, never its drawing.
 */
describe('BloomBoardView - a turn moves an angle, not a drawing', () => {
  let now: number;

  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('a turn changes only the angle: the tile keeps its one drawing, and only its rotation moves on', () => {
    const puzzle = getBloomById('bloom-medium-01')!;
    const start = initialBloomState(puzzle);
    let target: [number, number] | null = null;
    for (let r = 0; r < puzzle.rows && !target; r += 1) for (let c = 0; c < puzzle.cols && !target; c += 1) if (isRotatable(puzzle, r, c) && puzzle.kinds[r][c] === 'arc') target = [r, c];
    const turned = rotateTile(puzzle, start, target![0], target![1]);
    const board = (state: typeof start) => <BloomBoardView puzzle={puzzle} state={state} size={320} solved={false} />;

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(board(start));
    });
    const tile = () => renderer.root.find(node => node.props.turns === true && node.props.cx === (target![1] + 0.5) * (320 / puzzle.cols) && node.props.cy === (target![0] + 0.5) * (320 / puzzle.rows)).props;
    const before = tile();
    act(() => renderer.update(board(turned)));
    const after = tile();
    expect(after.rotation).toBe((before.rotation + 1) % 4);
    // Drawn unturned either way: the same arc, turned by the view.
    expect(after.base.joined?.svg ?? after.base.loose?.svg).toBe(before.base.joined?.svg ?? before.base.loose?.svg);
    act(() => renderer.unmount());
  });
});
