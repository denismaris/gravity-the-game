import { ARUKONE } from '../../game/arukone';
import { BINAIRO } from '../../game/binairo';
import { FILLAPIX } from '../../game/fillapix';
import { ROTATION } from '../../game/journey';
import { getLevelsByDifficulty, LEVELS } from '../../game/levels';
import { LIGHTS_OUT } from '../../game/lightsout';
import { ADJACENT } from '../../game/adjacent';
import { BLOOM } from '../../game/bloom';
import { MOSAIC } from '../../game/mosaic';
import { BRIDGES } from '../../game/bridges';
import { MIRROR_MAZES } from '../../game/mirror';
import { TENTS_TREES } from '../../game/tents';
import { TOWERS } from '../../game/towers';
import { computeAptitude, MIN_SOLVES_FOR_INDEX } from '../aptitude';
import { emptyProgress, PlayerProgress, recordCompletion } from '../playerProgress';

/** Solve `levelId` at exactly `stars`. The star maths itself is
 * `computeStars`' own contract (tested in `src/game/scoring`); these
 * thresholds just pin the outcome so an aptitude test never depends on
 * it. `moves: 1` against `{three: 1}` is three stars, against `{three: 0,
 * two: 0}` is one. */
function solveAt(progress: PlayerProgress, levelId: string, stars: 1 | 2 | 3): PlayerProgress {
  const thresholds = { three: 1, two: 2 } as const;
  const moves = stars === 3 ? 1 : stars === 2 ? 2 : 3;
  return recordCompletion(progress, levelId, moves, thresholds);
}

function solveMany(
  progress: PlayerProgress,
  ids: ReadonlyArray<string>,
  stars: 1 | 2 | 3,
): PlayerProgress {
  return ids.reduce((acc, id) => solveAt(acc, id, stars), progress);
}

describe('computeAptitude - the empty case', () => {
  const aptitude = computeAptitude(emptyProgress());

  test('reports every game, in the app\'s canonical order', () => {
    expect(aptitude.games.map(game => game.kind)).toEqual([...ROTATION]);
  });

  test('withholds the index until there is enough to say anything', () => {
    expect(aptitude.index).toBeNull();
    expect(aptitude.solved).toBe(0);
  });

  test('marks every game untested rather than scoring it zero-and-final', () => {
    expect(aptitude.games.every(game => !game.tested)).toBe(true);
    expect(aptitude.games.every(game => game.precision === 0)).toBe(true);
  });

  test('names no strongest or weakest - "best of nothing" says nothing', () => {
    expect(aptitude.strongest).toBeNull();
    expect(aptitude.weakest).toBeNull();
  });
});

describe('computeAptitude - precision', () => {
  test('a game solved flawlessly reads near the top, the same game solved badly reads low', () => {
    const flawless = computeAptitude(solveMany(emptyProgress(), TENTS_TREES.map(p => p.id), 3));
    const sloppy = computeAptitude(solveMany(emptyProgress(), TENTS_TREES.map(p => p.id), 1));

    const tentsOf = (a: ReturnType<typeof computeAptitude>) => a.games.find(g => g.kind === 'tents')!;
    // Not exactly 1: scores are measured against the app's average
    // difficulty (`REFERENCE_MULTIPLIER`), and this pool sits a little
    // under it - so a clean sweep of Tents is excellent without being the
    // same achievement as a clean sweep of the app's hardest material.
    expect(tentsOf(flawless).precision).toBeGreaterThan(0.9);
    expect(tentsOf(flawless).precision).toBeLessThanOrEqual(1);
    expect(tentsOf(flawless).tested).toBe(true);

    // One star instead of three is exactly a third of the work, whatever
    // the tier mix underneath happens to be.
    expect(tentsOf(sloppy).precision).toBeCloseTo(tentsOf(flawless).precision / 3, 5);
  });

  test('only counts what was actually solved - an untouched puzzle is not a failed one', () => {
    // One puzzle, solved perfectly. Precision reflects that one solve
    // rather than being dragged toward zero by the untouched rest of the
    // pool - that is what coverage is for, and it is the one that stays
    // low here.
    const progress = solveAt(emptyProgress(), TENTS_TREES[0].id, 3);
    const tents = computeAptitude(progress).games.find(game => game.kind === 'tents')!;
    expect(tents.solved).toBe(1);
    expect(tents.coverage).toBeCloseTo(1 / TENTS_TREES.length, 5);
    expect(tents.precision).toBeGreaterThan(0.7);

    // Solving one more, just as cleanly, cannot lower it.
    const both = solveAt(progress, TENTS_TREES[1].id, 3);
    const after = computeAptitude(both).games.find(game => game.kind === 'tents')!;
    expect(after.precision).toBeGreaterThanOrEqual(tents.precision);
    expect(after.coverage).toBeGreaterThan(tents.coverage);
  });

  /** The reason difficulty scales the score at all: without it, the
   * cheapest way to a perfect chart would be to replay the easiest
   * puzzles in the app forever. */
  test('a flawless run of easy puzzles is good, but not full marks', () => {
    const easyIds = getLevelsByDifficulty('easy').map(level => level.id);
    expect(easyIds.length).toBeGreaterThan(0);

    const gravity = computeAptitude(solveMany(emptyProgress(), easyIds, 3)).games.find(
      game => game.kind === 'gravity',
    )!;
    expect(gravity.precision).toBeGreaterThan(0.6);
    expect(gravity.precision).toBeLessThan(1);
  });

  test('the same stars on harder material scores higher', () => {
    const easyIds = getLevelsByDifficulty('easy').map(level => level.id);
    const hardIds = getLevelsByDifficulty('hard').map(level => level.id);
    const gravityOf = (p: PlayerProgress) => computeAptitude(p).games.find(g => g.kind === 'gravity')!;

    // Same count, same stars each - the tier is the only difference.
    const count = Math.min(easyIds.length, hardIds.length, 8);
    const onEasy = solveMany(emptyProgress(), easyIds.slice(0, count), 3);
    const onHard = solveMany(emptyProgress(), hardIds.slice(0, count), 3);
    expect(gravityOf(onHard).precision).toBeGreaterThan(gravityOf(onEasy).precision);

    /* And the forgiveness half of the same rule: fumbling a hard puzzle
     * has to score better than fumbling an easy one. An earlier version
     * weighted the *average* by difficulty instead of scaling each score,
     * which inverted exactly this - a one-star hard solve pulled the mean
     * down further than a one-star easy solve did. */
    const fumbledEasy = solveMany(emptyProgress(), easyIds.slice(0, count), 1);
    const fumbledHard = solveMany(emptyProgress(), hardIds.slice(0, count), 1);
    expect(gravityOf(fumbledHard).precision).toBeGreaterThan(gravityOf(fumbledEasy).precision);
  });

  test('stars are reported raw alongside it, not only as a ratio', () => {
    const progress = solveMany(emptyProgress(), TENTS_TREES.slice(0, 3).map(p => p.id), 2);
    const tents = computeAptitude(progress).games.find(game => game.kind === 'tents')!;
    expect(tents.stars).toBe(6);
    expect(tents.solved).toBe(3);
  });
});

describe('computeAptitude - the index', () => {
  test('appears exactly once the minimum is met, and not before', () => {
    const ids = LEVELS.slice(0, MIN_SOLVES_FOR_INDEX).map(level => level.id);
    const justUnder = computeAptitude(solveMany(emptyProgress(), ids.slice(0, -1), 3));
    const justEnough = computeAptitude(solveMany(emptyProgress(), ids, 3));

    expect(justUnder.index).toBeNull();
    expect(justEnough.index).not.toBeNull();
  });

  test('rises with how cleanly you play', () => {
    const ids = LEVELS.slice(0, 20).map(level => level.id);
    const sloppy = computeAptitude(solveMany(emptyProgress(), ids, 1)).index!;
    const clean = computeAptitude(solveMany(emptyProgress(), ids, 3)).index!;
    expect(clean).toBeGreaterThan(sloppy);
  });

  /** Coverage's contribution is real but slow by design - it is 30% of the
   * blend spread across every puzzle in the app, so ten more solves out of
   * 250-odd is worth a fraction of a point and rounds away. It has to be
   * *visible* over a serious stretch of play, though, or it may as well
   * not be in the formula. */
  test('rises with how much you play, over a stretch big enough to see', () => {
    const ids = LEVELS.map(level => level.id);
    const some = computeAptitude(solveMany(emptyProgress(), ids.slice(0, 10), 3)).index!;
    const many = computeAptitude(solveMany(emptyProgress(), ids.slice(0, 120), 3)).index!;
    expect(many).toBeGreaterThan(some);
  });

  /** A score that could run away is a score nobody can read. Whatever the
   * player does, it has to land inside the band the card is designed
   * around. */
  test('stays inside its own scale, even at both extremes', () => {
    const everything = ROTATION.length > 0 ? computeAptitude(solveEverything()).index! : 0;
    expect(everything).toBeLessThanOrEqual(145);
    expect(everything).toBeGreaterThanOrEqual(85);

    const barely = computeAptitude(
      solveMany(emptyProgress(), LEVELS.slice(0, MIN_SOLVES_FOR_INDEX).map(l => l.id), 1),
    ).index!;
    expect(barely).toBeGreaterThanOrEqual(85);
    expect(barely).toBeLessThan(everything);
  });

  /** Solving literally everything flawlessly has to land at the very top
   * of the scale. It reaches it by way of the clamp rather than by
   * arithmetic: the pool's own tier mix averages a shade under 1, and the
   * hard and expert material is what carries it over. */
  test('a perfect run of everything tops the scale out', () => {
    const perfect = computeAptitude(solveEverything());
    expect(perfect.solved).toBe(perfect.total);
    expect(perfect.coverage).toBeCloseTo(1, 5);
    expect(perfect.precision).toBeCloseTo(1, 5);
    expect(perfect.index).toBe(145);
  });
});

describe('computeAptitude - strongest and weakest', () => {
  test('stay null until two games have been tested', () => {
    const one = computeAptitude(solveMany(emptyProgress(), TENTS_TREES.map(p => p.id), 3));
    expect(one.strongest).toBeNull();
    expect(one.weakest).toBeNull();
  });

  test('pick the cleanest and the scrappiest of the games actually played', () => {
    let progress = solveMany(emptyProgress(), TENTS_TREES.slice(0, 3).map(p => p.id), 3);
    progress = solveMany(progress, BINAIRO.slice(0, 3).map(p => p.id), 1);
    const aptitude = computeAptitude(progress);

    expect(aptitude.strongest).toBe('tents');
    expect(aptitude.weakest).toBe('binairo');
  });

  /** An untested game must never be named the weakest: it has no score
   * because it has no evidence, and "you are worst at Lights Out" when
   * the player has never opened Lights Out is simply wrong. */
  test('never names an untested game as the weakest', () => {
    let progress = solveMany(emptyProgress(), TENTS_TREES.slice(0, 2).map(p => p.id), 3);
    progress = solveMany(progress, BINAIRO.slice(0, 2).map(p => p.id), 2);
    const aptitude = computeAptitude(progress);

    const untested = aptitude.games.filter(game => !game.tested).map(game => game.kind);
    expect(untested.length).toBeGreaterThan(0);
    expect(untested).not.toContain(aptitude.weakest);
    expect(aptitude.weakest).toBe('binairo');
  });
});

/** Every puzzle in the app, solved at three stars. */
function solveEverything(): PlayerProgress {
  const allIds = [
    ...LEVELS.map(level => level.id),
    ...MIRROR_MAZES.map(puzzle => puzzle.id),
    ...TENTS_TREES.map(puzzle => puzzle.id),
    ...TOWERS.map(puzzle => puzzle.id),
    ...BINAIRO.map(puzzle => puzzle.id),
    ...ARUKONE.map(puzzle => puzzle.id),
    ...FILLAPIX.map(puzzle => puzzle.id),
    ...LIGHTS_OUT.map(puzzle => puzzle.id),
    ...ADJACENT.map(puzzle => puzzle.id),
    ...BLOOM.map(puzzle => puzzle.id),
    ...MOSAIC.map(puzzle => puzzle.id),
    ...BRIDGES.map(puzzle => puzzle.id),
  ];
  return solveMany(emptyProgress(), allIds, 3);
}
