import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { MirrorMazeBoardView } from '../MirrorMazeBoardView';
import { getMirrorMazeById, solveMirrorMaze, traceBeam } from '../../game/mirror';

/**
 * Gems: a gem already lit when the board appears rests - it does not throw
 * its "collected" ring for something the player did on an earlier visit.
 * Every gem is its own small component, so each can move on the UI thread.
 */
describe('MirrorMazeBoardView gems', () => {
  test('one per gem, and a board resumed already solved throws no rings', () => {
    const puzzle = getMirrorMazeById('mirror-001')!;
    const [state] = solveMirrorMaze(puzzle, 1);
    const path = traceBeam(puzzle, state);
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<MirrorMazeBoardView puzzle={puzzle} state={state} size={280} path={path} revealProgress={0} solved={false} />);
    });
    const gems = renderer.root.findAll(node => typeof node.type === 'function' && (node.type as { name?: string }).name === 'MazeGem');
    expect(gems).toHaveLength(puzzle.gems.length);
    expect(gems.every(g => g.props.lit)).toBe(true);
    act(() => renderer.unmount());
  });
});
