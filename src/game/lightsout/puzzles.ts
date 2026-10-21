import { PuzzleDifficulty } from '../puzzleDifficulty';
import { endlessName, endlessSeed, parseEndlessId } from '../endlessId';
import { generateLightsOut, shapeForDifficulty } from './generator';
import { parFor } from './solver';
import { LightsOutPuzzle } from './types';

/**
 * Each board's name and its par, in the order they are dealt. Names are
 * all dusk/lamplight, the one register this game's own board (amber
 * lights on a deep indigo night) already speaks in.
 *
 * Par climbs deliberately, and `easy-01` is a par of **one**: the board
 * is a single lit cross, so the very first thing a player meets is the
 * exact shape the tutorial just drew for them, and one press clears it.
 * That is the on-ramp this game had none of - the first pass opened on a
 * three-press board scattered across 25 cells, which is opaque in a
 * puzzle that gives no local foothold to reason from.
 */
const BOARDS: Record<PuzzleDifficulty, ReadonlyArray<readonly [name: string, par: number]>> = {
  easy: [
    ['Porch Light', 2],
    ['Nightfall', 3],
    ['Lamp Row', 3],
    ['Small Hours', 3],
    ['Curfew', 4],
    // Appended, never inserted: ids are positional
    // (`lightsout-easy-03` is the third entry here), so slotting a board
    // into the middle would hand an existing id a different puzzle and
    // orphan every result already recorded against it. Par therefore has
    // to start at or above the tier's current last, which the pool test
    // also enforces as a climbing curve.
    ['First Star', 4],
    ['Shutters', 4],
  ],
  medium: [
    ['Streetlamps', 5],
    ['Evening Watch', 5],
    ['Nine Windows', 5],
    ['Blackout', 6],
    ['Last Lamp', 6],
    ['Gaslight', 6],
    ['Midnight Round', 6],
  ],
  hard: [
    ['Dusk Patrol', 7],
    ['All Quiet', 7],
    ['Lights Down', 7],
    ['The Long Night', 8],
    ['The Late Shift', 8],
    ['The Last Round', 9],
  ],
};

/**
 * Picture boards: the lamps start lit in the shape of something - a paper
 * lantern, a bell, a hot-air balloon - and the board's name is what it
 * shows. Random scatters were the whole pool before, and a random scatter
 * gives the eye nothing to hold; a picture is a puzzle you can *see*, and
 * putting it out lamp by lamp is its own small satisfaction.
 *
 * Every one was chosen by its real par (the shortest answer, `parFor`),
 * so it sits in its tier's band like any generated board; most pictures a
 * person would think of need ten presses or more on a 5x5, which is why
 * these are the ones that are here. Their ids carry on from the generated
 * boards' (`lightsout-easy-08` onward), so no existing id changes.
 */
const PICTURES: Record<'easy' | 'medium', ReadonlyArray<readonly [name: string, rows: ReadonlyArray<string>]>> = {
  easy: [
    ['Paper Lantern', ['..#..', '.#.#.', '.###.', '.#.#.', '..#..']],
    ['Candlestick', ['.....', '..#..', '..#..', '#####', '.#.#.']],
    ['Little Fir', ['.....', '..#..', '.###.', '.###.', '##.##']],
    ['Little Rocket', ['..#..', '.###.', '.###.', '##.##', '.#.#.']],
    ['Scarecrow', ['..#..', '.###.', '..#..', '.#.#.', '##.##']],
    ['Tea Bowl', ['.....', '#...#', '#####', '#####', '..#..']],
    ['Evening Bell', ['..#..', '.###.', '.###.', '#####', '..#..']],
    ['Lamp Post', ['.###.', '..#..', '..#..', '..#..', '#####']],
    ['Lamplighter', ['.###.', '..#..', '..#..', '.#.#.', '.#.#.']],
    ['Rooftop', ['.....', '..#..', '.#.#.', '##.##', '#####']],
    ['Owl', ['.###.', '.#.#.', '#.#.#', '.###.', '.....']],
    ['Four Lamps', ['##.##', '#...#', '.....', '#...#', '##.##']],
  ],
  medium: [
    ['Evening Star', ['..#..', '#####', '.###.', '.#.#.', '#...#']],
    ['Goblet', ['#...#', '.###.', '..#..', '..#..', '.....']],
    ['Tripod Lamp', ['..#..', '..#..', '.###.', '#...#', '#...#']],
    ['Archway', ['..#..', '.###.', '#...#', '#...#', '.....']],
    ['Full Moon', ['.###.', '##.##', '##.##', '.###.', '.....']],
    ['Hot-Air Balloon', ['.###.', '##.##', '.###.', '..#..', '.....']],
    ['Birdcage', ['.###.', '#...#', '#...#', '#####', '.#.#.']],
    ['Pitched Tent', ['..#..', '.#.#.', '.#.#.', '#####', '.....']],
    ['Three Streets', ['#####', '.....', '#####', '.....', '#####']],
  ],
};

function pictureBoard(id: string, name: string, difficulty: PuzzleDifficulty, rows: ReadonlyArray<string>): LightsOutPuzzle {
  const initial = rows.map(row => [...row].map(ch => ch === '#'));
  const board: LightsOutPuzzle = { id, name, difficulty, size: rows.length, initial, par: 0 };
  return { ...board, par: parFor(board) };
}

function poolFor(difficulty: PuzzleDifficulty): LightsOutPuzzle[] {
  const generated = BOARDS[difficulty].map(([name, par], index) =>
    generateLightsOut(`lightsout-${difficulty}-${String(index + 1).padStart(2, '0')}`, name, difficulty, par),
  );
  const pictures = difficulty === 'hard' ? [] : PICTURES[difficulty].map(([name, rows], index) =>
    pictureBoard(`lightsout-${difficulty}-${String(generated.length + index + 1).padStart(2, '0')}`, name, difficulty, rows),
  );
  // Dealt by par, so the pool still climbs; at each par the pictures and
  // the scatters take turns, so neither comes in a long run.
  const turn = new Map<string, number>();
  [generated, pictures].forEach(list => {
    const seen = new Map<number, number>();
    for (const puzzle of list) {
      const k = seen.get(puzzle.par) ?? 0;
      seen.set(puzzle.par, k + 1);
      turn.set(puzzle.id, k * 2 + (list === pictures ? 0 : 1));
    }
  });
  return [...generated, ...pictures].sort((a, b) => a.par - b.par || turn.get(a.id)! - turn.get(b.id)!);
}

/**
 * The boards that once had twin lanterns, on ids of their own. Twins were
 * taken out of the game (2026-10-20): these are no longer dealt, but a set
 * already holding one, or a save that solved one, still opens it - as a
 * plain board of the same name and par.
 */
const RETIRED_TWIN_BOARDS: ReadonlyArray<readonly [id: string, name: string, par: number, difficulty: PuzzleDifficulty]> = [
  ['lightsout-medium-t01', 'Twin Flames', 5, 'medium'],
  ['lightsout-medium-t02', 'Kindred Lights', 6, 'medium'],
  ['lightsout-hard-t01', 'Paired Wicks', 7, 'hard'],
  ['lightsout-hard-t02', 'Two by Two', 8, 'hard'],
  ['lightsout-hard-t03', 'The Long Thread', 8, 'hard'],
];
const retiredCache = new Map<string, LightsOutPuzzle>();

export const LIGHTS_OUT: ReadonlyArray<LightsOutPuzzle> = [...poolFor('easy'), ...poolFor('medium'), ...poolFor('hard')];

/**
 * Endless boards, built the first time they are asked for and kept.
 *
 * Cheap enough to do on demand - this game's whole curated pool builds
 * in about four milliseconds - but cached anyway, because a board gets
 * asked for repeatedly while it is being played and rebuilding it per
 * render would be pure waste.
 */
const endlessCache = new Map<string, LightsOutPuzzle>();

function buildEndless(id: string, tier: PuzzleDifficulty, index: number): LightsOutPuzzle {
  const cached = endlessCache.get(id);
  if (cached) return cached;
  const shape = shapeForDifficulty(tier);
  /**
   * Drawn from the tier's band with its very bottom rung skipped.
   *
   * Two reasons, and the second one is measurable. A player only reaches
   * an endless board after finishing every curated board in that tier,
   * so the tier's gentlest rung - which exists to teach - has already
   * done its job. And at the bottom of the easy band the board space is
   * genuinely tiny: a par-1 5x5 is "press one cell", of which there are
   * exactly 25, so drawing par 1 roughly a third of the time produced
   * visible repeats (measured: 54 distinct boards from 60 ids). Starting
   * one rung up puts every tier at 60 out of 60.
   */
  const floor = shape.minPar < shape.maxPar ? shape.minPar + 1 : shape.minPar;
  const span = shape.maxPar - floor + 1;
  const par = floor + (endlessSeed(id) % span);
  const puzzle = generateLightsOut(id, endlessName(index, 'lightsout'), tier, par);
  endlessCache.set(id, puzzle);
  return puzzle;
}

export function getLightsOutById(id: string): LightsOutPuzzle | undefined {
  const found = LIGHTS_OUT.find(puzzle => puzzle.id === id);
  if (found) return found;
  const retired = RETIRED_TWIN_BOARDS.find(([rid]) => rid === id);
  if (retired) {
    const [, name, par, difficulty] = retired;
    const board = retiredCache.get(id) ?? generateLightsOut(id, name, difficulty, par);
    retiredCache.set(id, board);
    return board;
  }
  const endless = parseEndlessId(id);
  if (!endless || endless.kind !== 'lightsout') return undefined;
  return buildEndless(id, endless.tier, endless.index);
}

export function getLightsOutByDifficulty(difficulty: PuzzleDifficulty): ReadonlyArray<LightsOutPuzzle> {
  return LIGHTS_OUT.filter(puzzle => puzzle.difficulty === difficulty);
}
