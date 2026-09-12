import { JOURNEY, buildJourney, getNextJourneyEntry, journeyEntryOf, nextEntryOfKind } from '..';
import { LEVELS } from '../../levels';
import { CONSTELLATIONS } from '../../constellation';
import { TRAJECTORIES } from '../../trajectory';

describe('the interleaved Journey', () => {
  test('holds every puzzle from all three games, exactly once', () => {
    expect(JOURNEY).toHaveLength(
      LEVELS.length + CONSTELLATIONS.length + TRAJECTORIES.length,
    );
    const ids = JOURNEY.map(e => e.puzzleId);
    expect(new Set(ids).size).toBe(ids.length);

    const count = (k: string) => JOURNEY.filter(e => e.kind === k).length;
    expect(count('gravity')).toBe(LEVELS.length);
    expect(count('constellation')).toBe(CONSTELLATIONS.length);
    expect(count('trajectory')).toBe(TRAJECTORIES.length);
  });

  test('positions are 1..N with no gaps', () => {
    expect(JOURNEY.map(e => e.position)).toEqual(
      Array.from({ length: JOURNEY.length }, (_, i) => i + 1),
    );
  });

  test('opens 1-1-1: gravity, constellation, trajectory, repeating', () => {
    expect(JOURNEY.slice(0, 6).map(e => e.kind)).toEqual([
      'gravity',
      'constellation',
      'trajectory',
      'gravity',
      'constellation',
      'trajectory',
    ]);
  });

  test('never repeats a game back-to-back while more than one game has puzzles left', () => {
    // trajectory is the shortest pool; while it still has entries there are
    // >= 2 games in play, so no adjacent pair may share a kind.
    const lastTrajectory = Math.max(
      ...JOURNEY.filter(e => e.kind === 'trajectory').map(e => e.position),
    );
    for (let i = 1; i < JOURNEY.length; i += 1) {
      if (JOURNEY[i].position <= lastTrajectory) {
        expect(JOURNEY[i].kind).not.toBe(JOURNEY[i - 1].kind);
      }
    }
  });

  test('the gravity tail carries the chapter (world) name', () => {
    const first = JOURNEY.find(e => e.kind === 'gravity')!;
    expect(first.chapter).toBe('Gravity');
    const late = JOURNEY.filter(e => e.kind === 'gravity').slice(-1)[0];
    expect(late.chapter.length).toBeGreaterThan(0);
  });

  test('buildJourney is deterministic', () => {
    expect(buildJourney().map(e => e.puzzleId)).toEqual(JOURNEY.map(e => e.puzzleId));
  });

  test('lookups', () => {
    expect(journeyEntryOf(JOURNEY[3].puzzleId)).toBe(JOURNEY[3]);
    expect(journeyEntryOf('nope')).toBeUndefined();
    const g = nextEntryOfKind('gravity', 2);
    expect(g?.kind).toBe('gravity');
    expect(g!.position).toBeGreaterThanOrEqual(2);
  });

  describe('getNextJourneyEntry', () => {
    test('advances one position at a time, across game kinds', () => {
      const first = getNextJourneyEntry(JOURNEY[0].puzzleId);
      expect(first).toBe(JOURNEY[1]);
      // The opening deal is gravity, constellation, trajectory - so the
      // entry after a gravity puzzle is a *different* game, not another
      // gravity level. This is the whole point of routing every
      // completion screen's "Next" through this selector.
      expect(first!.kind).not.toBe(JOURNEY[0].kind);
    });

    test('is null at the end of the Journey', () => {
      const last = JOURNEY[JOURNEY.length - 1];
      expect(getNextJourneyEntry(last.puzzleId)).toBeNull();
    });

    test('is null for an id that is not in the Journey', () => {
      expect(getNextJourneyEntry('nope')).toBeNull();
    });
  });
});
