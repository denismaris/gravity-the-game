import { createMemoryBackend } from '../../storage';
import { forgetAllBoards, forgetBoard, hasSavedBoard, loadBoardSaves, sameShape, saveBoard, savedBoard } from '../boardSaves';

describe('boardSaves', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await loadBoardSaves(createMemoryBackend());
    forgetAllBoards();
  });
  afterEach(() => jest.useRealTimers());

  test('a board saved is read back, with its counters', () => {
    saveBoard('glass-1', { colors: [0, null, 2] }, { hints: 1 });
    expect(savedBoard('glass-1', { colors: [null, null, null] })).toEqual({ state: { colors: [0, null, 2] }, extras: { hints: 1 } });
    expect(hasSavedBoard('glass-1')).toBe(true);
  });

  test('a save that no longer fits its board is dropped, not trusted', () => {
    saveBoard('glass-2', { colors: [0, 1] });
    expect(savedBoard('glass-2', { colors: [null, null, null] })).toBeNull();
    expect(hasSavedBoard('glass-2')).toBe(false);
  });

  test('forgetting one board leaves the rest', () => {
    saveBoard('a', { n: 1 });
    saveBoard('b', { n: 2 });
    forgetBoard('a');
    expect(hasSavedBoard('a')).toBe(false);
    expect(hasSavedBoard('b')).toBe(true);
  });

  test('only the newest forty are kept', () => {
    for (let i = 0; i < 45; i += 1) {
      jest.setSystemTime(1_000_000 + i);
      saveBoard(`p${i}`, { n: i });
    }
    expect(hasSavedBoard('p0')).toBe(false);
    expect(hasSavedBoard('p44')).toBe(true);
  });

  test('shapes compare by keys and array lengths, all the way down', () => {
    expect(sameShape({ grid: [[0, 1], [1, 0]], score: 3 }, { grid: [[null, null], [null, null]], score: 0 })).toBe(true);
    expect(sameShape({ grid: [[0, 1]] }, { grid: [[null, null], [null, null]] })).toBe(false);
    expect(sameShape({ dirs: [0] }, { dirs: [0], extra: 1 })).toBe(false);
  });

  test('saves survive a reload from storage', async () => {
    const storage = createMemoryBackend();
    await loadBoardSaves(storage);
    saveBoard('lily-1', { at: 3 }, { hints: 0 });
    jest.runAllTimers();
    await Promise.resolve();
    await loadBoardSaves(storage);
    expect(savedBoard('lily-1', { at: 0 })?.state).toEqual({ at: 3 });
  });
});
