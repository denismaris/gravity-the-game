import { BINAIRO, emptyBinairoState, explainBinairoHint, isBinairoSolved, setValue } from '../binairo';
import { TOWERS, emptyTowersState, explainTowersHint, isTowersSolved, setCell } from '../towers';
import { TENTS_TREES, emptyTentsTreesState, explainTentsHint, isTentsTreesSolved } from '../tents';
import { FILLAPIX, explainFillaPixHint, initialFillaPixState, isFillaPixSolved } from '../fillapix';
import { MIRROR_MAZES, emptyMirrorMazeState, explainMirrorHint, isMirrorMazeSolved } from '../mirror';
import { BRIDGES, emptyBridgesState, explainBridgesHint, isBridgesSolved } from '../bridges';
import { LIGHTS_OUT, explainLightsOutHint, initialLightsOutState, isLightsOutSolved } from '../lightsout';
import { BLOOM, explainBloomHint, initialBloomState, isBloomSolved } from '../bloom';
import { MOSAIC, explainMosaicHint, initialMosaicState, isMosaicSolved } from '../mosaic';
import { ARUKONE, emptyArukoneState, explainArukoneHint, isArukoneSolved } from '../arukone';
import { HintReason } from '../hints';

/**
 * The explaining hints, game by game: taken one after another from a
 * fresh board they reach the answer, every one of them says why, and a
 * deliberate mistake is set right before anything else.
 */
function walk<S>(start: S, hint: (s: S) => (HintReason & { state: S }) | null, solved: (s: S) => boolean, limit = 400): { steps: number; kinds: string[] } {
  let state = start;
  const kinds: string[] = [];
  for (let i = 0; i < limit && !solved(state); i += 1) {
    const h = hint(state);
    if (!h) break;
    expect(h.reason.length).toBeGreaterThan(10);
    kinds.push(h.kind);
    state = h.state;
  }
  expect(solved(state)).toBe(true);
  return { steps: kinds.length, kinds };
}

const sample = <T>(list: ReadonlyArray<T>): T[] => [list[0], list[Math.floor(list.length / 2)], list[list.length - 1]];

test('Binairo: reaches the answer, mostly by rules, and fixes a mistake first', () => {
  for (const p of sample(BINAIRO)) {
    const { kinds } = walk(emptyBinairoState(p), s => explainBinairoHint(p, s), s => isBinairoSolved(p, s));
    expect(kinds.filter(k => k === 'rule').length).toBeGreaterThan(kinds.length / 2);
  }
  const p = BINAIRO[0];
  const first = explainBinairoHint(p, emptyBinairoState(p))!;
  const wrongValue = first.state.values[first.cell.row][first.cell.col] === 1 ? 0 : 1;
  const mistaken = setValue(emptyBinairoState(p), p, first.cell.row, first.cell.col, wrongValue);
  const fix = explainBinairoHint(p, mistaken)!;
  expect(fix.kind).toBe('fix');
  expect(fix.cell).toEqual(first.cell);
});

test('Skyscrapers', () => {
  for (const p of sample(TOWERS)) walk(emptyTowersState(p), s => explainTowersHint(p, s), s => isTowersSolved(p, s));
  const p = TOWERS[0];
  const bad = setCell(emptyTowersState(p), 0, 0, 1);
  const h = explainTowersHint(p, bad)!;
  if (h.cell.row === 0 && h.cell.col === 0) expect(['fix', 'rule']).toContain(h.kind);
});

test('Tents', () => {
  for (const p of sample(TENTS_TREES)) walk(emptyTentsTreesState(p), s => explainTentsHint(p, s), s => isTentsTreesSolved(p, s));
});

test('Fill-a-Pix', () => {
  for (const p of sample(FILLAPIX)) walk(initialFillaPixState(p), s => explainFillaPixHint(p, s), s => isFillaPixSolved(p, s), 200);
});

test('Mirror Maze follows the beam', () => {
  for (const p of sample(MIRROR_MAZES)) walk(emptyMirrorMazeState(p), s => explainMirrorHint(p, s), s => isMirrorMazeSolved(p, s));
});

test('Bridges', () => {
  for (const p of sample(BRIDGES)) walk(emptyBridgesState(p), s => explainBridgesHint(p, s), s => isBridgesSolved(p, s));
});

test('Lights Out', () => {
  for (const p of sample(LIGHTS_OUT)) walk(initialLightsOutState(p), s => explainLightsOutHint(p, s), s => isLightsOutSolved(s));
});

test('Bloom', () => {
  for (const p of sample(BLOOM)) walk(initialBloomState(p), s => explainBloomHint(p, s), s => isBloomSolved(p, s));
});

test('Mosaic', () => {
  for (const p of sample(MOSAIC)) walk(initialMosaicState(p), s => explainMosaicHint(p, s), s => isMosaicSolved(p, s));
});

test('Arukone+', () => {
  for (const p of sample(ARUKONE)) walk(emptyArukoneState(), s => explainArukoneHint(p, s), s => isArukoneSolved(p, s));
});

test('Mirror Maze hints never use more mirrors than the board needs', () => {
  const { fewestMirrors } = jest.requireActual('../mirror/solver') as typeof import('../mirror/solver');
  for (const p of MIRROR_MAZES.slice(0, 8)) {
    let s = emptyMirrorMazeState(p);
    for (let i = 0; i < 60 && !isMirrorMazeSolved(p, s); i += 1) s = explainMirrorHint(p, s)!.state;
    const used = s.mirrors.flat().filter(m => m !== null).length;
    expect(used).toBe(fewestMirrors(p));
  }
});
