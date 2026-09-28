import {
  ACTS,
  actProgress,
  clamp01,
  easeInOut,
  easeOut,
  launchPieces,
  letterProgress,
  piecePointsAt,
  pieceProgress,
  SHEEN,
  sheenBandPoints,
  sheenOpacity,
  sheenTravel,
  TOTAL_MS,
} from '../launchChoreography';

describe('easing', () => {
  test.each([easeOut, easeInOut])('pins both ends and stays inside 0..1', ease => {
    expect(ease(0)).toBeCloseTo(0, 6);
    expect(ease(1)).toBeCloseTo(1, 6);
    for (let t = -0.5; t <= 1.5; t += 0.1) {
      const v = ease(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  test.each([easeOut, easeInOut])('never goes backwards', ease => {
    let previous = -Infinity;
    for (let t = 0; t <= 1; t += 0.02) {
      const v = ease(t);
      expect(v).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = v;
    }
  });

  test('easeOut decelerates - it is past halfway before half the time', () => {
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });

  test('clamp01 survives the values a clock can actually produce', () => {
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(1);
    expect(clamp01(-Infinity)).toBe(0);
  });
});

describe('act structure', () => {
  test('acts run in order and overlap, so nothing waits for a full stop', () => {
    const { tileIn, assemble, wordmark, handoff } = ACTS;
    expect(assemble.start).toBeGreaterThan(tileIn.start);
    expect(assemble.start).toBeLessThan(tileIn.end);
    expect(wordmark.start).toBeLessThan(assemble.end);
    expect(handoff.start).toBeGreaterThan(wordmark.end);
    expect(TOTAL_MS).toBe(handoff.end);
  });

  /** A launch animation is charged to every cold start. Two seconds is the
   * outer limit of what is worth watching twice. */
  test('the whole sequence stays under two seconds', () => {
    expect(TOTAL_MS).toBeLessThanOrEqual(2000);
  });

  test('actProgress spans exactly its own act', () => {
    expect(actProgress(ACTS.tileIn.start, ACTS.tileIn)).toBe(0);
    expect(actProgress(ACTS.tileIn.end, ACTS.tileIn)).toBe(1);
    expect(actProgress(ACTS.tileIn.end + 5000, ACTS.tileIn)).toBe(1);
    expect(actProgress(-100, ACTS.tileIn)).toBe(0);
  });
});

describe('the pieces', () => {
  const pieces = launchPieces();

  test('there are eighteen, each a closed polygon', () => {
    expect(pieces).toHaveLength(18);
    for (const piece of pieces) {
      expect(piece.points.length).toBeGreaterThanOrEqual(3);
      for (const [x, y] of piece.points) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
      }
    }
  });

  test('every piece fits inside the tile it lands on', () => {
    for (const piece of pieces) {
      for (const [x, y] of piece.points) {
        expect(Math.abs(x)).toBeLessThanOrEqual(1);
        expect(Math.abs(y)).toBeLessThanOrEqual(1);
      }
    }
  });

  test('each flies in along a unit vector (uniform travel) or grows in place', () => {
    for (const piece of pieces) {
      const length = Math.hypot(piece.from[0], piece.from[1]);
      expect(length === 0 || Math.abs(length - 1) < 1e-6).toBe(true);
    }
  });

  test('the centre pieces grow in place rather than crossing the star', () => {
    expect(pieces[0].from).toEqual([0, 0]);
    expect(pieces[pieces.length - 1].from).toEqual([0, 0]);
  });

  test('a landed piece sits exactly on its own geometry', () => {
    for (const piece of pieces) {
      const landed = piecePointsAt(piece, 1);
      landed.forEach(([x, y], i) => {
        expect(x).toBeCloseTo(piece.points[i][0], 9);
        expect(y).toBeCloseTo(piece.points[i][1], 9);
      });
    }
  });

  /** Spin and scale about the piece's own centre, so its centre travels a
   * straight line along `from` - no swinging arc about the tile's middle. */
  test('each piece travels a straight line to its spot', () => {
    const centre = (pts: ReadonlyArray<readonly [number, number]>) => [
      pts.reduce((a, [x]) => a + x, 0) / pts.length,
      pts.reduce((a, [, y]) => a + y, 0) / pts.length,
    ];
    for (const piece of pieces) {
      const [fx, fy] = centre(piece.points);
      for (let p = 0; p <= 1; p += 0.1) {
        const [x, y] = centre(piecePointsAt(piece, p));
        // Offset from the final centre is parallel to `from`.
        const cross = (x - fx) * piece.from[1] - (y - fy) * piece.from[0];
        expect(Math.abs(cross)).toBeLessThan(1e-9);
      }
    }
  });

  /** The core lands first and the star grows outward from it. The reverse -
   * points arriving around an empty middle - reads as a shape waiting to be
   * completed rather than one being built. */
  test('the core is first and the ochre heart is last', () => {
    expect(pieces[0].kind).toBe('core');
    expect(pieces[0].order).toBe(0);
    const last = pieces[pieces.length - 1];
    expect(last.order).toBe(1);
    expect(last.color).toBe('#D9A441');
  });

  test('stagger is spread across the whole assemble act, in order', () => {
    const orders = pieces.map(p => p.order);
    for (let i = 1; i < orders.length; i += 1) {
      expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1]);
    }
    expect(Math.min(...orders)).toBe(0);
    expect(Math.max(...orders)).toBe(1);
  });
});

describe('pieceProgress', () => {
  const pieces = launchPieces();

  test('nothing has moved before the act starts', () => {
    for (const piece of pieces) {
      expect(pieceProgress(0, piece)).toBe(0);
      expect(pieceProgress(ACTS.assemble.start - 1, piece)).toBe(0);
    }
  });

  /** The act's end is when the *last* piece settles, not when it is
   * released - otherwise the tile is still visibly assembling while the
   * wordmark sets over it. */
  test('every piece has landed by the end of the act', () => {
    for (const piece of pieces) {
      expect(pieceProgress(ACTS.assemble.end, piece)).toBe(1);
    }
  });

  test('each piece only ever moves forwards', () => {
    for (const piece of pieces) {
      let previous = -Infinity;
      for (let t = 0; t <= TOTAL_MS; t += 16) {
        const v = pieceProgress(t, piece);
        expect(v).toBeGreaterThanOrEqual(previous - 1e-9);
        previous = v;
      }
    }
  });

  /** The whole point of the stagger: mid-act the tile is visibly part-built,
   * with the early pieces settled and the late ones still arriving. If every
   * piece were in flight together there would be nothing to watch. */
  test('mid-act the tile is part-built, in order', () => {
    const mid = (ACTS.assemble.start + ACTS.assemble.end) / 2;
    const progress = pieces.map(piece => pieceProgress(mid, piece));

    expect(progress[0]).toBeGreaterThan(0.95);
    expect(progress[progress.length - 1]).toBeLessThan(0.5);
    // Never out of order: an earlier piece is never behind a later one.
    for (let i = 1; i < progress.length; i += 1) {
      expect(progress[i]).toBeLessThanOrEqual(progress[i - 1] + 1e-9);
    }
  });
});

describe('letterProgress', () => {
  const COUNT = 7; // TESSERA

  test('sets left to right and finishes with the act', () => {
    for (let i = 0; i < COUNT; i += 1) {
      expect(letterProgress(ACTS.wordmark.start, i, COUNT)).toBe(0);
      expect(letterProgress(ACTS.wordmark.end, i, COUNT)).toBe(1);
    }
    const part = ACTS.wordmark.start + (ACTS.wordmark.end - ACTS.wordmark.start) * 0.5;
    expect(letterProgress(part, 0, COUNT)).toBeGreaterThan(letterProgress(part, COUNT - 1, COUNT));
  });

  test('a single letter does not divide by zero', () => {
    expect(letterProgress(ACTS.wordmark.end, 0, 1)).toBe(1);
    expect(Number.isFinite(letterProgress(ACTS.wordmark.start, 0, 1))).toBe(true);
  });
});

describe('the glow (SHEEN)', () => {
  test('starts once the last piece has landed, not before', () => {
    expect(SHEEN.start).toBe(ACTS.assemble.end);
  });

  test('finishes with room to spare before the handoff fade begins', () => {
    expect(SHEEN.end).toBeLessThan(ACTS.handoff.start);
  });

  test('sheenTravel spans its own window linearly, clamped outside it', () => {
    expect(sheenTravel(SHEEN.start)).toBe(0);
    expect(sheenTravel(SHEEN.end)).toBe(1);
    expect(sheenTravel(SHEEN.start - 500)).toBe(0);
    expect(sheenTravel(SHEEN.end + 500)).toBe(1);
    const mid = (SHEEN.start + SHEEN.end) / 2;
    expect(sheenTravel(mid)).toBeCloseTo(0.5, 5);
  });

  test('sheenOpacity fades in, holds bright, fades out - never negative, never over 1', () => {
    const span = SHEEN.end - SHEEN.start;
    expect(sheenOpacity(SHEEN.start)).toBe(0);
    expect(sheenOpacity(SHEEN.end)).toBe(0);
    expect(sheenOpacity(SHEEN.start + span * 0.5)).toBe(1);

    let previous = -Infinity;
    let peaked = false;
    for (let t = SHEEN.start; t <= SHEEN.end; t += span / 40) {
      const v = sheenOpacity(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      // Rises then falls, never a second independent peak - once a prior
      // sample already reached the top, nothing after it climbs again.
      // Checked against `peaked` as it stood *before* this sample, so the
      // one legitimate rise (arriving at the peak for the first time)
      // isn't mistaken for a second one.
      if (peaked && v > previous) expect(v).toBe(previous);
      if (v >= 1) peaked = true;
      previous = v;
    }
    expect(peaked).toBe(true);
  });

  test('is quiet outside its own window', () => {
    expect(sheenOpacity(SHEEN.start - 1)).toBe(0);
    expect(sheenOpacity(SHEEN.end + 1)).toBe(0);
  });
});

describe('sheenBandPoints', () => {
  function distanceFromOrigin(points: ReadonlyArray<readonly [number, number]>): number {
    return Math.min(...points.map(([x, y]) => Math.hypot(x, y)));
  }

  test('is always a quadrilateral, finite in every coordinate', () => {
    for (let t = 0; t <= 1; t += 0.1) {
      const points = sheenBandPoints(t);
      expect(points).toHaveLength(4);
      for (const [x, y] of points) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
      }
    }
  });

  // The unit tile's own farthest point from its centre is a corner, at
  // distance sqrt(2) ~= 1.414 - so the band's *nearest* corner clearing
  // that is the band being entirely off the tile.
  const TILE_HALF_DIAGONAL = Math.SQRT2;

  test('starts and ends well clear of the tile, on opposite sides', () => {
    const start = sheenBandPoints(0);
    const end = sheenBandPoints(1);
    expect(distanceFromOrigin(start)).toBeGreaterThan(TILE_HALF_DIAGONAL);
    expect(distanceFromOrigin(end)).toBeGreaterThan(TILE_HALF_DIAGONAL);

    // Opposite sides, not the same side twice - the centres of the two
    // bands point in opposite directions from the tile's own centre.
    const centreOf = (points: ReadonlyArray<readonly [number, number]>) => {
      const sum = points.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
      return [sum[0] / points.length, sum[1] / points.length];
    };
    const [sx, sy] = centreOf(start);
    const [ex, ey] = centreOf(end);
    expect(sx * ex + sy * ey).toBeLessThan(0);
  });

  test('passes near the tile centre at the midpoint of its travel', () => {
    const points = sheenBandPoints(0.5);
    const centreOf = points.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
    expect(Math.hypot(centreOf[0] / 4, centreOf[1] / 4)).toBeLessThan(0.01);
  });

  test('the band is a rectangle - opposite edges equal length and parallel', () => {
    const [p0, p1, p2, p3] = sheenBandPoints(0.3);
    const edge = (a: readonly [number, number], b: readonly [number, number]) => [b[0] - a[0], b[1] - a[1]];
    const length = (v: number[]) => Math.hypot(v[0], v[1]);
    const e01 = edge(p0, p1);
    const e32 = edge(p3, p2);
    expect(length(e01)).toBeCloseTo(length(e32), 5);
    // Parallel: the cross product of the two edge vectors is ~0.
    expect(Math.abs(e01[0] * e32[1] - e01[1] * e32[0])).toBeCloseTo(0, 5);
  });
});
