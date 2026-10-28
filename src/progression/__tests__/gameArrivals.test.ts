import { createMemoryBackend } from '../../storage';
import { loadGameArrivals, markArrivalSeen, newlyArrived } from '../gameArrivals';

/** A new game is greeted once; games already held are never greeted. */
describe('game arrivals', () => {
  test('the first look takes every game already held as seen', async () => {
    await loadGameArrivals(createMemoryBackend());
    expect(newlyArrived(['lightsout', 'glass'])).toBeNull();
  });

  test('a game arriving later is greeted until it is marked seen', async () => {
    await loadGameArrivals(createMemoryBackend());
    newlyArrived(['lightsout', 'glass']);
    expect(newlyArrived(['lightsout', 'glass', 'adjacent'])).toBe('adjacent');
    markArrivalSeen('adjacent');
    expect(newlyArrived(['lightsout', 'glass', 'adjacent'])).toBeNull();
  });

  test('what was seen survives a reload', async () => {
    const storage = createMemoryBackend();
    await loadGameArrivals(storage);
    newlyArrived(['lightsout']);
    markArrivalSeen('glass');
    await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
    await loadGameArrivals(storage);
    expect(newlyArrived(['lightsout', 'glass'])).toBeNull();
    expect(newlyArrived(['lightsout', 'glass', 'mosaic'])).toBe('mosaic');
  });
});

describe('game arrivals, against what was played', () => {
  test('a game already played is never greeted, even if not recorded as seen', async () => {
    await loadGameArrivals(createMemoryBackend());
    newlyArrived(['lightsout']);
    expect(newlyArrived(['lightsout', 'glass'], new Set(['lightsout', 'glass']))).toBeNull();
    expect(newlyArrived(['lightsout', 'glass', 'adjacent'], new Set(['lightsout', 'glass']))).toBe('adjacent');
  });
});
