import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { BridgesBoardView, bridgesGeometry } from '../BridgesBoardView';
import { buildDurationMs, buildEase, buildTimeAt, laneSpan, plankScale } from '../bridgesMotion';
import { BRIDGES, BridgesPuzzle, emptyBridgesState } from '../../game/bridges';
import * as AnimationClockModule from '../../game/rendering/useAnimationClock';

/**
 * Bridges animates on the UI thread (Reanimated shared values driving Skia
 * props). These pin the two things that make that true - no JavaScript
 * frame clock, and settled bridges drawn from cached paths - and the
 * motion itself: a bridge laid plank by plank outward from where it was
 * started.
 */

// 2 . 2 on the middle row of a 3x3.
const PAIR: BridgesPuzzle = {
  id: 'pair',
  difficulty: 'easy',
  rows: 3,
  cols: 3,
  islands: [
    { row: 1, col: 0, need: 1 },
    { row: 1, col: 2, need: 1 },
  ],
  solution: [1],
};

describe('the motion math', () => {
  test('a bridge spreads from where it was started and reaches both shores together', () => {
    const origin = 0.4;
    let previous = laneSpan(0, origin, true);
    expect(previous).toEqual([origin, origin]);
    for (const p of [0.25, 0.5, 0.75, 1]) {
      const span = laneSpan(p, origin, true);
      expect(span[0]).toBeLessThan(previous[0]);
      expect(span[1]).toBeGreaterThan(previous[1]);
      previous = span;
    }
    expect(previous).toEqual([0, 1]);
  });

  test('a dragged bridge grows from its island; a lifted one draws in to the middle', () => {
    expect(laneSpan(0.5, 0, true)).toEqual([0, 0.5]);
    expect(laneSpan(0.5, 1, true)).toEqual([0.5, 1]);
    expect(laneSpan(1, 0.5, false)).toEqual([0.5, 0.5]);
  });

  test('a longer bridge takes longer, but not proportionally', () => {
    expect(buildDurationMs(2)).toBeGreaterThan(buildDurationMs(1));
    expect(buildDurationMs(6)).toBeLessThan(buildDurationMs(1) * 3);
    expect(buildDurationMs(20)).toBeLessThanOrEqual(620);
  });

  test('the plank clicks are timed on the build curve itself', () => {
    for (const share of [0.1, 0.5, 0.9]) expect(buildEase(buildTimeAt(share))).toBeCloseTo(share, 6);
  });

  test('planks are down at rest, settle in smoothly at a moving end, and are absent beyond it', () => {
    expect(plankScale(0.05, 0, 1, 0.2)).toBe(1);
    expect(plankScale(0.95, 0, 1, 0.2)).toBe(1);
    const landing = plankScale(0.55, 0, 0.6, 0.2);
    expect(landing).toBeGreaterThan(0);
    expect(landing).toBeLessThan(1);
    expect(plankScale(0.7, 0, 0.6, 0.2)).toBe(0);
  });
});

describe('BridgesBoardView', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('never asks for a JavaScript frame clock - entrance, building and the finish included', () => {
    const clock = jest.spyOn(AnimationClockModule, 'useAnimationClock');
    const puzzle = BRIDGES[0];
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<BridgesBoardView puzzle={puzzle} state={emptyBridgesState(puzzle)} size={300} solved={false} />);
    });
    act(() => renderer.update(<BridgesBoardView puzzle={puzzle} state={{ bridges: puzzle.solution }} size={300} solved />));
    act(() => jest.advanceTimersByTime(2000));
    expect(clock).not.toHaveBeenCalled();
  });

  test('a bridge tapped on the water is laid plank by plank outward from that spot, then settles', () => {
    const view = (bridges: number[]) => <BridgesBoardView puzzle={PAIR} state={{ bridges }} size={300} solved={false} origin={{ link: 0, at: 0.4 }} />;
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(view([0]));
    });
    act(() => jest.advanceTimersByTime(2000));
    act(() => renderer.update(view([1])));

    const planks = () => renderer.root.findAll(node => node.props.plank !== undefined && node.props.progress !== undefined);
    // How far a plank has landed - it fades in as it settles.
    const scaleOf = (node: ReactTestRenderer.ReactTestInstance) => {
      const group = node.find(child => child.props.opacity?.value !== undefined);
      return group.props.opacity.value as number;
    };
    expect(planks().length).toBeGreaterThan(3);

    act(() => jest.advanceTimersByTime(120));
    const early = planks().map(node => ({ at: node.props.plank.at as number, s: scaleOf(node) }));
    // Near the tap, planks are already down; near the far shores, not yet.
    const near = early.filter(p => Math.abs(p.at - 0.4) < 0.1);
    const far = early.filter(p => p.at > 0.9 || p.at < 0.05);
    expect(near.every(p => p.s > 0)).toBe(true);
    expect(far.every(p => p.s === 0)).toBe(true);

    act(() => jest.advanceTimersByTime(1000));
    expect(planks()).toHaveLength(0);
    const boardwalks = renderer.root.findAll(node => node.props.paths !== undefined && node.props.tint === undefined && node.props.progress === undefined);
    expect(boardwalks.length).toBeGreaterThanOrEqual(1);
  });

  // Regression: lane drawings were cached by the two islands' *indices*,
  // which repeat from board to board - so a new board could reuse an old
  // board's bridge, drawn wherever that one was (stubs in open water, a
  // bridge across the middle of another).
  test('two boards whose lanes share island numbers never share a drawing', () => {
    const top: BridgesPuzzle = { ...PAIR, id: 'top', islands: [{ row: 0, col: 0, need: 1 }, { row: 0, col: 2, need: 1 }] };
    const bottom: BridgesPuzzle = { ...PAIR, id: 'bottom', islands: [{ row: 2, col: 0, need: 1 }, { row: 2, col: 2, need: 1 }] };
    const ropesOf = (puzzle: BridgesPuzzle): string => {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      act(() => {
        renderer = ReactTestRenderer.create(<BridgesBoardView puzzle={puzzle} state={{ bridges: [1] }} size={300} solved={false} />);
      });
      const walk = renderer.root.find(node => node.props.paths !== undefined && node.props.tint === undefined);
      const svg = walk.props.paths.ropes.svg as string;
      act(() => renderer.unmount());
      return svg;
    };
    const a = ropesOf(top);
    const b = ropesOf(bottom);
    expect(b).not.toEqual(a);
    const firstY = Number(b.split(' ')[2]);
    expect(Math.abs(firstY - bridgesGeometry(bottom, 300).centres[0].y)).toBeLessThan(20);
  });

  test('a double nudges the single aside as it is laid beside it', () => {
    const view = (bridges: number[]) => <BridgesBoardView puzzle={PAIR} state={{ bridges }} size={300} solved={false} origin={{ link: 0, at: 0 }} />;
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(view([1]));
    });
    act(() => jest.advanceTimersByTime(2000));
    act(() => renderer.update(view([2])));
    const sliding = () => renderer.root.findAll(node => node.props.fromOffset !== undefined);
    expect(sliding()).toHaveLength(1);
    expect(sliding()[0].props.fromOffset).toBe(0);
    expect(sliding()[0].props.toOffset).toBeLessThan(0);
    act(() => jest.advanceTimersByTime(1000));
    expect(sliding()).toHaveLength(0);
  });
});
