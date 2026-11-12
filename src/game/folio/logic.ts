import { FolioFold, FolioInk, FolioLayer, FolioPuzzle, FolioSheet, FolioSquare, FolioState } from './types';

export function initialFolioState(): FolioState {
  return { folds: [] };
}

/** The flat sheet, every square front up. */
export function flatSheet(puzzle: Pick<FolioPuzzle, 'width' | 'height' | 'squares'>): FolioSheet {
  return {
    width: puzzle.width,
    height: puzzle.height,
    left: 0,
    top: 0,
    stacks: puzzle.squares.map((_square, index) => [{ square: index, up: true }]),
  };
}

/** Every crease the sheet can still be folded along. */
export function creasesOf(sheet: FolioSheet): FolioFold[] {
  const creases: FolioFold[] = [];
  for (let at = 1; at < sheet.width; at += 1) creases.push({ axis: 'v', at });
  for (let at = 1; at < sheet.height; at += 1) creases.push({ axis: 'h', at });
  return creases;
}

export function isCrease(sheet: FolioSheet, fold: FolioFold): boolean {
  const span = fold.axis === 'v' ? sheet.width : sheet.height;
  return Number.isInteger(fold.at) && fold.at >= 1 && fold.at < span;
}

/**
 * Which side of a crease turns over: always the smaller one, onto the
 * larger, the way a hand folds paper; when both match, the left or top.
 * One rule with no choice in it, so a tap always does the same thing.
 */
export function foldingSide(sheet: FolioSheet, fold: FolioFold): 'low' | 'high' {
  const span = fold.axis === 'v' ? sheet.width : sheet.height;
  return fold.at <= span - fold.at ? 'low' : 'high';
}

/** A stack turned over: its order reversed, every square flipped. */
function turnedOver(stack: ReadonlyArray<FolioLayer>): FolioLayer[] {
  const out: FolioLayer[] = [];
  for (let i = stack.length - 1; i >= 0; i -= 1) out.push({ square: stack[i].square, up: !stack[i].up });
  return out;
}

/**
 * The sheet after one fold. The turning side lands mirrored across the
 * crease, each of its stacks upside down on top of the stack it meets.
 */
export function foldSheet(sheet: FolioSheet, fold: FolioFold): FolioSheet {
  if (!isCrease(sheet, fold)) return sheet;
  const side = foldingSide(sheet, fold);
  const { width, height } = sheet;
  const k = fold.at;
  const at = (r: number, c: number) => sheet.stacks[r * width + c];

  if (fold.axis === 'v') {
    const nextWidth = side === 'low' ? width - k : k;
    const stacks: FolioLayer[][] = [];
    for (let r = 0; r < height; r += 1) {
      for (let c = 0; c < nextWidth; c += 1) {
        // The column that stays here, and the one folding onto it.
        const stay = side === 'low' ? c + k : c;
        const over = side === 'low' ? k - 1 - c : 2 * k - 1 - c;
        const stack = [...at(r, stay)];
        if (over >= 0 && over < width && (side === 'low' ? over < k : over >= k)) stack.push(...turnedOver(at(r, over)));
        stacks.push(stack);
      }
    }
    return { width: nextWidth, height, left: sheet.left + (side === 'low' ? k : 0), top: sheet.top, stacks };
  }

  const nextHeight = side === 'low' ? height - k : k;
  const stacks: FolioLayer[][] = [];
  for (let r = 0; r < nextHeight; r += 1) {
    const stay = side === 'low' ? r + k : r;
    const over = side === 'low' ? k - 1 - r : 2 * k - 1 - r;
    for (let c = 0; c < width; c += 1) {
      const stack = [...at(stay, c)];
      if (over >= 0 && over < height && (side === 'low' ? over < k : over >= k)) stack.push(...turnedOver(at(over, c)));
      stacks.push(stack);
    }
  }
  return { width, height: nextHeight, left: sheet.left, top: sheet.top + (side === 'low' ? k : 0), stacks };
}

/** The face of a layer that looks up. */
export function upInk(squares: ReadonlyArray<FolioSquare>, layer: FolioLayer): FolioInk {
  const square = squares[layer.square];
  return layer.up ? square.front : square.back;
}

/** The face of a layer that looks down. */
export function downInk(squares: ReadonlyArray<FolioSquare>, layer: FolioLayer): FolioInk {
  const square = squares[layer.square];
  return layer.up ? square.back : square.front;
}

/** What each stack shows on top, row-major. */
export function topInks(squares: ReadonlyArray<FolioSquare>, sheet: FolioSheet): FolioInk[] {
  return sheet.stacks.map(stack => upInk(squares, stack[stack.length - 1]));
}

/**
 * What each stack would show if it were turned over: the underside of its
 * bottom square. Drawn as the small turned-up corner on every square, so
 * the backs are never a guess.
 */
export function underInks(squares: ReadonlyArray<FolioSquare>, sheet: FolioSheet): FolioInk[] {
  return sheet.stacks.map(stack => downInk(squares, stack[0]));
}

/** The folds of `state` replayed onto the flat sheet. */
export function sheetOf(puzzle: FolioPuzzle, state: FolioState): FolioSheet {
  return state.folds.reduce(foldSheet, flatSheet(puzzle));
}

export function matchesTarget(puzzle: Pick<FolioPuzzle, 'squares' | 'target'>, sheet: FolioSheet): boolean {
  const { target } = puzzle;
  if (sheet.width !== target.width || sheet.height !== target.height) return false;
  const tops = topInks(puzzle.squares, sheet);
  return tops.every((ink, i) => ink === target.inks[i]);
}

export function isFolioSolved(puzzle: FolioPuzzle, state: FolioState): boolean {
  return matchesTarget(puzzle, sheetOf(puzzle, state));
}

/** The state after folding along `fold`, or the same state if the sheet
 * has no such crease. */
export function applyFold(puzzle: FolioPuzzle, state: FolioState, fold: FolioFold): FolioState {
  if (!isCrease(sheetOf(puzzle, state), fold)) return state;
  return { folds: [...state.folds, fold] };
}

/** Too small now to ever make the target: one side is already shorter. */
export function isPastTarget(puzzle: FolioPuzzle, sheet: FolioSheet): boolean {
  return sheet.width < puzzle.target.width || sheet.height < puzzle.target.height;
}
