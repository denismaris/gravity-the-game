import { BinairoConstraint, BinairoPuzzle, BinairoState, BinairoValue } from './types';

export function isGiven(puzzle: BinairoPuzzle, row: number, col: number): boolean {
  return puzzle.givens[row][col] !== null;
}

/** A fresh board for `puzzle`: the givens, pre-filled, everything else blank. */
export function emptyBinairoState(puzzle: BinairoPuzzle): BinairoState {
  return { values: puzzle.givens.map(row => row.slice()) };
}

/** The next value in the tap cycle: blank -> ring (0) -> dot (1) -> blank. */
export function nextValue(value: BinairoValue): BinairoValue {
  if (value === null) return 0;
  if (value === 0) return 1;
  return null;
}

/**
 * Returns a new state with `(row, col)` set to `value`. Pure - the input is
 * never mutated; a given cell or a no-op returns the same state.
 */
export function setValue(
  state: BinairoState,
  puzzle: BinairoPuzzle,
  row: number,
  col: number,
  value: BinairoValue,
): BinairoState {
  if (isGiven(puzzle, row, col) || state.values[row][col] === value) return state;
  return {
    values: state.values.map((line, r) => (r === row ? line.map((v, c) => (c === col ? value : v)) : line)),
  };
}

export function colValues(state: BinairoState, col: number): BinairoValue[] {
  return state.values.map(row => row[col]);
}

/** Count of still-blank cells (for progress UI). */
export function remainingCells(state: BinairoState): number {
  return state.values.reduce((sum, row) => sum + row.filter(v => v === null).length, 0);
}

/** Whether `line` has any run of three (or more) consecutive equal values.
 * Blanks never count as part of a run. */
export function hasTripleRun(line: ReadonlyArray<BinairoValue>): boolean {
  for (let i = 0; i + 2 < line.length; i += 1) {
    if (line[i] !== null && line[i] === line[i + 1] && line[i + 1] === line[i + 2]) return true;
  }
  return false;
}

function isBalancedAndFull(line: ReadonlyArray<BinairoValue>): boolean {
  if (line.some(v => v === null)) return false;
  const zeros = line.filter(v => v === 0).length;
  return zeros === line.length / 2;
}

function lineKey(line: ReadonlyArray<BinairoValue>): string {
  return line.join(',');
}

function maximalRuns(line: ReadonlyArray<BinairoValue>): Array<{ start: number; end: number }> {
  const runs: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === null) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < line.length && line[j + 1] === line[i]) j += 1;
    if (j - i + 1 >= 3) runs.push({ start: i, end: j });
    i = j + 1;
  }
  return runs;
}

export interface TripleRunGroup {
  readonly orientation: 'row' | 'col';
  /** The row (if `orientation` is `'row'`) or column (if `'col'`) the run
   * sits in. */
  readonly index: number;
  /** Start/end position along that row/column, inclusive - a run of 4+
   * (not just the minimal 3) is one group, not two overlapping ones. */
  readonly start: number;
  readonly end: number;
}

/** The actual maximal runs of 3+ identical values, one group per run - for
 * drawing a single ring around a whole run (including a 4-or-longer one)
 * rather than one per 3-cell window. See `tripleRunCells` for the flat
 * per-cell question instead. */
export function tripleRunGroups(state: BinairoState): ReadonlyArray<TripleRunGroup> {
  const groups: TripleRunGroup[] = [];
  for (let r = 0; r < state.values.length; r += 1) {
    for (const run of maximalRuns(state.values[r])) groups.push({ orientation: 'row', index: r, ...run });
  }
  const cols = state.values[0]?.length ?? 0;
  for (let c = 0; c < cols; c += 1) {
    for (const run of maximalRuns(colValues(state, c))) groups.push({ orientation: 'col', index: c, ...run });
  }
  return groups;
}

/** Cells that are part of any triple run, in either their row or their
 * column - the first of Binairo's three error geometries (a per-cell
 * outline), distinct from the other two which flag whole lines. */
export function tripleRunCells(state: BinairoState): ReadonlySet<string> {
  const n = state.values.length;
  const cells = new Set<string>();

  for (let r = 0; r < n; r += 1) {
    const row = state.values[r];
    for (let c = 0; c + 2 < row.length; c += 1) {
      if (row[c] !== null && row[c] === row[c + 1] && row[c + 1] === row[c + 2]) {
        cells.add(`${r}:${c}`);
        cells.add(`${r}:${c + 1}`);
        cells.add(`${r}:${c + 2}`);
      }
    }
  }
  for (let c = 0; c < n; c += 1) {
    const col = colValues(state, c);
    for (let r = 0; r + 2 < col.length; r += 1) {
      if (col[r] !== null && col[r] === col[r + 1] && col[r + 1] === col[r + 2]) {
        cells.add(`${r}:${c}`);
        cells.add(`${r + 1}:${c}`);
        cells.add(`${r + 2}:${c}`);
      }
    }
  }
  return cells;
}

export interface BinairoLineSet {
  readonly rows: ReadonlySet<number>;
  readonly cols: ReadonlySet<number>;
}

/** Rows/columns that are completely filled but not evenly split - the
 * second error geometry (a line hugging the outside of the offending
 * row/column). A line still being filled in is never "wrong yet". */
export function unbalancedLines(puzzle: BinairoPuzzle, state: BinairoState): BinairoLineSet {
  const n = puzzle.size;
  const rows = new Set<number>();
  const cols = new Set<number>();

  for (let r = 0; r < n; r += 1) {
    const row = state.values[r];
    if (row.every(v => v !== null) && row.filter(v => v === 0).length !== n / 2) rows.add(r);
  }
  for (let c = 0; c < n; c += 1) {
    const col = colValues(state, c);
    if (col.every(v => v !== null) && col.filter(v => v === 0).length !== n / 2) cols.add(c);
  }
  return { rows, cols };
}

export interface DuplicateLineGroups {
  /** Each inner array is a set of 2+ row indices sharing one identical,
   * fully-filled row - almost always length 2, but the grouping (not just
   * a flat "is duplicated" flag) generalizes to a rarer 3-or-more-way tie
   * on a large enough grid. */
  readonly rows: ReadonlyArray<ReadonlyArray<number>>;
  readonly cols: ReadonlyArray<ReadonlyArray<number>>;
}

/** The actual groups of matching lines, for drawing one bracket per group
 * (it needs to know *which* lines it connects, not just *that* a line is
 * duplicated somewhere) - see `duplicateLines` for the flat-membership
 * question instead. */
export function duplicateLineGroups(puzzle: BinairoPuzzle, state: BinairoState): DuplicateLineGroups {
  const n = puzzle.size;

  const rowGroups = new Map<string, number[]>();
  for (let r = 0; r < n; r += 1) {
    const row = state.values[r];
    if (!row.every(v => v !== null)) continue;
    const key = lineKey(row);
    const group = rowGroups.get(key) ?? [];
    group.push(r);
    rowGroups.set(key, group);
  }

  const colGroups = new Map<string, number[]>();
  for (let c = 0; c < n; c += 1) {
    const col = colValues(state, c);
    if (!col.every(v => v !== null)) continue;
    const key = lineKey(col);
    const group = colGroups.get(key) ?? [];
    group.push(c);
    colGroups.set(key, group);
  }

  return {
    rows: Array.from(rowGroups.values()).filter(g => g.length > 1),
    cols: Array.from(colGroups.values()).filter(g => g.length > 1),
  };
}

/** Rows/columns that are completely filled and exactly match another row
 * (or another column) - the third error geometry (a bracket connecting
 * both matching lines, since the rule is inherently about two places at
 * once). A flat membership view over `duplicateLineGroups`, for callers
 * that only need to ask "is this line part of a duplicate" (the sound/
 * haptic trigger) rather than draw the bracket itself. */
export function duplicateLines(puzzle: BinairoPuzzle, state: BinairoState): BinairoLineSet {
  const groups = duplicateLineGroups(puzzle, state);
  const rows = new Set<number>();
  const cols = new Set<number>();
  for (const group of groups.rows) for (const r of group) rows.add(r);
  for (const group of groups.cols) for (const c of group) cols.add(c);
  return { rows, cols };
}

/** Canonical string key for one constraint - stable across renders, usable
 * as a Map/Set key or a React `key`. */
export function constraintKey(constraint: BinairoConstraint): string {
  return `${constraint.row}:${constraint.col}:${constraint.direction}`;
}

/** The cell a constraint's `(row, col)` anchor is paired with. */
export function constraintPartner(constraint: BinairoConstraint): { row: number; col: number } {
  return constraint.direction === 'right'
    ? { row: constraint.row, col: constraint.col + 1 }
    : { row: constraint.row + 1, col: constraint.col };
}

/** A constraint between two still-blank (or one-blank) cells isn't
 * violated *yet* - it just hasn't had the chance to be. Only both sides
 * being filled *and* disagreeing with `kind` counts as broken. */
export function isConstraintViolated(state: BinairoState, constraint: BinairoConstraint): boolean {
  const partner = constraintPartner(constraint);
  const a = state.values[constraint.row][constraint.col];
  const b = state.values[partner.row][partner.col];
  if (a === null || b === null) return false;
  return constraint.kind === 'same' ? a !== b : a === b;
}

/** Both sides filled *and* agreeing with `kind` - the stronger bar
 * `isBinairoSolved` needs, since a constraint between two cells that
 * happen to still be blank is unmet, not merely unbroken. */
function isConstraintFullyMet(state: BinairoState, constraint: BinairoConstraint): boolean {
  const partner = constraintPartner(constraint);
  const a = state.values[constraint.row][constraint.col];
  const b = state.values[partner.row][partner.col];
  if (a === null || b === null) return false;
  return constraint.kind === 'same' ? a === b : a !== b;
}

/** Keys (see `constraintKey`) of every currently-violated constraint - the
 * fourth error geometry, alongside `tripleRunCells`/`unbalancedLines`/
 * `duplicateLines`. Empty for any puzzle with no `constraints` at all,
 * which is every puzzle authored before this mechanic existed. */
export function violatedConstraints(puzzle: BinairoPuzzle, state: BinairoState): ReadonlySet<string> {
  const violated = new Set<string>();
  for (const constraint of puzzle.constraints ?? []) {
    if (isConstraintViolated(state, constraint)) violated.add(constraintKey(constraint));
  }
  return violated;
}

/** The cell twinned with `(row, col)` on a `size`x`size` board - always
 * its 180-degree mirror opposite, computed from board geometry rather
 * than looked up from any stored pairing. Whichever of the two cells is
 * passed in, this returns the *other* one - it's its own inverse, so
 * `twinPartner(size, twinPartner(size, cell))` is `cell` again. */
export function twinPartner(size: number, cell: { row: number; col: number }): { row: number; col: number } {
  return { row: size - 1 - cell.row, col: size - 1 - cell.col };
}

/** Canonical string key for one twin pair, keyed by whichever cell is
 * actually listed in `BinairoPuzzle.twinCells` (see that field's own
 * comment for why only one side is ever stored) - stable across renders,
 * usable as a Map/Set key or a React `key`. */
export function twinKey(cell: { row: number; col: number }): string {
  return `twin:${cell.row}:${cell.col}`;
}

/** Same "not violated until both sides disagree" stance as
 * `isConstraintViolated` - a twin pair with one or both sides still
 * blank hasn't had the chance to be wrong yet. */
export function isTwinViolated(puzzle: BinairoPuzzle, state: BinairoState, cell: { row: number; col: number }): boolean {
  const partner = twinPartner(puzzle.size, cell);
  const a = state.values[cell.row][cell.col];
  const b = state.values[partner.row][partner.col];
  if (a === null || b === null) return false;
  return a !== b;
}

/** Both sides filled *and* equal - the stronger bar `isBinairoSolved`
 * needs, mirroring `isConstraintFullyMet`'s own reasoning. */
function isTwinFullyMet(puzzle: BinairoPuzzle, state: BinairoState, cell: { row: number; col: number }): boolean {
  const partner = twinPartner(puzzle.size, cell);
  const a = state.values[cell.row][cell.col];
  const b = state.values[partner.row][partner.col];
  if (a === null || b === null) return false;
  return a === b;
}

/** Keys (see `twinKey`) of every currently-violated twin pair - a fifth
 * error geometry alongside `tripleRunCells`/`unbalancedLines`/
 * `duplicateLines`/`violatedConstraints`. Empty for any puzzle with no
 * `twinCells` at all, which is every puzzle authored before this
 * mechanic existed. */
export function violatedTwins(puzzle: BinairoPuzzle, state: BinairoState): ReadonlySet<string> {
  const violated = new Set<string>();
  for (const cell of puzzle.twinCells ?? []) {
    if (isTwinViolated(puzzle, state, cell)) violated.add(twinKey(cell));
  }
  return violated;
}

/** Whether row `row` is finished on its own terms: full, evenly split, no
 * triple run - independent of whether it happens to duplicate another
 * line elsewhere (that is a separate, error-worthy question). Used to
 * detect the instant a single line resolves, the same distinction
 * Skyscrapers' `isRowComplete` draws against its own whole-grid solve. */
export function isRowHealthy(puzzle: BinairoPuzzle, state: BinairoState, row: number): boolean {
  return isBalancedAndFull(state.values[row]) && !hasTripleRun(state.values[row]);
}

/** Column counterpart to `isRowHealthy`. */
export function isColHealthy(puzzle: BinairoPuzzle, state: BinairoState, col: number): boolean {
  const line = colValues(state, col);
  return isBalancedAndFull(line) && !hasTripleRun(line);
}

/**
 * A puzzle is solved when every cell is filled, no row or column has a
 * triple, every row and column is evenly split, no two rows - or two
 * columns - repeat, every `=`/`x` constraint (if the puzzle has any) is
 * met, and every twin pair (if the puzzle has any) matches. Player
 * mistakes are simply wrong the moment they're made; there is no
 * separate "check" step.
 */
export function isBinairoSolved(puzzle: BinairoPuzzle, state: BinairoState): boolean {
  const n = puzzle.size;
  const rows = state.values;

  for (const row of rows) {
    if (!isBalancedAndFull(row) || hasTripleRun(row)) return false;
  }
  for (let c = 0; c < n; c += 1) {
    const col = colValues(state, c);
    if (!isBalancedAndFull(col) || hasTripleRun(col)) return false;
  }

  const rowKeys = new Set(rows.map(lineKey));
  if (rowKeys.size !== n) return false;
  const colKeys = new Set(Array.from({ length: n }, (_v, c) => lineKey(colValues(state, c))));
  if (colKeys.size !== n) return false;

  for (const constraint of puzzle.constraints ?? []) {
    if (!isConstraintFullyMet(state, constraint)) return false;
  }

  for (const cell of puzzle.twinCells ?? []) {
    if (!isTwinFullyMet(puzzle, state, cell)) return false;
  }

  return true;
}
