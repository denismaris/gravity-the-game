import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { History, useHistoryState } from '../useHistoryState';

/** Undo steps back one move at a time, and a restart forgets them. */
describe('useHistoryState', () => {
  let api!: { state: number; set: (u: number | ((c: number) => number)) => void; history: History<number> };
  function Probe(): null {
    const [state, set, history] = useHistoryState(() => 0);
    api = { state, set, history };
    return null;
  }
  beforeEach(() => {
    act(() => {
      ReactTestRenderer.create(<Probe />);
    });
  });

  test('each change can be stepped back, newest first', () => {
    act(() => api.set(1));
    act(() => api.set(c => c + 1));
    expect(api.state).toBe(2);
    expect(api.history.canUndo).toBe(true);
    act(() => {
      api.history.undo();
    });
    expect(api.state).toBe(1);
    act(() => {
      api.history.undo();
    });
    expect(api.state).toBe(0);
    expect(api.history.canUndo).toBe(false);
    act(() => {
      expect(api.history.undo()).toBeNull();
    });
  });

  test('a change to the same state records nothing', () => {
    act(() => api.set(0));
    expect(api.history.canUndo).toBe(false);
  });

  test('two changes in one tick chain, and each is its own step', () => {
    act(() => {
      api.set(c => c + 1);
      api.set(c => c + 1);
    });
    expect(api.state).toBe(2);
    act(() => {
      api.history.undo();
    });
    expect(api.state).toBe(1);
  });

  test('clearing forgets every earlier move', () => {
    act(() => api.set(5));
    act(() => api.history.clear());
    expect(api.history.canUndo).toBe(false);
    expect(api.state).toBe(5);
  });
});
