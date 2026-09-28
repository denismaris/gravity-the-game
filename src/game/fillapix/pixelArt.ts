/**
 * The hand-authored picture library Fill-a-Pix's curated puzzle pool is
 * built from (see `puzzles.ts`/`generator.ts`). A genuinely random binary
 * grid is never "a simple, recognizable image" - recognizability needs a
 * human hand, the same reasoning that led this app to hand-author its
 * Mirror Maze/Tents/Towers boards as literal grid strings via
 * `fromGrid`/`fromGrids` rather than generate them outright. `'#'` is a
 * filled cell, `'.'` is empty - the picture *is* the puzzle's solution.
 *
 * Every shape here was checked by actually rendering it (each cell as a
 * tile, the same way the real board draws them) rather than judged from
 * the raw grid strings - a first pass shipped a "tree" and an "umbrella"
 * that were nearly the same silhouette once drawn, which only showed up
 * once rendered, not while reading the ASCII.
 */

export interface FillaPixImage {
  readonly id: string;
  readonly rows: ReadonlyArray<string>;
}

/** `plus` is deliberately first - see `puzzles.ts`'s `FIRST_PUZZLE_REVEAL_ALL`
 * - the simplest, most symmetric shape in the library, so a brand-new
 * player's very first Fill-a-Pix is the easiest one to both solve and
 * recognise. */
export const EASY_IMAGES: ReadonlyArray<FillaPixImage> = [
  {
    id: 'plus',
    rows: ['..#..', '..#..', '#####', '..#..', '..#..'],
  },
  {
    id: 'heart',
    rows: ['.#.#.', '#####', '#####', '.###.', '..#..'],
  },
  {
    id: 'arrow',
    rows: ['..#..', '.###.', '#####', '..#..', '..#..'],
  },
  {
    id: 'smiley',
    rows: ['.###.', '#####', '#.#.#', '#...#', '.###.'],
  },
  {
    id: 'spark',
    rows: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'],
  },
  {
    id: 'ring',
    rows: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  },
  {
    id: 'bowtie',
    rows: ['#...#', '##.##', '.###.', '##.##', '#...#'],
  },
];

export const MEDIUM_IMAGES: ReadonlyArray<FillaPixImage> = [
  {
    id: 'cat',
    rows: ['#....#', '##..##', '.####.', '#.##.#', '.####.', '..##..'],
  },
  {
    id: 'umbrella',
    rows: ['..##..', '.####.', '######', '..##..', '..##..', '..##..'],
  },
  {
    id: 'house',
    rows: ['..##..', '.####.', '######', '##..##', '##..##', '######'],
  },
  {
    id: 'note',
    rows: ['...##.', '...###', '...#..', '...#..', '.###..', '.##...'],
  },
  {
    id: 'moon',
    rows: ['..###.', '.##...', '##....', '##....', '.##...', '..###.'],
  },
  {
    id: 'mug',
    rows: ['......', '.####.', '.#..##', '.#...#', '.####.', '......'],
  },
  {
    id: 'bell',
    rows: ['..##..', '.####.', '.####.', '######', '..##..', '......'],
  },
];

export const HARD_IMAGES: ReadonlyArray<FillaPixImage> = [
  {
    id: 'star',
    rows: ['...#...', '...#...', '.#####.', '#######', '..###..', '.##.##.', '##...##'],
  },
  {
    id: 'crown',
    rows: ['#.#.#.#', '#######', '#######', '#.#.#.#', '#######', '#######', '#######'],
  },
  {
    id: 'tree',
    rows: ['..#.#..', '.#####.', '#######', '.#####.', '...#...', '...#...', '..###..'],
  },
  {
    id: 'anchor',
    rows: ['...#...', '..###..', '...#...', '.#####.', '...#...', '..#.#..', '.##.##.'],
  },
  {
    id: 'key',
    rows: ['..###..', '.#...#.', '.#...#.', '..###..', '...#...', '...##..', '...#...'],
  },
  {
    id: 'sail',
    rows: ['...#...', '...##..', '...###.', '...####', '#######', '.#####.', '.......'],
  },
];
