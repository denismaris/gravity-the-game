import { endlessName } from '../endlessId';
import { PuzzleDifficulty } from '../puzzleDifficulty';
import { generateMosaic } from './generator';
import { chooseFixedPieces } from './logic';
import { endlessSilhouette } from './shapes';
import { MosaicTheme, SILHOUETTES, Silhouette, silhouetteGrid } from './silhouettes';
import { MosaicPuzzle } from './types';

/**
 * Endless Mosaic boards, built offline and baked (`endless.generated.ts`) -
 * a hard cut takes up to a second and sometimes several tries, which is
 * fine once at build time and not fine as a phone opens a puzzle.
 *
 * Two in three are the hand-drawn pictures again, turned or mirrored and
 * cut into a *new* set of pieces - the same heart cut differently is a
 * different puzzle, and a recognisable picture is most of the pleasure.
 * The third is a symmetric emblem (see `shapes.ts`), for variety.
 */

const VARIANTS = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function transform(art: ReadonlyArray<string>, t: number): string[] {
  let rows = art.map(line => [...line]);
  const width = Math.max(...rows.map(r => r.length));
  rows = rows.map(r => [...r, ...new Array(width - r.length).fill('.')]);
  if (t % 2 === 1) rows = rows.map(r => [...r].reverse());
  if (Math.floor(t / 2) % 2 === 1) rows = [...rows].reverse();
  return rows.map(r => r.join(''));
}

/** The picture board `index` of a tier is cut from. */
export function endlessMosaicSilhouette(tier: PuzzleDifficulty, index: number): Silhouette {
  const id = `mosaic-e-${tier}-${index}`;
  if (index % 3 === 2) return endlessSilhouette(id, tier, endlessName(index, 'mosaic'));
  const pictures = SILHOUETTES[tier];
  const k = index - Math.floor(index / 3);
  const picture = pictures[k % pictures.length];
  const round = Math.floor(k / pictures.length);
  return {
    key: picture.key,
    name: `${picture.name}${VARIANTS[round % VARIANTS.length] ? ` ${VARIANTS[round % VARIANTS.length]}` : ''}`,
    theme: picture.theme,
    // Turned or mirrored on alternate rounds, so a repeat picture is
    // also a different shape to fill.
    art: transform(picture.art, round + 1),
  };
}

/** A baked board: [name, subject, theme, art, pieces, solution, start]. */
export type EncodedMosaic = readonly [string, string, MosaicTheme, string, string, string, string];

export function encodeMosaic(puzzle: MosaicPuzzle, art: ReadonlyArray<string>): EncodedMosaic {
  const pair = (c: { row: number; col: number }) => `${c.row}${c.col}`;
  return [
    puzzle.name ?? '',
    puzzle.subject,
    puzzle.theme,
    art.join('/'),
    puzzle.pieces.map(p => `${p.cells.map(pair).join('.')}:${p.color}`).join(' '),
    puzzle.solution.map(pair).join(' '),
    puzzle.start.map(s => s.rotation).join(''),
  ];
}

export function decodeMosaic(id: string, difficulty: PuzzleDifficulty, row: EncodedMosaic): MosaicPuzzle {
  const [name, subject, theme, art, pieces, solution, start] = row;
  const grid = silhouetteGrid({ key: subject, name, theme, art: art.split('/') });
  const digits = (p: string) => ({ row: Number(p[0]), col: Number(p[1]) });
  const base: Omit<MosaicPuzzle, 'fixed'> = {
    id,
    name,
    difficulty,
    subject,
    theme,
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
  return { ...base, fixed: chooseFixedPieces(base) };
}

/** Builds `count` endless boards for a tier - offline only. A picture that
 * will not cut uniquely is re-drawn with a salt, then skipped for the
 * next index's picture rather than failing the bake. */
export function buildEndlessMosaic(tier: PuzzleDifficulty, count: number): EncodedMosaic[] {
  const out: EncodedMosaic[] = [];
  for (let index = 0; out.length < count; index += 1) {
    const silhouette = endlessMosaicSilhouette(tier, index);
    const id = `mosaic-e-${tier}-${out.length}`;
    for (let salt = 0; salt < 6; salt += 1) {
      try {
        const puzzle = generateMosaic(id, silhouette, tier, salt);
        out.push(encodeMosaic(puzzle, silhouette.art));
        break;
      } catch {
        // Try another cut; after six, move on to the next picture.
      }
    }
  }
  return out;
}
