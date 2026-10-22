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

/**
 * More pictures, for the endless boards only - each a subject of its own,
 * so the run after the curated pool meets new things rather than the
 * curated pictures turned and mirrored (which read as the same board
 * again). The curated pictures come back only once all of these are used.
 */
export const ENDLESS_SILHOUETTES: Record<PuzzleDifficulty, ReadonlyArray<Silhouette>> = {
  easy: [
    { key: 'e-star', name: 'Star', theme: 'dusk', art: ['..##..', '..##..', '######', '.####.', '.####.', '##..##'] },
    { key: 'e-bell', name: 'Bell', theme: 'hearth', art: ['..##..', '.####.', '.####.', '.####.', '######', '..##..'] },
    { key: 'e-apple', name: 'Apple', theme: 'garden', art: ['...#..', '.####.', '######', '######', '######', '.####.'] },
    { key: 'e-mug', name: 'Mug', theme: 'hearth', art: ['#####.', '######', '####.#', '######', '#####.', '.###..'] },
    { key: 'e-fir', name: 'Fir', theme: 'meadow', art: ['..##..', '.####.', '######', '.####.', '######', '..##..'] },
    { key: 'e-crown', name: 'Crown', theme: 'dusk', art: ['#.##.#', '######', '######', '.####.', '######'] },
    { key: 'e-rabbit', name: 'Rabbit', theme: 'meadow', art: ['.#..#.', '.#..#.', '.####.', '######', '######', '.####.'] },
    { key: 'e-gem', name: 'Gem', theme: 'sea', art: ['..##..', '.####.', '######', '######', '.####.', '..##..'] },
    { key: 'e-lighthouse', name: 'Lighthouse', theme: 'sea', art: ['..##..', '.####.', '..##..', '..##..', '.####.', '######'] },
    { key: 'e-cactus', name: 'Cactus', theme: 'meadow', art: ['..##..', '#.##..', '####.#', '.#####', '..##..', '..##..'] },
    { key: 'e-acorn', name: 'Acorn', theme: 'meadow', art: ['..##..', '######', '######', '.####.', '.####.', '..##..'] },
    { key: 'e-pot', name: 'Flowerpot', theme: 'garden', art: ['.#..#.', '######', '.####.', '######', '.####.', '.####.'] },
  ],
  medium: [
    { key: 'e-anchor', name: 'Anchor', theme: 'sea', art: ['...##...', '..####..', '...##...', '...##...', '#..##..#', '##.##.##', '.######.', '..####..'] },
    { key: 'e-rocket', name: 'Rocket', theme: 'dusk', art: ['...##...', '..####..', '..####..', '..####..', '.######.', '########', '##.##.##', '...##...'] },
    { key: 'e-balloon', name: 'Balloon', theme: 'garden', art: ['..####..', '.######.', '########', '########', '.######.', '..####..', '...##...', '..####..'] },
    { key: 'e-kingcrown', name: "King's Crown", theme: 'dusk', art: ['#..##..#', '##.##.##', '########', '########', '.######.', '########'] },
    { key: 'e-kite', name: 'Kite', theme: 'meadow', art: ['...##...', '..####..', '.######.', '########', '.######.', '..####..', '...##...', '....##..'] },
    { key: 'e-penguin', name: 'Penguin', theme: 'sea', art: ['..####..', '.######.', '.##..##.', '.######.', '########', '.######.', '.######.', '..#..#..'] },
    { key: 'e-snowman', name: 'Snowman', theme: 'dusk', art: ['...##...', '..####..', '...##...', '..####..', '.######.', '.######.', '..####..'] },
    { key: 'e-hourglass', name: 'Hourglass', theme: 'hearth', art: ['########', '.######.', '..####..', '...##...', '..####..', '.######.', '########'] },
    { key: 'e-lamp', name: 'Lamp', theme: 'hearth', art: ['..####..', '.######.', '########', '...##...', '...##...', '..####..', '.######.'] },
    { key: 'e-guitar', name: 'Guitar', theme: 'hearth', art: ['...##...', '...##...', '..####..', '.######.', '..####..', '.######.', '.######.', '..####..'] },
    { key: 'e-strawberry', name: 'Strawberry', theme: 'garden', art: ['..#..#..', '.######.', '########', '########', '.######.', '.######.', '..####..', '...##...'] },
    { key: 'e-whale', name: 'Whale', theme: 'sea', art: ['......##', '.####.#.', '#######.', '########', '########', '.######.'] },
    { key: 'e-turtle', name: 'Turtle', theme: 'meadow', art: ['..####..', '.######.', '########', '########', '.######.', '##....##'] },
    { key: 'e-lantern', name: 'Lantern', theme: 'dusk', art: ['...##...', '..####..', '.######.', '.######.', '.######.', '.######.', '..####..', '...##...'] },
  ],
  hard: [
    { key: 'e-castle', name: 'Castle', theme: 'hearth', art: ['#.#.#.#.#', '#########', '#########', '##.###.##', '#########', '###...###', '###...###', '#########'] },
    { key: 'e-fox', name: 'Fox', theme: 'meadow', art: ['#.......#', '##.....##', '###...###', '#########', '##.###.##', '#########', '.#######.', '..#####..', '...###...', '....#....'] },
    { key: 'e-harbourlight', name: 'Harbour Light', theme: 'sea', art: ['....#....', '...###...', '...#.#...', '...###...', '...###...', '..#####..', '..#####..', '..#####..', '.#######.', '#########'] },
    { key: 'e-elephant', name: 'Elephant', theme: 'dusk', art: ['..#####...', '.#######..', '#########.', '#########.', '##.######.', '#..######.', '#..##..##.', '...##..##.'] },
    { key: 'e-mountain', name: 'Mountain', theme: 'meadow', art: ['....##....', '...####...', '..######..', '..#######.', '.#########', '##########', '##########'] },
    { key: 'e-teapot', name: 'Teapot', theme: 'hearth', art: ['.....##...', '....####..', '..#######.', '#.########', '##########', '.#########', '..#######.', '...#####..'] },
    { key: 'e-beetle', name: 'Beetle', theme: 'garden', art: ['.#.....#.', '.##...##.', '..#####..', '.#######.', '#########', '####.####', '#########', '.#######.', '..#####..'] },
    { key: 'e-sunflower', name: 'Sunflower', theme: 'garden', art: ['..##.##..', '.#######.', '#########', '#########', '.#######.', '..#####..', '....#....', '..###....', '....#....'] },
    { key: 'e-rooster', name: 'Rooster', theme: 'hearth', art: ['..##.....', '.####....', '..###...#', '..####.##', '.########', '#########', '.#######.', '..#####..', '...#.#...'] },
    { key: 'e-bear', name: 'Bear', theme: 'meadow', art: ['##.....##', '#########', '#########', '##.###.##', '#########', '#########', '.#######.', '.##...##.'] },
    { key: 'e-cathedral', name: 'Cathedral', theme: 'dusk', art: ['....#....', '...###...', '...###...', '#..###..#', '##.###.##', '#########', '#########', '###.#.###', '###.#.###'] },
    { key: 'e-pagoda', name: 'Pagoda', theme: 'dusk', art: ['....#....', '...###...', '.#######.', '...###...', '..#####..', '#########', '...###...', '..#####..', '.#######.'] },
  ],
};

/** A picture as a grid of booleans, rows padded to its widest line. */
export function silhouetteGrid(silhouette: Silhouette): boolean[][] {
  const cols = Math.max(...silhouette.art.map(line => line.length));
  return silhouette.art.map(line => Array.from({ length: cols }, (_v, c) => line[c] === '#'));
}
