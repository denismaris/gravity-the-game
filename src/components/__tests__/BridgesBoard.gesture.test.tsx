import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { BridgesBoard } from '../BridgesBoard';
import { bridgesGeometry } from '../BridgesBoardView';
import { BridgesPuzzle, BridgesState, bridgeLinks, emptyBridgesState } from '../../game/bridges';

/**
 * simctl has no touch, so these drive the board's real PanResponder with
 * synthetic touches - the same touch-history shape React Native's
 * responder system builds - and check what the board asks its screen to do.
 */

// 1 . 2      islands at (0,0), (0,2), (2,2); lanes: top (0-1), right (1-2)
// . . .
// . . 1
const PUZZLE: BridgesPuzzle = {
  id: 'bridges-gesture-fixture',
  difficulty: 'easy',
  rows: 3,
  cols: 3,
  islands: [
    { row: 0, col: 0, need: 1 },
    { row: 0, col: 2, need: 2 },
    { row: 2, col: 2, need: 1 },
  ],
  solution: [1, 1],
};
const SIZE = 300;
const GEO = bridgesGeometry(PUZZLE, SIZE);
const centre = (row: number, col: number) => ({ x: GEO.inset + (col + 0.5) * GEO.cell, y: GEO.inset + (row + 0.5) * GEO.cell });

function touchAt() {
  let t = 1000;
  const record = {
    touchActive: true,
    startPageX: 0,
    startPageY: 0,
    startTimeStamp: t,
    currentPageX: 0,
    currentPageY: 0,
    currentTimeStamp: t,
    previousPageX: 0,
    previousPageY: 0,
    previousTimeStamp: t,
  };
  const history = { numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: t, touchBank: [record] };
  const event = (x: number, y: number) => ({
    nativeEvent: { locationX: x, locationY: y, pageX: x, pageY: y, timestamp: t, touches: [{}], changedTouches: [{}], identifier: 0 },
    touchHistory: history,
  });
  return {
    down(x: number, y: number) {
      Object.assign(record, { startPageX: x, startPageY: y, currentPageX: x, currentPageY: y, previousPageX: x, previousPageY: y });
      return event(x, y);
    },
    move(x: number, y: number) {
      t += 16;
      Object.assign(record, { previousPageX: record.currentPageX, previousPageY: record.currentPageY, previousTimeStamp: record.currentTimeStamp, currentPageX: x, currentPageY: y, currentTimeStamp: t });
      history.mostRecentTimeStamp = t;
      return event(x, y);
    },
    up(x: number, y: number) {
      record.touchActive = false;
      history.numberActiveTouches = 0;
      return event(x, y);
    },
  };
}

describe('BridgesBoard - the hand', () => {
  beforeEach(() => jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1 as unknown as number));
  afterEach(() => jest.restoreAllMocks());

  function mount(state: BridgesState = emptyBridgesState(PUZZLE)) {
    const calls = { onLane: jest.fn(), onTapLane: jest.fn() };
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<BridgesBoard puzzle={PUZZLE} state={state} size={SIZE} solved={false} {...calls} />);
    });
    const surface = renderer.root.find(node => typeof node.props.onResponderGrant === 'function');
    return { calls, surface, renderer };
  }

  function drag(surface: ReactTestRenderer.ReactTestInstance, from: { x: number; y: number }, to: { x: number; y: number }) {
    const touch = touchAt();
    act(() => {
      surface.props.onStartShouldSetResponder(touch.down(from.x, from.y));
      surface.props.onResponderGrant(touch.down(from.x, from.y));
    });
    const steps = 6;
    for (let i = 1; i <= steps; i += 1) {
      const x = from.x + ((to.x - from.x) * i) / steps;
      const y = from.y + ((to.y - from.y) * i) / steps;
      act(() => surface.props.onResponderMove(touch.move(x, y)));
    }
    act(() => surface.props.onResponderRelease(touch.up(to.x, to.y)));
  }

  test('dragging from an island past halfway lays a bridge from that island', () => {
    const { calls, surface } = mount();
    const a = centre(0, 0);
    drag(surface, a, { x: a.x + GEO.cell * 1.3, y: a.y + 8 });
    expect(calls.onLane).toHaveBeenCalledWith(0, 0);
  });

  test('dragging from the far end works the same way, from that island', () => {
    const { calls, surface } = mount();
    const b = centre(0, 2);
    drag(surface, b, { x: b.x - GEO.cell * 1.5, y: b.y });
    expect(calls.onLane).toHaveBeenCalledWith(0, 1);
  });

  test('a short drag, or one toward open water, lays nothing', () => {
    const { calls, surface } = mount();
    const a = centre(0, 0);
    drag(surface, a, { x: a.x + GEO.cell * 0.5, y: a.y });
    drag(surface, a, { x: a.x, y: a.y + GEO.cell * 1.8 });
    expect(calls.onLane).not.toHaveBeenCalled();
  });

  test('a tap on a built bridge cycles it; a tap off every lane does nothing', () => {
    const links = bridgeLinks(PUZZLE);
    const right = links.findIndex(l => !l.horizontal);
    const state: BridgesState = { bridges: links.map(l => (l.index === right ? 1 : 0)) };
    const { calls, surface } = mount(state);
    const mid = centre(1, 2);
    drag(surface, mid, mid);
    expect(calls.onTapLane).toHaveBeenCalledWith(right, expect.any(Number));
    drag(surface, centre(2, 0), centre(2, 0));
    expect(calls.onTapLane).toHaveBeenCalledTimes(1);
  });

  test('a tap on the open water between two islands lays a bridge there', () => {
    const { calls, surface } = mount();
    const between = centre(0, 1);
    drag(surface, between, between);
    expect(calls.onTapLane).toHaveBeenCalledTimes(1);
    const [link, at] = calls.onTapLane.mock.calls[0];
    expect(link).toBe(bridgeLinks(PUZZLE).findIndex(l => l.horizontal));
    expect(at).toBeGreaterThan(0.4);
    expect(at).toBeLessThan(0.6);
  });

  test('while the finger is down on an island, the board shows a drag', () => {
    const { surface, renderer } = mount();
    const touch = touchAt();
    const a = centre(0, 0);
    act(() => {
      surface.props.onStartShouldSetResponder(touch.down(a.x, a.y));
      surface.props.onResponderGrant(touch.down(a.x, a.y));
    });
    const view = renderer.root.find(node => node.props.drag !== undefined && node.props.puzzle === PUZZLE && node.props.onLane === undefined);
    expect(view.props.drag).toMatchObject({ source: 0, link: null });
    act(() => surface.props.onResponderMove(touch.move(a.x + GEO.cell, a.y)));
    const after = renderer.root.find(node => node.props.drag !== undefined && node.props.puzzle === PUZZLE && node.props.onLane === undefined);
    expect(after.props.drag).toMatchObject({ source: 0, link: 0, snapped: true });
  });
});
