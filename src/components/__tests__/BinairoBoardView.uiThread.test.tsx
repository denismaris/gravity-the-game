import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { BinairoBoardView } from '../BinairoBoardView';
import { BinairoPuzzle, BinairoState } from '../../game/binairo';
import * as AnimationClockModule from '../../game/rendering/useAnimationClock';

/**
 * A tap on Binairo - the press glow under the finger and the stamp of the
 * new mark - plays on the UI thread, so it must not ask for the JavaScript
 * frame clock at all: that clock re-rendered the board's whole animated
 * layer 60 times a second for every tap, which was the lag felt on a
 * phone. (Spied on its defining module - see the error-timing test for
 * why.)
 */
describe('BinairoBoardView - a tap runs no JavaScript clock', () => {
  let clockSpy: jest.SpyInstance;

  beforeEach(() => {
    clockSpy = jest.spyOn(AnimationClockModule, 'useAnimationClock');
    jest.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1 as unknown as number);
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  const puzzle: BinairoPuzzle = {
    id: 'fixture-ui-thread',
    difficulty: 'easy',
    size: 4,
    givens: [
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
  };
  const empty: BinairoState = { values: puzzle.givens.map(row => row.slice()) };
  const oneMark: BinairoState = { values: [[1, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]] };
  const lastActive = () => clockSpy.mock.calls[clockSpy.mock.calls.length - 1][0] as boolean;

  test('press, release and stamp: the clock stays off, and the stamp animates itself', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    const view = (state: BinairoState, pressedCell: { row: number; col: number } | null) => (
      <BinairoBoardView puzzle={puzzle} state={state} size={320} solved={false} pressedCell={pressedCell} />
    );
    jest.spyOn(Date, 'now').mockReturnValue(0);
    act(() => {
      renderer = ReactTestRenderer.create(view(empty, null));
    });
    jest.spyOn(Date, 'now').mockReturnValue(5000);
    act(() => renderer.update(view(empty, null)));
    expect(lastActive()).toBe(false);

    // Finger down on a cell.
    act(() => renderer.update(view(empty, { row: 0, col: 0 })));
    expect(lastActive()).toBe(false);
    // Lifted, and the mark lands.
    jest.spyOn(Date, 'now').mockReturnValue(5040);
    act(() => renderer.update(view(oneMark, null)));
    expect(lastActive()).toBe(false);

    // The stamp is drawn from shared values the UI thread drives, not
    // from numbers computed in this render.
    const animated = renderer.root.findAll(node => node.props.opacity?.value !== undefined && node.props.transform?.value !== undefined);
    expect(animated.length).toBeGreaterThan(0);

    act(() => renderer.unmount());
  });
});
