import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Animated } from 'react-native';
import { MosaicPlay, mosaicTrayLayout } from '../MosaicPlay';
import { mosaicGeometry } from '../MosaicBoardView';
import { MosaicPuzzle, MosaicState } from '../../game/mosaic';

/**
 * The drag can't be exercised on the simulator from a script (simctl has
 * no touch), so these drive the real PanResponder with synthetic touches -
 * the same touch-history shape React Native's responder system builds -
 * and check what the play surface asks its screen to do.
 */
const PUZZLE: MosaicPuzzle = {
  id: 'mosaic-gesture-fixture',
  difficulty: 'easy',
  subject: 'bar',
  theme: 'hearth',
  rows: 2,
  cols: 3,
  silhouette: [
    [true, true, true],
    [true, true, true],
  ],
  pieces: [
    { id: 'p0', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }], color: 0 },
    { id: 'p1', cells: [{ row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }], color: 1 },
  ],
  solution: [
    { rotation: 0, flipped: false, row: 0, col: 0 },
    { rotation: 0, flipped: false, row: 0, col: 1 },
  ],
  start: [
    { rotation: 0, flipped: false },
    { rotation: 0, flipped: false },
  ],
  allowFlip: false,
  fixed: [false, false],
};
const STATE: MosaicState = { pieces: PUZZLE.start.map(o => ({ ...o, at: null })) };
const WIDTH = 300;
const geo = mosaicGeometry(PUZZLE, WIDTH, 200);
const boardX = (WIDTH - geo.width) / 2;
// Two pieces: one tray row, two slots with a gap, centred - from the same
// layout function the play surface uses.
const tray = mosaicTrayLayout(2, WIDTH);
const slot0 = { x: (WIDTH - (tray.slot * 2 + 8)) / 2 + tray.slot / 2, y: geo.height + 18 + tray.slot / 2 };

/** A one-finger touch, in the shape PanResponder reads. */
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

describe('MosaicPlay - the hand', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  let mounted: ReactTestRenderer.ReactTestRenderer | null = null;
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
      mounted?.unmount();
    });
    mounted = null;
    jest.useRealTimers();
  });

  function mount() {
    const calls = { onPlace: jest.fn(), onLift: jest.fn(), onRotate: jest.fn(), onFeedback: jest.fn() };
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<MosaicPlay puzzle={PUZZLE} state={STATE} width={WIDTH} maxBoardHeight={200} solved={false} {...calls} />);
    });
    mounted = renderer;
    const surface = renderer.root.find(node => typeof node.props.onResponderGrant === 'function');
    return { calls, surface };
  }

  /**
   * Regression test for tray pieces that stayed invisible on a phone until
   * tapped. Each piece used to be its own small canvas, and fresh canvases
   * mounting together inside the screen's entrance fade could fail to paint
   * until something redrew them. The tray is now one canvas: the whole
   * surface is exactly two (board and tray), however many pieces, and
   * every loose piece is drawn from the very first render.
   */
  test('the surface is two canvases, and every tray piece is drawn from the first render', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <MosaicPlay puzzle={PUZZLE} state={STATE} width={WIDTH} maxBoardHeight={200} solved={false} onPlace={jest.fn()} onLift={jest.fn()} onRotate={jest.fn()} />,
      );
    });
    mounted = renderer;
    expect(renderer.root.findAll(node => (node.type as unknown) === 'SkiaCanvasMock')).toHaveLength(2);
    const trayPieces = renderer.root.findAll(node => typeof node.props.cellSize === 'number' && Array.isArray(node.props.cells) && node.props.seed !== undefined && node.props.part === undefined && node.props.set === undefined);
    expect(trayPieces.map(node => node.props.seed).sort()).toEqual([0, 1]);
  });

  test('a tap on a piece in the tray turns it', () => {
    const { calls, surface } = mount();
    const touch = touchAt();
    act(() => {
      surface.props.onStartShouldSetResponder(touch.down(slot0.x, slot0.y));
      surface.props.onResponderGrant(touch.down(slot0.x, slot0.y));
      surface.props.onResponderRelease(touch.up(slot0.x, slot0.y));
    });
    expect(calls.onRotate).toHaveBeenCalledWith(0);
    expect(calls.onPlace).not.toHaveBeenCalled();
  });

  test('dragging a piece over its place and letting go sets it there', () => {
    const { calls, surface } = mount();
    const touch = touchAt();
    // Held by its middle, floating 1.1 squares above the finger: to land
    // its corner on (0, 0) the finger goes to the piece's middle below it.
    const target = { x: boardX + geo.pad + geo.cellSize, y: geo.pad + geo.cellSize + 1.1 * geo.cellSize };
    act(() => {
      surface.props.onStartShouldSetResponder(touch.down(slot0.x, slot0.y));
      surface.props.onResponderGrant(touch.down(slot0.x, slot0.y));
      for (let i = 1; i <= 10; i += 1) {
        const x = slot0.x + ((target.x - slot0.x) * i) / 10;
        const y = slot0.y + ((target.y - slot0.y) * i) / 10;
        surface.props.onResponderMove(touch.move(x, y));
      }
      surface.props.onResponderRelease(touch.up(target.x, target.y));
    });
    expect(calls.onFeedback).toHaveBeenCalledWith('pickup');
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(calls.onPlace).toHaveBeenCalledWith(0, 0, 0);
    expect(calls.onRotate).not.toHaveBeenCalled();
  });

  test('a set piece on the board cannot be picked up', () => {
    const calls = { onPlace: jest.fn(), onLift: jest.fn(), onRotate: jest.fn(), onFeedback: jest.fn() };
    const puzzle = { ...PUZZLE, fixed: [true, false] };
    const state: MosaicState = { pieces: [{ rotation: 0, flipped: false, at: { row: 0, col: 0 } }, { rotation: 0, flipped: false, at: null }] };
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<MosaicPlay puzzle={puzzle} state={state} width={WIDTH} maxBoardHeight={200} solved={false} {...calls} />);
    });
    mounted = renderer;
    const surface = renderer.root.find(node => typeof node.props.onResponderGrant === 'function');
    const touch = touchAt();
    const onSetPiece = { x: boardX + geo.pad + geo.cellSize / 2, y: geo.pad + geo.cellSize / 2 };
    act(() => {
      surface.props.onStartShouldSetResponder(touch.down(onSetPiece.x, onSetPiece.y));
      surface.props.onResponderGrant(touch.down(onSetPiece.x, onSetPiece.y));
      for (let i = 1; i <= 6; i += 1) surface.props.onResponderMove(touch.move(onSetPiece.x + i * 15, onSetPiece.y + i * 15));
      surface.props.onResponderRelease(touch.up(onSetPiece.x + 90, onSetPiece.y + 90));
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(calls.onFeedback).not.toHaveBeenCalledWith('pickup');
    expect(calls.onLift).not.toHaveBeenCalled();
    expect(calls.onPlace).not.toHaveBeenCalled();
  });

  /**
   * Regression test for the buggy return. The carried piece used to scale
   * about its top-left corner while its target assumed its centre, so it
   * flew home to the wrong spot and snapped when the tray took over. Its
   * box now scales about its own centre - so the flight's target box,
   * centred, must sit exactly on the slot's centre.
   */
  test('a piece sent home flies to the exact centre of its tray slot', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const { surface } = mount();
    const touch = touchAt();
    act(() => {
      surface.props.onStartShouldSetResponder(touch.down(slot0.x, slot0.y));
      surface.props.onResponderGrant(touch.down(slot0.x, slot0.y));
      for (let i = 1; i <= 6; i += 1) surface.props.onResponderMove(touch.move(slot0.x + i * 20, slot0.y + i * 4));
      surface.props.onResponderRelease(touch.up(slot0.x + 120, slot0.y + 24));
    });
    const flight = timing.mock.calls.map(call => call[1].toValue).find(v => typeof v === 'object' && v !== null) as { x: number; y: number };
    expect(flight).toBeDefined();
    // Piece 0 is an L, two squares by two; its box has an even margin.
    const margin = Math.round(geo.cellSize * 0.5);
    const box = 2 * geo.cellSize + margin * 2;
    expect(flight.x + box / 2).toBeCloseTo(slot0.x, 5);
    expect(flight.y + box / 2).toBeCloseTo(slot0.y, 5);
    timing.mockRestore();
  });

  test('letting go where it cannot fit sends it home, placing nothing', () => {
    const { calls, surface } = mount();
    const touch = touchAt();
    act(() => {
      surface.props.onStartShouldSetResponder(touch.down(slot0.x, slot0.y));
      surface.props.onResponderGrant(touch.down(slot0.x, slot0.y));
      for (let i = 1; i <= 6; i += 1) surface.props.onResponderMove(touch.move(slot0.x + i * 20, slot0.y + i * 4));
      surface.props.onResponderRelease(touch.up(slot0.x + 120, slot0.y + 24));
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(calls.onPlace).not.toHaveBeenCalled();
    expect(calls.onFeedback).toHaveBeenCalledWith('return');
  });
});
