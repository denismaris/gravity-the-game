import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { MirrorMazeBoardView } from '../MirrorMazeBoardView';
import { getMirrorMazeById, solveMirrorMaze, traceBeam } from '../../game/mirror';

/**
 * Regression test for the gems/mirrors static split: once every gem is lit
 * and settled (no burst in flight) and no mirror is mid-flourish, neither
 * `StaticGems` nor `StaticMirrors` should receive different props at two
 * different clock times - that stable-props property is exactly what lets
 * `React.memo` bail out and skip re-rendering them, which is the entire
 * point of the split. A fresh mount with the puzzle's own solved mirrors
 * already in place never triggers a flourish/burst for content that was
 * already there before mount (see `useMirrorFlourish`/`useGemBursts`'s own
 * `previousRef` seeding) - exactly the "resuming an already-mostly-solved
 * board" case this split exists for.
 */
describe('MirrorMazeBoardView gems/mirrors static split', () => {
  beforeEach(() => {
    jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('a settled, fully-lit board passes identical props to its static layers at two different clock times', () => {
    const puzzle = getMirrorMazeById('mirror-001')!;
    const [state] = solveMirrorMaze(puzzle, 1);
    const path = traceBeam(puzzle, state);

    const staticLayerProps = (nowMs: number): { activeKeys: unknown; flourishingKey: unknown } => {
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(nowMs);
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(
          <MirrorMazeBoardView puzzle={puzzle} state={state} size={280} path={path} revealProgress={0} solved={false} />,
        );
      });
      const gems = renderer.root.find(node => typeof node.type === 'function' && (node.type as { name?: string }).name === 'StaticGemsImpl');
      const mirrors = renderer.root.find(node => typeof node.type === 'function' && (node.type as { name?: string }).name === 'StaticMirrorsImpl');
      const props = { activeKeys: gems.props.activeKeys, flourishingKey: mirrors.props.flourishingKey };
      act(() => {
        renderer.unmount();
      });
      dateSpy.mockRestore();
      return props;
    };

    const first = staticLayerProps(0);
    const second = staticLayerProps(9000);

    // Both settled - nothing left unlit, nothing mid-flourish - regardless
    // of which of the two times it's checked at.
    expect(first.activeKeys).toBe('');
    expect(first.flourishingKey).toBeNull();
    expect(second).toEqual(first);
  });
});
