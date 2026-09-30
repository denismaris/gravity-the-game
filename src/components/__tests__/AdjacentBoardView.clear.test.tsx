import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { AdjacentAnimation, AdjacentBoardView } from '../AdjacentBoardView';
import { AdjacentPuzzle, AdjacentState } from '../../game/adjacent';

/**
 * The clear ripples out from the tapped tile. Every cleared tile is already
 * gone from the grid when the animation starts, so a tile the ripple has
 * not reached yet must still be drawn exactly as it was - skipping it would
 * make it vanish early, the same trap the fall once fell into.
 */
const SIZE = 5;
const PUZZLE: AdjacentPuzzle = {
  id: 'adjacent-clear-fixture',
  name: 'Fixture',
  difficulty: 'easy',
  size: SIZE,
  colors: 4,
  initial: Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null)),
  targetScore: 10_000,
};
const EMPTY: AdjacentState = { grid: PUZZLE.initial, score: 0 } as unknown as AdjacentState;

describe('AdjacentBoardView - the clear ripples out from the tap', () => {
  let now: number;
  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('a far tile waits, whole, for the ripple - then goes', () => {
    // A straight run of four from the tapped corner: distances 0..3.
    const animation: AdjacentAnimation = {
      at: now,
      removed: [0, 1, 2, 3].map(col => ({ row: 4, col, colour: 1 })),
      falls: [],
    };
    const board = () => <AdjacentBoardView puzzle={PUZZLE} state={EMPTY} maxWidth={300} maxHeight={300} animation={animation} solved={false} />;
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    const tileAt = (col: number) =>
      renderer.root.findAll(n => n.props.colour === 1 && typeof n.props.scale === 'number' && n.props.x !== undefined).find(n => n.props.x === col * n.props.cell);

    now += 40; // the tapped tile is popping; the far end has not started
    act(() => {
      renderer = ReactTestRenderer.create(board());
    });
    const far = tileAt(3)!;
    expect(far).toBeDefined();
    expect(far.props.scale).toBe(1);
    expect(far.props.opacity).toBe(1);

    now += 2000; // long after every tile's pop
    act(() => renderer.update(board()));
    expect(tileAt(3)).toBeUndefined();
    act(() => renderer.unmount());
  });
});
