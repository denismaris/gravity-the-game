import { GameState, StaticCellType, applyGravity, isPuzzleSolved } from '../../../game/engine';
import { MosaicPuzzle, initialMosaicState, isMosaicSolved, placePiece, rotatePiece } from '../../../game/mosaic';
import { ArukonePuzzle, ArukoneState, beginDraw, extendDraw, isArukoneSolved, isPathComplete } from '../../../game/arukone';
import { nextValue, setValue, explainBinairoHint } from '../../../game/binairo';
import { isBloomSolved } from '../../../game/bloom';
import { press } from '../../../game/lightsout';
import { isMirrorMazeSolved, nextMirror, setMirror } from '../../../game/mirror';
import { clueValue } from '../../../game/fillapix';

/** The rules the lessons teach, checked against the games' own logic -
 * a lesson that says "a / mirror sends it up" must be true. */
describe('the lessons tell the truth', () => {
  test('Twos: the first tap on a blank is a square (0), the second a circle (1)', () => {
    expect(nextValue(null)).toBe(0);
    expect(nextValue(0)).toBe(1);
    expect(typeof explainBinairoHint).toBe('function');
    expect(setValue).toBeDefined();
  });

  test('Lanterns: the corner tap and the centre tap each darken their board', () => {
    const corner = [[true, true, false], [true, false, false], [false, false, false]];
    expect(press({ lights: corner }, 3, 0, 0).lights.flat().some(Boolean)).toBe(false);
    const cross = [[false, true, false], [true, true, true], [false, true, false]];
    expect(press({ lights: cross }, 3, 1, 1).lights.flat().some(Boolean)).toBe(false);
  });

  test('Mirror Maze: one / turns the bottom beam up to the target; one \\ turns the top beam down through the gem', () => {
    const up = { id: 'u', difficulty: 'easy' as const, rows: 3, cols: 3, source: { row: 2, col: 0 }, sourceDirection: 'right' as const, target: { row: 0, col: 2 }, gems: [], obstacles: [] };
    const empty = { mirrors: [[null, null, null], [null, null, null], [null, null, null]] as Array<Array<'fwd' | 'back' | null>> };
    expect(nextMirror(null)).toBe('fwd');
    expect(isMirrorMazeSolved(up, setMirror(empty, up, 2, 2, 'fwd'))).toBe(true);
    const down = { ...up, source: { row: 0, col: 0 }, target: { row: 2, col: 2 }, gems: [{ row: 1, col: 2 }] };
    expect(isMirrorMazeSolved(down, setMirror(empty, down, 0, 2, 'back'))).toBe(true);
  });

  test('Bloom: the four arcs close into one loop', () => {
    const bloom = { id: 'b', difficulty: 'easy' as const, rows: 2, cols: 2, kinds: [['arc', 'arc'], ['arc', 'arc']] as Array<Array<'arc'>>, solution: [[1, 2], [0, 3]], start: [[1, 1], [3, 3]], pinned: [[true, false], [false, true]] };
    expect(isBloomSolved(bloom, { rotations: [[1, 2], [0, 3]] })).toBe(true);
    expect(isBloomSolved(bloom, { rotations: [[1, 1], [3, 3]] })).toBe(false);
  });

  test('Pixel Clues: the corner reads 4 and the far corner 0', () => {
    const pixel = { id: 'p', difficulty: 'easy' as const, size: 4, solution: [[true, true, false, false], [true, true, false, false], [false, false, false, false], [false, false, false, false]], clues: [{ row: 0, col: 0 }, { row: 3, col: 3 }] };
    expect(clueValue(pixel, 0, 0)).toBe(4);
    expect(clueValue(pixel, 3, 3)).toBe(0);
  });
});

import { applyTap, groupAt } from '../../../game/adjacent';
import { bridgeLinks, cycleBridge, isBridgesSolved } from '../../../game/bridges';
import { isTowersSolved, setCell, TowersState } from '../../../game/towers';
import { BridgesState } from '../../../game/bridges';

describe('the second set of lessons tell the truth too', () => {
  test('Skyscrapers: the three steps finish a correct board', () => {
    const puzzle = { id: 't', difficulty: 'easy' as const, size: 3, topClues: [3, 2, 1], bottomClues: [1, 2, 2], leftClues: [3, 2, 1], rightClues: [1, 2, 2] };
    let state: TowersState = { values: [[1, 2, 0], [0, 3, 1], [0, 1, 2]] };
    state = setCell(state, 0, 2, 3);
    state = setCell(state, 2, 0, 3);
    state = setCell(state, 1, 0, 2);
    expect(isTowersSolved(puzzle, state)).toBe(true);
  });

  test('Adjacent: clearing the bottom-left pair drops a run of four into the bottom row', () => {
    const grid = [[2, 1, 0, 0], [1, 2, 1, 1], [0, 0, 2, 2], [1, 1, 0, 0]];
    const first = applyTap({ grid, score: 0, cascades: 0 }, 3, 0)!;
    expect(groupAt(first.state.grid, 3, 0).length).toBe(4);
    const second = applyTap(first.state, 3, 0)!;
    expect(second.gained).toBeGreaterThan(first.gained * 2);
  });

  test('Bridges: one bridge on top and a double down the side solves it', () => {
    const islands = [{ row: 0, col: 0, need: 1 }, { row: 0, col: 2, need: 3 }, { row: 2, col: 2, need: 2 }];
    const links = bridgeLinks({ rows: 3, cols: 3, islands });
    const top = links.findIndex(l => (l.a === 0 && l.b === 1) || (l.a === 1 && l.b === 0));
    const side = links.findIndex(l => (l.a === 1 && l.b === 2) || (l.a === 2 && l.b === 1));
    const puzzle = { id: 'b', difficulty: 'easy' as const, rows: 3, cols: 3, islands, solution: links.map((_l, i) => (i === top ? 1 : i === side ? 2 : 0)) };
    let state: BridgesState = { bridges: links.map(() => 0) };
    state = cycleBridge(puzzle, state, top);
    state = cycleBridge(puzzle, cycleBridge(puzzle, state, side), side);
    expect(state.bridges[top]).toBe(1);
    expect(state.bridges[side]).toBe(2);
    expect(isBridgesSolved(puzzle, state)).toBe(true);
  });

  test('Twinpath: drawing the 1s draws the 2s, and half the 3s closes round the outside', () => {
    const C = (row: number, col: number) => ({ row, col });
    const puzzle: ArukonePuzzle = {
      id: 'tw', difficulty: 'easy', size: 4, axis: 'vertical', obstacles: [],
      pairs: [{ value: 1, a: C(0, 1), b: C(2, 1) }, { value: 2, a: C(0, 2), b: C(2, 2) }, { value: 3, a: C(0, 0), b: C(0, 3) }],
      solution: {},
    };
    const drag = (state: ArukoneState, cells: ReturnType<typeof C>[]) => {
      const start = beginDraw(puzzle, state, cells[0])!;
      return cells.slice(1).reduce((s, c) => extendDraw(puzzle, s, start.value, c), start.state);
    };
    let state = drag({ paths: {} }, [C(0, 1), C(1, 1), C(2, 1)]);
    expect(isPathComplete(puzzle.pairs[1], state.paths[2] ?? [])).toBe(true);
    state = drag(state, [C(0, 0), C(1, 0), C(2, 0), C(3, 0), C(3, 1)]);
    expect(isArukoneSolved(puzzle, state)).toBe(true);
  });

  test('Mosaic: the square, the turned bar and the pair fill the picture', () => {
    const C = (row: number, col: number) => ({ row, col });
    const puzzle: MosaicPuzzle = {
      id: 'm', difficulty: 'easy', subject: 'lesson', theme: 'garden', rows: 3, cols: 3,
      silhouette: [[true, true, true], [true, true, true], [true, true, true]],
      pieces: [
        { id: 'square', cells: [C(0, 0), C(0, 1), C(1, 0), C(1, 1)], color: 0 },
        { id: 'bar', cells: [C(0, 0), C(0, 1), C(0, 2)], color: 1 },
        { id: 'pair', cells: [C(0, 0), C(0, 1)], color: 2 },
      ],
      solution: [{ row: 0, col: 0, rotation: 0, flipped: false }, { row: 0, col: 2, rotation: 1, flipped: false }, { row: 2, col: 0, rotation: 0, flipped: false }],
      start: [{ rotation: 0, flipped: false }, { rotation: 0, flipped: false }, { rotation: 0, flipped: false }],
      allowFlip: false,
      fixed: [false, false, false],
    };
    let state = placePiece(puzzle, initialMosaicState(puzzle), 0, 0, 0);
    expect(placePiece(puzzle, state, 1, 0, 2)).toBe(state);
    state = placePiece(puzzle, rotatePiece(puzzle, state, 1), 1, 0, 2);
    state = placePiece(puzzle, state, 2, 2, 0);
    expect(isMosaicSolved(puzzle, state)).toBe(true);
  });

  test('Gravity: each lesson swipe brings every piece home', () => {
    const board = (rows: string[]): GameState => {
      const movables: GameState['movables'][number][] = [];
      const staticGrid = rows.map((line, row) =>
        [...line].map((ch, col) => {
          if (ch === 'o') movables.push({ id: `p${row}${col}`, row, col });
          return ch === 'x' ? StaticCellType.Target : ch === '#' ? StaticCellType.Obstacle : StaticCellType.Empty;
        }),
      );
      return { rows: rows.length, cols: rows[0].length, staticGrid, movables, portals: [], zone: null };
    };
    expect(isPuzzleSolved(applyGravity(board(['..o..', '.....', '.....', '.....', '..x..']), 'down'))).toBe(true);
    expect(isPuzzleSolved(applyGravity(board(['.....', '.....', 'o..x#', '.....', '.....']), 'right'))).toBe(true);
    expect(isPuzzleSolved(applyGravity(board(['.o.o.', '.....', '...x.', '...#.', '.x...']), 'down'))).toBe(true);
  });
});
