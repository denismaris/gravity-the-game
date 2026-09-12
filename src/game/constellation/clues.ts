/** Run-length encoding of a single line, dropping the gaps.
 * `[true,true,false,true] -> [2, 1]`, `[false,false] -> []`. */
export function runsOf(line: ReadonlyArray<boolean>): number[] {
  const runs: number[] = [];
  let current = 0;
  for (const on of line) {
    if (on) {
      current += 1;
    } else if (current > 0) {
      runs.push(current);
      current = 0;
    }
  }
  if (current > 0) runs.push(current);
  return runs;
}

/**
 * Derives the row and column clues a player is shown from a solved grid.
 * The single source of truth for what a puzzle's clues are - authored
 * puzzles never hand-write clues, they run through this so the clues can
 * never disagree with the picture.
 */
export function deriveClues(solution: ReadonlyArray<ReadonlyArray<boolean>>): {
  rowClues: number[][];
  colClues: number[][];
} {
  const rows = solution.length;
  const cols = rows > 0 ? solution[0].length : 0;

  const rowClues = solution.map(row => runsOf(row));

  const colClues: number[][] = [];
  for (let c = 0; c < cols; c += 1) {
    const column: boolean[] = [];
    for (let r = 0; r < rows; r += 1) column.push(solution[r][c]);
    colClues.push(runsOf(column));
  }

  return { rowClues, colClues };
}

/** True when two clue arrays describe the same runs. */
export function cluesEqual(a: ReadonlyArray<number>, b: ReadonlyArray<number>): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}
