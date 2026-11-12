import { ACTS, actProgress, clamp01, easeInOut, easeOut, letterProgress, PRESS, tilePress, TOTAL_MS } from '../launchChoreography';

describe('easing', () => {
  test('starts at 0, ends at 1, and stays in range', () => {
    for (const ease of [easeOut, easeInOut]) {
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
      for (let t = -0.5; t <= 1.5; t += 0.05) {
        const v = ease(t);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  test('clamp01 survives the values a divide by zero gives', () => {
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(1);
    expect(clamp01(-Infinity)).toBe(0);
  });
});

describe('act structure', () => {
  test('acts run in order and overlap, so nothing waits for a full stop', () => {
    const { tileIn, assemble, wordmark, handoff } = ACTS;
    expect(assemble.start).toBeGreaterThan(tileIn.start);
    expect(assemble.start).toBeLessThan(tileIn.end);
    expect(wordmark.start).toBeLessThan(assemble.end);
    expect(handoff.start).toBeGreaterThan(wordmark.end);
    expect(TOTAL_MS).toBe(handoff.end);
  });

  /** A launch animation is charged to every cold start (a tap skips it).
   * The player found three seconds too long, then two. */
  test('the whole sequence stays under one and a half seconds', () => {
    expect(TOTAL_MS).toBeLessThanOrEqual(1500);
  });

  test('actProgress runs 0 to 1 across its act and holds there', () => {
    expect(actProgress(ACTS.tileIn.start, ACTS.tileIn)).toBe(0);
    expect(actProgress(ACTS.tileIn.end, ACTS.tileIn)).toBe(1);
    expect(actProgress(ACTS.tileIn.end + 5000, ACTS.tileIn)).toBe(1);
    expect(actProgress(-100, ACTS.tileIn)).toBe(0);
  });
});

describe('letterProgress', () => {
  const COUNT = 11; // TESSELLATUM

  test('sets left to right and finishes with the act', () => {
    const mid = (ACTS.wordmark.start + ACTS.wordmark.end) / 2;
    for (let i = 1; i < COUNT; i += 1) expect(letterProgress(mid, i, COUNT)).toBeLessThanOrEqual(letterProgress(mid, i - 1, COUNT));
    for (let i = 0; i < COUNT; i += 1) expect(letterProgress(ACTS.wordmark.end, i, COUNT)).toBeCloseTo(1, 5);
    expect(letterProgress(ACTS.wordmark.start, 0, COUNT)).toBe(0);
  });
});

describe('the press as the gem seats', () => {
  test('is still before and after, and gives in between', () => {
    expect(tilePress(PRESS.start - 1)).toBe(0);
    expect(tilePress(PRESS.end + 1)).toBe(0);
    expect(tilePress((PRESS.start + PRESS.end) / 2)).toBeGreaterThan(0.5);
  });
});
