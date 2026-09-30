import React from 'react';
import { AccessibilityInfo } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { BridgesBoard } from '../BridgesBoard';
import { BridgesPuzzle, emptyBridgesState } from '../../game/bridges';

/**
 * With VoiceOver / TalkBack on, the canvas board lays real elements over
 * itself: every island reads its number and load, every lane is an
 * adjustable control. With it off, the board is one touch surface.
 */

// 1 . 2
// . . .
// 3 . 2    lanes: 0 top (0-1), 1 left (0-2), 2 right (1-3), 3 bottom (2-3)
const PUZZLE: BridgesPuzzle = {
  id: 'bridges-a11y-fixture',
  difficulty: 'easy',
  rows: 3,
  cols: 3,
  islands: [
    { row: 0, col: 0, need: 1 },
    { row: 0, col: 2, need: 2 },
    { row: 2, col: 0, need: 3 },
    { row: 2, col: 2, need: 2 },
  ],
  solution: [0, 1, 2, 2],
};

async function render(screenReader: boolean, bridges: number[] = [0, 0, 0, 0]) {
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(screenReader);
  const onTapLane = jest.fn();
  const onAdjustLane = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <BridgesBoard puzzle={PUZZLE} state={{ bridges }} size={300} solved={false} onLane={() => {}} onTapLane={onTapLane} onAdjustLane={onAdjustLane} />,
    );
  });
  const lanes = renderer.root.findAll(node => node.props.accessibilityRole === 'adjustable' && typeof node.type === 'string');
  const islands = renderer.root.findAll(node => node.props.accessibilityRole === 'text' && typeof node.type === 'string');
  return { renderer, lanes, islands, onTapLane, onAdjustLane };
}

afterEach(() => jest.restoreAllMocks());

test('off: one plain surface, nothing laid over it', async () => {
  const { lanes, islands, renderer } = await render(false, emptyBridgesState(PUZZLE).bridges.slice());
  expect(lanes).toHaveLength(0);
  expect(islands).toHaveLength(0);
  expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Bridges board, 4 islands' && node.props.accessible).length).toBeGreaterThan(0);
});

test('on: every lane adjustable, every island reading its load', async () => {
  const { lanes, islands } = await render(true, [0, 1, 0, 2]);
  expect(lanes).toHaveLength(4);
  expect(islands).toHaveLength(4);
  expect(islands[2].props.accessibilityLabel).toBe('Island 3, row 3, column 1');
  expect(islands[2].props.accessibilityValue.text).toBe('complete, 3 bridges');
  expect(islands[1].props.accessibilityValue.text).toBe('0 of 2 bridges');
  const values = lanes.map(lane => lane.props.accessibilityValue.text);
  expect(values).toContain('two bridges');
  expect(values).toContain('one bridge');
});

test('swipes and double-taps reach the screen as one bridge more, fewer, or a tap', async () => {
  const { lanes, onAdjustLane, onTapLane } = await render(true);
  const fire = (i: number, actionName: string) => act(() => lanes[i].props.onAccessibilityAction({ nativeEvent: { actionName } }));
  fire(0, 'increment');
  fire(0, 'decrement');
  fire(1, 'activate');
  expect(onAdjustLane.mock.calls).toEqual([
    [expect.any(Number), 1],
    [expect.any(Number), -1],
  ]);
  expect(onTapLane).toHaveBeenCalledWith(expect.any(Number), 0.5);
});
