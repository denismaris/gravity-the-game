import { defaultSettings, withHapticsEnabled, withSoundEnabled, withTutorialSeen } from '../settings';

describe('defaultSettings', () => {
  test('starts with sound and haptics on, and no tutorials seen', () => {
    expect(defaultSettings()).toEqual({
      version: 1,
      soundEnabled: true,
      hapticsEnabled: true,
      seenTutorials: [],
    });
  });
});

describe('withSoundEnabled / withHapticsEnabled', () => {
  test('toggle independently', () => {
    let s = defaultSettings();
    s = withSoundEnabled(s, false);
    expect(s.soundEnabled).toBe(false);
    expect(s.hapticsEnabled).toBe(true);

    s = withHapticsEnabled(s, false);
    expect(s.soundEnabled).toBe(false);
    expect(s.hapticsEnabled).toBe(false);
  });

  test('setting the same value returns the identical object (no-op)', () => {
    const s = defaultSettings();
    expect(withSoundEnabled(s, true)).toBe(s);
    expect(withHapticsEnabled(s, true)).toBe(s);
  });
});

describe('withTutorialSeen', () => {
  test('appends a new id', () => {
    const s = withTutorialSeen(defaultSettings(), 'game:gravity');
    expect(s.seenTutorials).toEqual(['game:gravity']);
  });

  test('accumulates distinct ids in call order', () => {
    let s = defaultSettings();
    s = withTutorialSeen(s, 'game:gravity');
    s = withTutorialSeen(s, 'mechanic:hazard');
    expect(s.seenTutorials).toEqual(['game:gravity', 'mechanic:hazard']);
  });

  test('marking the same id twice is idempotent and returns the identical object', () => {
    const once = withTutorialSeen(defaultSettings(), 'game:gravity');
    const twice = withTutorialSeen(once, 'game:gravity');
    expect(twice).toBe(once);
    expect(twice.seenTutorials).toEqual(['game:gravity']);
  });
});
