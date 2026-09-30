import { patternToEvents } from '../haptics';

describe('patternToEvents', () => {
  test('a single pulse is one tap, firmer the longer it was', () => {
    const [light] = patternToEvents(4);
    const [firm] = patternToEvents(45);
    expect(light.time).toBe(0);
    expect(firm.intensity!).toBeGreaterThan(light.intensity!);
    expect(firm.intensity!).toBeLessThanOrEqual(1);
  });

  test('a [wait, vibrate, ...] pattern taps at each pulse start', () => {
    expect(patternToEvents([0, 18, 55, 18]).map(e => e.time)).toEqual([0, 73]);
  });
});
