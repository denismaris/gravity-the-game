import { BloomCell, BloomEdge, BloomPuzzle, BloomState, BloomTileKind } from './types';

/* eslint-disable no-bitwise -- a cell's four edge ends are a 4-bit mask */

/** Which of a cell's four edges a tile reaches, as a bit mask (bit `e` for
 * edge `e`). */
export function tileEnds(kind: BloomTileKind, rotation: number): number {
  if (kind === 'empty') return 0;
  if (kind === 'knot') return 0b1111;
  const r = rotation & 3;
  return (1 << r) | (1 << ((r + 1) & 3));
}

/** The arcs a tile draws, each as the pair of edges it joins. */
export function tileArcs(kind: BloomTileKind, rotation: number): ReadonlyArray<readonly [BloomEdge, BloomEdge]> {
  const edge = (e: number) => (e & 3) as BloomEdge;
  if (kind === 'empty') return [];
  if (kind === 'arc') return [[edge(rotation), edge(rotation + 1)]];
  const r = rotation & 1;
  return [
    [edge(r), edge(r + 1)],
    [edge(r + 2), edge(r + 3)],
  ];
}

/* eslint-enable no-bitwise */

export function isRotatable(puzzle: BloomPuzzle, row: number, col: number): boolean {
  return puzzle.kinds[row][col] === 'arc' && !puzzle.pinned[row][col];
}

export function initialBloomState(puzzle: BloomPuzzle): BloomState {
  return { rotations: puzzle.start.map(line => line.slice()) };
}

/** A quarter turn clockwise. Anything that cannot turn is left alone. */
export function rotateTile(puzzle: BloomPuzzle, state: BloomState, row: number, col: number): BloomState {
  if (!isRotatable(puzzle, row, col)) return state;
  return {
    rotations: state.rotations.map((line, r) =>
      r === row ? line.map((value, c) => (c === col ? (value + 1) % 4 : value)) : line,
    ),
  };
}

export function setRotation(state: BloomState, row: number, col: number, rotation: number): BloomState {
  return {
    rotations: state.rotations.map((line, r) => (r === row ? line.map((value, c) => (c === col ? rotation : value)) : line)),
  };
}

/** The neighbour across edge `e`, or null at the board's rim. */
export function neighbourAcross(puzzle: BloomPuzzle, row: number, col: number, e: BloomEdge): BloomCell | null {
  const [dr, dc] = e === 0 ? [-1, 0] : e === 1 ? [0, 1] : e === 2 ? [1, 0] : [0, -1];
  const r = row + dr;
  const c = col + dc;
  if (r < 0 || c < 0 || r >= puzzle.rows || c >= puzzle.cols) return null;
  return { row: r, col: c };
}

/** A stable id for the midpoint of edge `e` of a cell - shared by the two
 * cells either side of it, which is what lets arcs chain into loops. */
export function midpointId(row: number, col: number, e: BloomEdge): string {
  if (e === 0) return `h:${row}:${col}`;
  if (e === 2) return `h:${row + 1}:${col}`;
  if (e === 3) return `v:${row}:${col}`;
  return `v:${row}:${col + 1}`;
}

/** One arc of one tile, travelled from edge `from` to edge `to`. */
export interface BloomArcStep {
  readonly row: number;
  readonly col: number;
  readonly from: BloomEdge;
  readonly to: BloomEdge;
}

export interface BloomLoops {
  /** Every closed loop, as its arcs in travel order. */
  readonly loops: ReadonlyArray<ReadonlyArray<BloomArcStep>>;
  /** How many arc ends touch nothing - zero exactly when the board is
   * solved. */
  readonly looseEnds: number;
}

/**
 * Traces the board into loops. Every arc end sits at an edge midpoint; a
 * midpoint touched by two arcs joins them, one touched by a single arc (or
 * by an arc running into the rim) is a loose end. A component of arcs whose
 * every midpoint is shared is a closed loop.
 */
export function traceLoops(puzzle: BloomPuzzle, state: BloomState): BloomLoops {
  interface Arc {
    readonly row: number;
    readonly col: number;
    readonly a: BloomEdge;
    readonly b: BloomEdge;
    readonly ma: string;
    readonly mb: string;
  }
  const arcs: Arc[] = [];
  const at = new Map<string, number[]>();
  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      for (const [a, b] of tileArcs(puzzle.kinds[row][col], state.rotations[row][col])) {
        const arc: Arc = { row, col, a, b, ma: midpointId(row, col, a), mb: midpointId(row, col, b) };
        const index = arcs.push(arc) - 1;
        for (const m of [arc.ma, arc.mb]) {
          const list = at.get(m);
          if (list) list.push(index);
          else at.set(m, [index]);
        }
      }
    }
  }

  let looseEnds = 0;
  for (const list of at.values()) if (list.length === 1) looseEnds += 1;

  const seen = new Set<number>();
  const loops: BloomArcStep[][] = [];
  for (let start = 0; start < arcs.length; start += 1) {
    if (seen.has(start)) continue;
    // Walk the chain from this arc; it is a loop only if the walk returns
    // to where it began without ever meeting an unshared midpoint.
    const steps: BloomArcStep[] = [];
    let closed = true;
    let index = start;
    let enter = arcs[start].ma;
    const members: number[] = [];
    for (;;) {
      const arc = arcs[index];
      members.push(index);
      const forward = arc.ma === enter;
      const exit = forward ? arc.mb : arc.ma;
      steps.push({ row: arc.row, col: arc.col, from: forward ? arc.a : arc.b, to: forward ? arc.b : arc.a });
      const next = (at.get(exit) ?? []).filter(i => i !== index);
      if (next.length !== 1) {
        closed = false;
        break;
      }
      index = next[0];
      if (index === start) break;
      enter = exit;
    }
    // Mark the whole component, loop or not, so a broken chain is not
    // walked again from each of its arcs.
    const stack = [...members];
    while (stack.length) {
      const i = stack.pop()!;
      if (seen.has(i)) continue;
      seen.add(i);
      for (const m of [arcs[i].ma, arcs[i].mb]) for (const j of at.get(m) ?? []) if (!seen.has(j)) stack.push(j);
    }
    if (closed) loops.push(steps);
  }
  return { loops, looseEnds };
}

/**
 * For every tile, whether each of its arcs (in `tileArcs` order) is joined
 * at both ends - both of its edge midpoints shared with another arc. The
 * board inks these in fully and draws the rest lighter, so the player can
 * see their progress set line by line, before a loop even closes.
 */
export function joinedArcs(puzzle: BloomPuzzle, state: BloomState): ReadonlyArray<ReadonlyArray<ReadonlyArray<boolean>>> {
  const count = new Map<string, number>();
  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      for (const [a, b] of tileArcs(puzzle.kinds[row][col], state.rotations[row][col])) {
        for (const m of [midpointId(row, col, a), midpointId(row, col, b)]) count.set(m, (count.get(m) ?? 0) + 1);
      }
    }
  }
  return puzzle.kinds.map((line, row) =>
    line.map((kind, col) =>
      tileArcs(kind, state.rotations[row][col]).map(
        ([a, b]) => (count.get(midpointId(row, col, a)) ?? 0) === 2 && (count.get(midpointId(row, col, b)) ?? 0) === 2,
      ),
    ),
  );
}

export function isBloomSolved(puzzle: BloomPuzzle, state: BloomState): boolean {
  return traceLoops(puzzle, state).looseEnds === 0;
}

/**
 * The solved picture as a string that is the same for a board and for any
 * turn or mirror of it - so a pool can refuse a board it already has in
 * another orientation. Drawn at double resolution (cell centres carry the
 * kind, edge midpoints the line), since a tile's facing turns with the
 * board and a plain cell grid would not rotate correctly.
 */
export function bloomShapeKey(puzzle: BloomPuzzle): string {
  const size = puzzle.rows * 2 + 1;
  let grid: string[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => '.'));
  for (let r = 0; r < puzzle.rows; r += 1) {
    for (let c = 0; c < puzzle.cols; c += 1) {
      const kind = puzzle.kinds[r][c];
      if (kind === 'empty') continue;
      grid[2 * r + 1][2 * c + 1] = kind === 'knot' ? 'k' : 'a';
      const ends = tileEnds(kind, puzzle.solution[r][c]);
      // eslint-disable-next-line no-bitwise -- tile ends are a 4-bit mask
      const on = (bit: number) => (ends & bit) !== 0;
      if (on(1)) grid[2 * r][2 * c + 1] = '#';
      if (on(2)) grid[2 * r + 1][2 * c + 2] = '#';
      if (on(4)) grid[2 * r + 2][2 * c + 1] = '#';
      if (on(8)) grid[2 * r + 1][2 * c] = '#';
    }
  }
  const readings: string[] = [];
  for (let turn = 0; turn < 4; turn += 1) {
    readings.push(grid.map(line => line.join('')).join('/'));
    readings.push(grid.map(line => [...line].reverse().join('')).join('/'));
    grid = grid[0].map((_v, c) => grid.map(line => line[c]).reverse());
  }
  return readings.sort()[0];
}

/** Arcs still facing the wrong way, for the header's count. */
export function arcsLeft(puzzle: BloomPuzzle, state: BloomState): number {
  let left = 0;
  for (let row = 0; row < puzzle.rows; row += 1) {
    for (let col = 0; col < puzzle.cols; col += 1) {
      if (puzzle.kinds[row][col] !== 'arc') continue;
      if (state.rotations[row][col] % 4 !== puzzle.solution[row][col] % 4) left += 1;
    }
  }
  return left;
}
