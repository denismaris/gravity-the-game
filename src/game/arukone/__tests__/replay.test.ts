import { ARUKONE, ArukonePuzzle, ArukoneState, beginDraw, extendDraw, getArukoneById, isArukoneSolved } from '..';

/** Draws every pair along its own answer, square by square, through the
 * real drawing rules - so a board whose answer the rules refuse fails. */
function drawAnswer(p: ArukonePuzzle): ArukoneState | null {
  let s: ArukoneState = { paths: {} };
  for (const pair of p.pairs) {
    const answer = p.solution[pair.value];
    const done = s.paths[pair.value];
    if (done && done.length === answer.length) continue;
    const start = beginDraw(p, s, answer[0]);
    if (!start) return null;
    s = start.state;
    for (let i = 1; i < answer.length; i += 1) {
      const now = s.paths[pair.value] ?? [];
      if (now.length === answer.length) break;
      const next = extendDraw(p, s, start.value, answer[i]);
      if (next === s) return null;
      s = next;
    }
  }
  return s;
}

describe('every board can be drawn along its own answer', () => {
  test('Winding Loop: a path that brushes its fold before crossing it can still be drawn', () => {
    const p = getArukoneById('arukone-e-medium-21')!;
    expect(p.name).toBe('Winding Loop');
    const s = drawAnswer(p);
    expect(s && isArukoneSolved(p, s)).toBe(true);
  });

  test('the shipped pool and a run of endless boards', () => {
    const boards = [...ARUKONE, ...[...Array(30).keys()].flatMap(i => (['easy', 'medium', 'hard'] as const).map(t => getArukoneById(`arukone-e-${t}-${i}`)!))];
    for (const p of boards) {
      const s = drawAnswer(p);
      expect(s && isArukoneSolved(p, s)).toBe(true);
    }
  });
});
