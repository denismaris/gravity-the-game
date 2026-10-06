import { buildPiece, canBuild, currentVilla, DAILY_TESSERAE, migrateVillaIds, nextPiece, PIECES_PER_VILLA, tesseraeForSolve, villaAt } from '../villa';
import { emptyProgress, PlayerProgress } from '../playerProgress';
import { parseProgress } from '../playerProgressStore';
import { mergeProgress } from '../../backend/merge';

const withTiles = (tesserae: number, villa: string[] = []): PlayerProgress => ({ ...emptyProgress(), tesserae, villa });

describe('tiles for a solve', () => {
  test('a first solve pays one for the puzzle and one per star', () => {
    expect(tesseraeForSolve({ previousStars: 0, bestStars: 3, firstDailyToday: false })).toBe(4);
    expect(tesseraeForSolve({ previousStars: 0, bestStars: 1, firstDailyToday: false })).toBe(2);
  });
  test('a replay pays only for stars newly earned, and the Daily pays extra', () => {
    expect(tesseraeForSolve({ previousStars: 2, bestStars: 3, firstDailyToday: false })).toBe(1);
    expect(tesseraeForSolve({ previousStars: 3, bestStars: 3, firstDailyToday: false })).toBe(0);
    expect(tesseraeForSolve({ previousStars: 0, bestStars: 3, firstDailyToday: true })).toBe(4 + DAILY_TESSERAE);
  });
});

describe('the villas', () => {
  test('every villa is the same every time, with its own name, and later ones cost more', () => {
    expect(villaAt(3)).toEqual(villaAt(3));
    const names = new Set(Array.from({ length: 12 }, (_v, i) => villaAt(i).name));
    expect(names.size).toBe(12);
    expect(villaAt(12).name).not.toBe(villaAt(0).name);
    const total = (i: number) => villaAt(i).pieces.reduce((sum, p) => sum + p.cost, 0);
    expect(total(5)).toBeGreaterThan(total(0));
    expect(total(500)).toBeLessThanOrEqual(total(0) * 2 + PIECES_PER_VILLA);
  });

  test('pieces go up in order, each paid for in tiles', () => {
    const first = villaAt(0).pieces[0];
    expect(nextPiece(withTiles(0))).toEqual(first);
    expect(buildPiece(withTiles(first.cost - 1), first.id)).toBeNull();
    expect(buildPiece(withTiles(500), villaAt(0).pieces[1].id)).toBeNull();
    const built = buildPiece(withTiles(first.cost + 3), first.id)!;
    expect(built.tesserae).toBe(3);
    expect(built.villa).toEqual([first.id]);
    expect(nextPiece(built)).toEqual(villaAt(0).pieces[1]);
    expect(canBuild(withTiles(first.cost))).toBe(true);
    expect(canBuild(withTiles(0))).toBe(false);
  });

  test('finishing a villa starts the next one, forever', () => {
    let progress = withTiles(100000);
    for (let i = 0; i < PIECES_PER_VILLA * 3; i += 1) progress = buildPiece(progress, nextPiece(progress).id)!;
    const where = currentVilla(progress);
    expect(where.finished).toBe(3);
    expect(where.built).toBe(0);
    expect(where.plan.index).toBe(3);
  });
});

describe('saving', () => {
  test('a save from before the Villa starts with two tiles a solved puzzle', () => {
    const old = { ...emptyProgress(), levels: { 'level-001': { completed: true, stars: 3, bestMoves: 1 }, 'level-002': { completed: true, stars: 2, bestMoves: 2 } } } as Record<string, unknown>;
    delete old.tesserae;
    delete old.villa;
    const loaded = parseProgress(JSON.stringify(old));
    expect(loaded.tesserae).toBe(4);
    expect(loaded.villa).toEqual([]);
  });
  test('pieces built in the one-room version carry into the first villa', () => {
    expect(migrateVillaIds(['atrium-floor', 'atrium-pool', 'atrium-columns'])).toEqual(['v0-0', 'v0-1', 'v0-2']);
    const loaded = parseProgress(JSON.stringify({ ...emptyProgress(), villa: ['atrium-floor', 'atrium-pool'] }));
    expect(currentVilla(loaded).built).toBe(2);
  });
  test('built pieces survive a merge from either side', () => {
    const merged = mergeProgress(withTiles(5, ['v0-0']), withTiles(9, ['v0-0', 'v0-1']));
    expect(merged.villa).toEqual(expect.arrayContaining(['v0-0', 'v0-1']));
  });
});
