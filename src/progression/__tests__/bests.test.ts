import { mergeProgress } from '../../backend/merge';
import { emptyProgress } from '../playerProgress';
import { parseProgress } from '../playerProgressStore';

/** Each game's fastest solve: kept across a reload, and across devices. */
describe('personal bests', () => {
  test('survive a save and a load', () => {
    const progress = { ...emptyProgress(), bests: { binairo: 72_000, glass: 41_500 } };
    expect(parseProgress(JSON.stringify(progress)).bests).toEqual({ binairo: 72_000, glass: 41_500 });
  });

  test('a save from before they were kept loads with none', () => {
    const older: Record<string, unknown> = { ...emptyProgress() };
    delete older.bests;
    expect(parseProgress(JSON.stringify(older)).bests).toEqual({});
  });

  test('nonsense times are dropped, not trusted', () => {
    const raw = JSON.stringify({ ...emptyProgress(), bests: { binairo: -5, glass: 'fast', mosaic: 30_000 } });
    expect(parseProgress(raw).bests).toEqual({ mosaic: 30_000 });
  });

  test('two devices keep the faster time for each game', () => {
    const phone = { ...emptyProgress(), bests: { binairo: 60_000, glass: 50_000 } };
    const tablet = { ...emptyProgress(), bests: { binairo: 45_000, mosaic: 20_000 } };
    expect(mergeProgress(phone, tablet).bests).toEqual({ binairo: 45_000, glass: 50_000, mosaic: 20_000 });
  });
});
