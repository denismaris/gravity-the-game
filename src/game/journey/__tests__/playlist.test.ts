import { JOURNEY, ROTATION, buildJourney, getNextJourneyEntry, journeyEntryOf, nextEntryOfKind } from '..';
import { LEVELS } from '../../levels';
import { MIRROR_MAZES } from '../../mirror';
import { TENTS_TREES } from '../../tents';
import { TOWERS } from '../../towers';
import { BINAIRO } from '../../binairo';

describe('the interleaved Journey', () => {
  test('holds every puzzle from every game, exactly once', () => {
    expect(JOURNEY).toHaveLength(LEVELS.length + MIRROR_MAZES.length + TENTS_TREES.length + TOWERS.length + BINAIRO.length);
    const ids = JOURNEY.map(e => e.puzzleId);
    expect(new Set(ids).size).toBe(ids.length);

    const count = (k: string) => JOURNEY.filter(e => e.kind === k).length;
    expect(count('gravity')).toBe(LEVELS.length);
    expect(count('mirror')).toBe(MIRROR_MAZES.length);
    expect(count('tents')).toBe(TENTS_TREES.length);
    expect(count('towers')).toBe(TOWERS.length);
    expect(count('binairo')).toBe(BINAIRO.length);
  });

  test('positions are 1..N with no gaps', () => {
    expect(JOURNEY.map(e => e.position)).toEqual(
      Array.from({ length: JOURNEY.length }, (_, i) => i + 1),
    );
  });

  test('opens with one full rotation, then repeats it', () => {
    expect(JOURNEY.slice(0, ROTATION.length * 2).map(e => e.kind)).toEqual([...ROTATION, ...ROTATION]);
  });

  test('never repeats a game back-to-back while more than one game has puzzles left', () => {
    // Whichever pool is shortest runs out first; up to (and including) the
    // position it runs out at, every pool is still in play, so no adjacent
    // pair may share a kind. Computed rather than naming a pool directly,
    // so this keeps holding however the pools grow.
    const lastPositionOfKind = new Map<string, number>();
    for (const entry of JOURNEY) lastPositionOfKind.set(entry.kind, entry.position);
    const cutover = Math.min(...lastPositionOfKind.values());

    for (let i = 1; i < JOURNEY.length; i += 1) {
      if (JOURNEY[i].position <= cutover) {
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
      // The opening deal is one full rotation (see `ROTATION`) - so the
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
