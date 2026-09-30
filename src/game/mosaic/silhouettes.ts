import { PuzzleDifficulty } from '../puzzleDifficulty';

/**
 * The pictures, hand-drawn square by square. `#` is picture, `.` is paper.
 *
 * Each is drawn for its tier's board: easy pictures are small and blunt,
 * with few pieces to place; hard ones are large and have *narrow places* -
 * a stem, a tail, an ear - which is where the real reasoning lives, since
 * a one-square-wide channel admits only one piece and so decides the rest.
 *
 * `theme` picks the glaze the pieces are drawn in (see the board's
 * palettes): a fish in sea blues, a tulip in garden roses. Names are what
 * the finished card calls the picture.
 */
export type MosaicTheme = 'garden' | 'sea' | 'hearth' | 'dusk' | 'meadow';

export interface Silhouette {
  readonly key: string;
  readonly name: string;
  readonly theme: MosaicTheme;
  readonly art: ReadonlyArray<string>;
}

export const SILHOUETTES: Record<PuzzleDifficulty, ReadonlyArray<Silhouette>> = {
  easy: [
    { key: 'heart', name: 'Heart', theme: 'hearth', art: ['##..##', '######', '######', '.####.', '..##..'] },
    { key: 'cottage', name: 'Cottage', theme: 'hearth', art: ['..##..', '.####.', '######', '##..##', '##..##'] },
    { key: 'tulip', name: 'Tulip', theme: 'garden', art: ['#.##.#', '######', '######', '.####.', '..##..', '..##..'] },
    { key: 'leaf', name: 'Leaf', theme: 'meadow', art: ['...###', '..####', '.#####', '.####.', '####..', '#.....'] },
    { key: 'umbrella', name: 'Umbrella', theme: 'dusk', art: ['..###..', '.#####.', '#######', '...#...', '...#...', '..##...'] },
    { key: 'sailboat', name: 'Sailboat', theme: 'sea', art: ['..#...', '..##..', '..###.', '..####', '######', '.####.'] },
    { key: 'moon', name: 'Crescent', theme: 'dusk', art: ['..####', '.###..', '###...', '###...', '###...', '.###..', '..####'] },
  ],
  medium: [
    { key: 'vase', name: 'Vase', theme: 'hearth', art: ['..####..', '...##...', '..####..', '.######.', '.######.', '.######.', '..####..', '..####..'] },
    { key: 'fish', name: 'Fish', theme: 'sea', art: ['..###..#', '.#####.#', '########', '.#####.#', '..###..#'] },
    { key: 'butterfly', name: 'Butterfly', theme: 'garden', art: ['##....##', '###..###', '########', '.######.', '.######.', '###..###', '##....##'] },
    { key: 'mushroom', name: 'Mushroom', theme: 'meadow', art: ['..####..', '.######.', '########', '########', '...##...', '...##...', '..####..'] },
    { key: 'pear', name: 'Pear', theme: 'meadow', art: ['....#..', '...##..', '..###..', '..###..', '.#####.', '#######', '#######', '.#####.'] },
    { key: 'teacup', name: 'Teacup', theme: 'hearth', art: ['######..', '########', '######.#', '########', '.####...', '########'] },
    { key: 'bird', name: 'Songbird', theme: 'dusk', art: ['.##.....', '###....#', '.###..##', '.#######', '..######', '...####.', '....#...'] },
  ],
  hard: [
    { key: 'blossom', name: 'Blossom', theme: 'garden', art: ['..##.##..', '.#######.', '#########', '.#######.', '#########', '.#######.', '..#####..', '....#.##.', '....###..'] },
    { key: 'cat', name: 'Cat', theme: 'dusk', art: ['#.....#..', '##...##..', '#######..', '##.#.##..', '#######..', '.#####..#', '.######.#', '.########', '.#######.'] },
    { key: 'tree', name: 'Oak', theme: 'meadow', art: ['...###...', '..#####..', '.#######.', '#########', '.#######.', '#########', '.#######.', '...###...', '...###...', '..#####..'] },
    { key: 'owl', name: 'Owl', theme: 'dusk', art: ['#.......#', '##.....##', '#########', '##.###.##', '#########', '.#######.', '.#######.', '..#####..', '..#...#..'] },
    { key: 'swan', name: 'Swan', theme: 'sea', art: ['.##.......', '###.......', '.#........', '.#........', '.#....####', '.##.######', '.#########', '..########', '...######.'] },
    { key: 'ship', name: 'Tall Ship', theme: 'sea', art: ['....#.....', '....##....', '....###...', '....####..', '....#####.', '....#.....', '##########', '.########.', '..######..'] },
  ],
};

/** A picture as a grid of booleans, rows padded to its widest line. */
export function silhouetteGrid(silhouette: Silhouette): boolean[][] {
  const cols = Math.max(...silhouette.art.map(line => line.length));
  return silhouette.art.map(line => Array.from({ length: cols }, (_v, c) => line[c] === '#'));
}
