import { PuzzleDifficulty } from '../puzzleDifficulty';
import { parseEndlessId } from '../endlessId';
import { decodeMosaic } from './endless';
import { BAKED_ENDLESS_MOSAIC } from './endless.generated';
import { SILHOUETTES, silhouetteGrid } from './silhouettes';
import { chooseFixedPieces } from './logic';
import { MosaicPuzzle } from './types';

/**
 * The shipped pool, baked. Generating it takes the better part of a second
 * (the hard pictures search deep for a cut with exactly one answer), and a
 * pool built at import runs on every cold start - the same trap Adjacent
 * fell into. So the boards are written out here and the pool test
 * regenerates every one from its id and fails on any drift: these rows are
 * a verified cache of \`generateMosaic\`, not a second source of truth.
 *
 * Each row: id, tier, picture, pieces (squares as row-col digit pairs,
 * then \`:colour\`), each piece's solution corner, and each piece's starting
 * turn. Ids are frozen; new boards are appended.
 */
const BAKED: ReadonlyArray<readonly [string, PuzzleDifficulty, string, string, string, string]> = [
  ['mosaic-easy-01', 'easy', 'heart', '00.01.10.20:4 01.10.11.21:0 00.10.20:3 00.01.10.20:1 00.10.20:2 00.10.11.20:3', '00 03 05 11 22 23', '301021'],
  ['mosaic-easy-02', 'easy', 'cottage', '00.01.11.12:0 01.02.10.11:4 00.01.02.12:1 01.11.20.21:2 00.01.10.11:3', '02 10 22 24 30', '12130'],
  ['mosaic-easy-03', 'easy', 'tulip', '00.10.20.21:3 01.02.10.11:0 01.10.11.21:2 00.10.11.21:4 01.10.11.21:1 01.11.20.21:2', '00 01 04 13 21 32', '331333'],
  ['mosaic-easy-04', 'easy', 'leaf', '01.02.10.11:1 00.10.20:0 00.10.20:3 00.01.10:2 01.10.11.21:4 00.01.02.10:0', '02 05 14 21 22 40', '132222'],
  ['mosaic-easy-05', 'easy', 'umbrella', '00.01.10:0 01.10.11.20:2 01.10.11.12:4 01.10.11.12:3 01.11.20.21:1', '02 03 10 14 32', '13003'],
  ['mosaic-easy-06', 'easy', 'sailboat', '00.10.11.21:2 00.10.11.20:3 00.10.11.21:4 00.01.11.12:1 00.01.10.11:0', '02 22 24 40 43', '03332'],
  ['mosaic-easy-07', 'easy', 'moon', '01.10.11.21:4 00.01.02.10:0 00.01.10.11:3 02.10.11.12:2 00.01.02.11:1 00.01.02:2', '01 03 20 30 51 63', '322111'],
  ['mosaic-medium-01', 'medium', 'vase', '00.01.02.03.11:1 01.10.11.12.21:2 01.10.11.20:4 00.10.11.21:0 00.01.10.11.21:3 01.10.11.12.21:3 00.10.20:2 01.02.10.11.12:4', '02 13 21 33 35 41 55 62', '12033020'],
  ['mosaic-medium-02', 'medium', 'fish', '00.01.02.12:3 00.10.20.30.40:0 01.02.10.11.21:4 01.10.11.12.21:1 01.11.12.20.21:2 00.10.11.12:0', '02 07 10 12 14 32', '021010'],
  ['mosaic-medium-03', 'medium', 'butterfly', '00.01.10.20:4 01.10.11.20.30:3 01.11.20.21:2 00.01.11.12.21:0 00.10.20.21.22:1 01.10.11:2 02.10.11.12.21:0 00.01.02.10.11:3 00.01.10.11:1', '00 05 06 11 21 23 34 50 56', '033202122'],
  ['mosaic-medium-04', 'medium', 'mushroom', '01.10.11.21.22:0 00.01.02.10.11:3 00.01.11.12.22:1 00.01.10.11.12:2 00.01.10.11.12:4 00.10.11.21:3 01.10.11.12.13:0', '01 03 15 20 24 33 52', '1001331'],
  ['mosaic-medium-05', 'medium', 'pear', '01.10.11.21.31:4 00.01.10.20:1 00.10.11.12.21:0 01.10.11.20.21:2 00.01.10.11.12:3 00.01.10.11:4 00.01.02.03.04:0', '03 22 33 40 52 55 71', '0111221'],
  ['mosaic-medium-06', 'medium', 'teacup', '00.10.20.30.31:0 00.01.11.12:2 00.01.11.20.21:4 00.10.11.12.22:1 00.10.11.21.22:3 01.10.11.12.13:0 01.10.11.12:1 00.01.02.11:4 00.01.02.03:3', '00 01 03 05 11 24 40 42 54', '312323133'],
  ['mosaic-medium-07', 'medium', 'bird', '01.02.10.11.21:0 00.10.11.21.22:3 01.10.11.21:1 00.01.11.12.13:2 00.01.10.11.12:4 00.01.02.03.11:1', '00 12 16 31 35 53', '113313'],
  ['mosaic-hard-01', 'hard', 'blossom', '02.11.12.20.21:1 01.11.12.20.21:0 01.11.20.21.22:4 00.10.11.21.22:3 01.10.11.21.22:2 00.01.02.03.04:1 01.10.11.12.21:4 00.01.02.03.12:0 01.10.11.12.22:3 00.01.10.11:2 02.03.10.11.12:4', '00 02 04 06 30 32 36 42 52 55 74', '01303021333'],
  ['mosaic-hard-02', 'hard', 'cat', '00.10.11.20.30:3 01.10.11.20.21:0 01.11.20.21.31:1 00.01.02.11.21:4 00.01.10.11:2 01.11.12.20.21:2 01.11.12.20.21:3 01.11.20.21.30:0 02.10.11.12.21:4 01.11.20.21:1 00.01.10.11.12:3', '00 05 20 22 35 41 43 57 63 65 71', '21210112013'],
  ['mosaic-hard-03', 'hard', 'tree', '01.10.11.20.21:0 00.01.11.12.21:4 00.10.20.21.22:1 01.10.11.12.21:2 00.01.11.12:3 01.10.11.12.21:3 01.02.10.11.12:0 01.11.12.20.21:4 00.01.02.11.12:1 00.01.02.10.20:2 00.01.11.21.22:0 02.10.11.12:1', '02 04 14 20 26 32 44 46 50 63 74 82', '232330011012'],
  ['mosaic-hard-04', 'hard', 'owl', '00.10.20.30:3 01.10.11.20.21:0 00.10.11.20:1 00.01.02.03.12:4 00.01.11.21.31:2 00.01.10.11:3 00.01.11.21.22:4 00.01.10.11.21:1 00.01.10.11.20:0 01.10.11.20.30:2 00.01.02.03.10:3', '00 07 11 23 33 37 40 42 45 56 72', '02300130203'],
  ['mosaic-hard-05', 'hard', 'swan', '01.02.10.11.12:3 00.10.20.30:1 00.01.02.10:4 02.10.11.12.22:0 01.10.11.12.21:2 00.01.10.11.12:1 00.01.10.11.12:2 00.01.02.10.11:0 01.10.11.12.13:3', '00 21 46 47 51 54 67 73 75', '132310131'],
  ['mosaic-hard-06', 'hard', 'ship', '00.10.11.20.21:2 02.10.11.12:0 02.10.11.12.13:4 00.10.20.21:3 00.01.02.11:1 01.10.11.20:0 01.02.11.20.21:2 01.02.10.11.20:3 01.02.10.11:4', '04 24 35 44 60 62 65 67 73', '132111223'],
];

function decode(row: (typeof BAKED)[number]): MosaicPuzzle {
  const base = decodeBase(row);
  return { ...base, fixed: chooseFixedPieces(base) };
}

function decodeBase(row: (typeof BAKED)[number]): Omit<MosaicPuzzle, 'fixed'> {
  const [id, difficulty, key, pieces, solution, start] = row;
  const silhouette = SILHOUETTES[difficulty].find(s => s.key === key);
  if (!silhouette) throw new Error(`Mosaic ${id}: unknown picture ${key}.`);
  const grid = silhouetteGrid(silhouette);
  const digits = (pair: string) => ({ row: Number(pair[0]), col: Number(pair[1]) });
  return {
    id,
    name: silhouette.name,
    difficulty,
    subject: key,
    theme: silhouette.theme,
    rows: grid.length,
    cols: grid[0].length,
    silhouette: grid,
    pieces: pieces.split(' ').map((piece, i) => {
      const [cells, colour] = piece.split(':');
      return { id: `p${i}`, cells: cells.split('.').map(digits), color: Number(colour) };
    }),
    solution: solution.split(' ').map(corner => ({ rotation: 0, flipped: false, ...digits(corner) })),
    start: [...start].map(turn => ({ rotation: Number(turn), flipped: false })),
    allowFlip: false,
  };
}

export const MOSAIC: ReadonlyArray<MosaicPuzzle> = BAKED.map(decode);

const endlessCache = new Map<string, MosaicPuzzle>();

/** An endless board: the baked list's board at this index (built offline -
 * see `endless.ts`), past its end wrapping round with a fresh id. */
function endlessMosaic(id: string): MosaicPuzzle | undefined {
  const endless = parseEndlessId(id);
  if (!endless || endless.kind !== 'mosaic') return undefined;
  const cached = endlessCache.get(id);
  if (cached) return cached;
  const list = BAKED_ENDLESS_MOSAIC[endless.tier];
  if (list.length === 0) return undefined;
  const puzzle = decodeMosaic(id, endless.tier, list[endless.index % list.length]);
  endlessCache.set(id, puzzle);
  return puzzle;
}

export function getMosaicById(id: string): MosaicPuzzle | undefined {
  const endless = endlessMosaic(id);
  if (endless) return endless;
  return MOSAIC.find(puzzle => puzzle.id === id);
}

export function getMosaicByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<MosaicPuzzle> {
  return MOSAIC.filter(puzzle => puzzle.difficulty === difficulty);
}
