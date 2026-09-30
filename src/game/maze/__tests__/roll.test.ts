import { planRoll, pointAt, rollTiming } from '../roll';
import { MazeShape, cellKey, edgeKey } from '../shape';

function mazeFrom(lines: string[]): MazeShape {
  const active = new Set<string>();
  lines.forEach((line, row) => [...line].forEach((ch, col) => ch === '#' && active.add(cellKey(col, row))));
  const openEdges = new Set<string>();
  for (const key of active) {
    const [col, row] = key.split(':').map(Number);
    if (active.has(cellKey(col + 1, row))) openEdges.add(edgeKey({ col, row }, { col: col + 1, row }));
    if (active.has(cellKey(col, row + 1))) openEdges.add(edgeKey({ col, row }, { col, row: row + 1 }));
  }
  return { cols: lines[0].length, rows: lines.length, active, openEdges, start: { col: 0, row: 0 } };
}

const R = 0.38;
// ####
// #..#
// ####
const RING = mazeFrom(['####', '#..#', '####']);

describe('planRoll', () => {
  test('rolls to the wall and stops with its edge against it', () => {
    const plan = planRoll(RING, { x: 0.5, y: 0.5 }, { dc: 1, dr: 0 }, null, R);
    expect(plan.hitsWall).toBe(true);
    expect(plan.end.x).toBeCloseTo(4 - R);
    expect(plan.end.y).toBeCloseTo(0.5);
    expect(plan.entries.map(e => e.key)).toEqual(['1:0', '2:0', '3:0']);
    expect(plan.entries.map(e => e.at)).toEqual([0.5, 1.5, 2.5]);
  });

  test('takes a queued turn at the first square that opens that way', () => {
    const plan = planRoll(RING, { x: 1.5, y: 0.5 }, { dc: 1, dr: 0 }, { dc: 0, dr: 1 }, R);
    // Straight past the hole, down at the far corner.
    expect(plan.points).toEqual([
      { x: 1.5, y: 0.5 },
      { x: 3.5, y: 0.5 },
      { x: 3.5, y: 3 - R },
    ]);
    expect(plan.heading).toEqual({ dc: 0, dr: 1 });
    expect(plan.entries.map(e => e.key)).toEqual(['2:0', '3:0', '3:1', '3:2']);
  });

  test('a turn open right here is taken at once, snapping to the centre', () => {
    const plan = planRoll(RING, { x: 0.4, y: 0.5 }, { dc: 1, dr: 0 }, { dc: 0, dr: 1 }, R);
    expect(plan.points[1]).toEqual({ x: 0.5, y: 0.5 });
    expect(plan.heading).toEqual({ dc: 0, dr: 1 });
  });

  test('a blocked direction goes nowhere', () => {
    const plan = planRoll(RING, { x: 0.5, y: 0.5 }, { dc: -1, dr: 0 }, null, R);
    expect(plan.length).toBeCloseTo(0.5 - R);
    const still = planRoll(RING, { x: R, y: 0.5 }, { dc: -1, dr: 0 }, null, R);
    expect(still.length).toBe(0);
    expect(still.hitsWall).toBe(false);
  });

  test('pointAt follows the corners', () => {
    const plan = planRoll(RING, { x: 1.5, y: 0.5 }, { dc: 1, dr: 0 }, { dc: 0, dr: 1 }, R);
    expect(pointAt(plan, 1)).toEqual({ x: 2.5, y: 0.5 });
    expect(pointAt(plan, 3)).toEqual({ x: 3.5, y: 1.5 });
    expect(pointAt(plan, 99)).toEqual(plan.end);
  });
});

describe('rollTiming', () => {
  test('from rest it gathers pace, then holds it', () => {
    const timing = rollTiming(6, 20, 0.8, true);
    // The first square takes longer than any later one.
    const first = timing.timeAt(1);
    const later = timing.timeAt(5) - timing.timeAt(4);
    expect(first).toBeGreaterThan(later);
    expect(later).toBeCloseTo(50);
    expect(timing.timeAt(6)).toBeCloseTo(timing.durationMs);
  });

  test('its easing runs 0 to 1 and never goes backwards', () => {
    const timing = rollTiming(4.2, 22, 0.8, true);
    let previous = 0;
    for (let u = 0; u <= 1.0001; u += 0.01) {
      const v = timing.easing(u);
      expect(v).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = v;
    }
    expect(timing.easing(0)).toBe(0);
    expect(timing.easing(1)).toBeCloseTo(1);
  });

  test('already moving, it is constant speed', () => {
    const timing = rollTiming(4, 20, 0.8, false);
    expect(timing.durationMs).toBeCloseTo(200);
    expect(timing.easing(0.5)).toBeCloseTo(0.5);
  });
});
