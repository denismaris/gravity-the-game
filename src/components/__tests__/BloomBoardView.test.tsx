import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { BloomBoardView } from '../BloomBoardView';
import { getBloomById, initialBloomState, isRotatable, rotateTile } from '../../game/bloom';

/**
 * Regression test for a turn that stuttered on device. The board used to
 * rebuild and re-parse every tile, loop and pin on every animation frame;
 * now everything not moving sits in memoised layers. The property that
 * makes that work is that the static tile layer receives *the same props*
 * on every frame of a turn - identical `ink` object, identical
 * `activeKeys` string - so `React.memo` bails out and only the one
 * turning tile renders per frame.
 */
describe('BloomBoardView - a turn renders only what moves', () => {
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

  test('the static tile layer gets identical props across frames of one turn', () => {
    const puzzle = getBloomById('bloom-medium-01')!;
    const start = initialBloomState(puzzle);
    let target: [number, number] | null = null;
    for (let r = 0; r < puzzle.rows && !target; r += 1) for (let c = 0; c < puzzle.cols && !target; c += 1) if (isRotatable(puzzle, r, c)) target = [r, c];
    const turned = rotateTile(puzzle, start, target![0], target![1]);
    const board = (state: typeof start) => <BloomBoardView puzzle={puzzle} state={state} size={320} solved={false} />;

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(board(start));
    });
    act(() => renderer.update(board(turned)));

    const staticLayer = () => renderer.root.find(node => node.props.activeKeys !== undefined && node.props.ink !== undefined).props;
    const first = staticLayer();
    expect(first.activeKeys).toBe(`${target![0]}:${target![1]}`);

    now += 60;
    act(() => renderer.update(board(turned)));
    const second = staticLayer();
    expect(second.ink).toBe(first.ink);
    expect(second.activeKeys).toBe(first.activeKeys);

    // Once the turn lands, the tile rejoins the static layer.
    now += 1000;
    act(() => renderer.update(board(turned)));
    expect(staticLayer().activeKeys).toBe('');
    act(() => renderer.unmount());
  });
});
