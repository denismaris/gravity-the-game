import { useCallback, useMemo, useRef, useState } from 'react';

/** How many moves back Undo reaches. */
const DEPTH = 200;

export interface History<T> {
  /** Steps back one move. */
  undo: () => T | null;
  canUndo: boolean;
  /** Forgets every earlier move (a restart, a new board). */
  clear: () => void;
}

/**
 * A board's state that remembers the states it replaced, so a game gets
 * Undo by swapping its `useState` for this: every change made through the
 * returned setter can be stepped back, one move at a time. A setter call
 * that returns the same state records nothing.
 *
 * The current state is also kept in a ref and read by the setter, so two
 * changes in one tick chain off each other as functional updates do.
 */
export function useHistoryState<T>(initial: () => T): [T, (update: T | ((current: T) => T)) => void, History<T>] {
  const [state, setRaw] = useState(initial);
  const current = useRef(state);
  const past = useRef<T[]>([]);
  const [, setDepth] = useState(0);

  const set = useCallback((update: T | ((value: T) => T)) => {
    const before = current.current;
    const next = typeof update === 'function' ? (update as (value: T) => T)(before) : update;
    if (next === before) return;
    past.current = [...past.current.slice(-(DEPTH - 1)), before];
    current.current = next;
    setRaw(next);
    setDepth(past.current.length);
  }, []);

  const undo = useCallback((): T | null => {
    const previous = past.current[past.current.length - 1];
    if (previous === undefined) return null;
    past.current = past.current.slice(0, -1);
    current.current = previous;
    setRaw(previous);
    setDepth(past.current.length);
    return previous;
  }, []);

  const clear = useCallback(() => {
    past.current = [];
    setDepth(0);
  }, []);

  const canUndo = past.current.length > 0;
  const history = useMemo(() => ({ undo, canUndo, clear }), [undo, canUndo, clear]);
  return [state, set, history];
}
