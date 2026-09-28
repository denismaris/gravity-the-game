import React, { Profiler } from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { TentsBoardView } from '../components/TentsBoardView';
import { BinairoBoardView } from '../components/BinairoBoardView';
import { TENTS_TREES, emptyTentsTreesState, isEligible, isRowSatisfied, setMark, solveTentsAndTrees } from '../game/tents';
import { BINAIRO, emptyBinairoState, nextValue } from '../game/binairo';

jest.useFakeTimers();
beforeEach(() => {
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 16) as unknown as number);
  jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => clearTimeout(id as unknown as ReturnType<typeof setTimeout>));
});
const rows: string[] = [];
afterAll(() => console.log(rows.join('\n')));

async function run(name: string, make: (s: unknown) => React.ReactElement, states: unknown[]) {
  let commits = 0; let ms = 0; let worst = 0;
  const onRender = (_i: string, _p: string, a: number) => { commits += 1; ms += a; worst = Math.max(worst, a); };
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => { r = ReactTestRenderer.create(<Profiler id="p" onRender={onRender}>{make(states[0])}</Profiler>); });
  for (let t = 0; t < 3000; t += 16) await act(async () => { jest.advanceTimersByTime(16); });
  commits = 0; ms = 0; worst = 0;
  const frameCommits: number[] = [];
  for (const s of states.slice(1)) {
    await act(async () => { r.update(<Profiler id="p" onRender={onRender}>{make(s)}</Profiler>); });
    const before = commits;
    for (let t = 0; t < 1400; t += 16) await act(async () => { jest.advanceTimersByTime(16); });
    frameCommits.push(commits - before);
  }
  rows.push(`${name.padEnd(28)} commits=${commits} ms=${ms.toFixed(1)} perCommit=${(ms / Math.max(1, commits)).toFixed(2)} worst=${worst.toFixed(2)} framesAfterEachMove=${JSON.stringify(frameCommits)}`);
  act(() => r.unmount());
}

test('tents: place a tent that completes a row', async () => {
  const puzzle = TENTS_TREES[TENTS_TREES.length - 1];
  const [solution] = solveTentsAndTrees(puzzle, 1);
  let s = emptyTentsTreesState(puzzle);
  const states: unknown[] = [s];
  // place solution tents one at a time
  for (let r = 0; r < puzzle.rows; r += 1) for (let c = 0; c < puzzle.cols; c += 1) {
    if (solution.marks[r][c] === 'tent' && states.length < 5) { s = setMark(s, puzzle, r, c, 'tent'); states.push(s); }
  }
  await run('tents (4 placements)', st => <TentsBoardView puzzle={puzzle} state={st as typeof s} cellSize={46} solved={false} />, states);
});

test('binairo: four taps', async () => {
  const puzzle = BINAIRO[BINAIRO.length - 1];
  let s = emptyBinairoState(puzzle);
  const states: unknown[] = [s];
  let placed = 0;
  for (let r = 0; r < puzzle.size && placed < 4; r += 1) for (let c = 0; c < puzzle.size && placed < 4; c += 1) {
    if (s.values[r][c] === null && !(puzzle.givens?.[r]?.[c] != null)) {
      s = { ...s, values: s.values.map((line, rr) => (rr === r ? line.map((v, cc) => (cc === c ? nextValue(v) : v)) : line)) } as typeof s;
      states.push(s); placed += 1;
    }
  }
  await run('binairo (4 taps)', st => <BinairoBoardView puzzle={puzzle} state={st as typeof s} size={360} solved={false} />, states);
});
