import { createMemoryBackend } from '../../storage';
import { defaultSettings, withHapticsEnabled, withSoundEnabled, withTutorialSeen } from '../settings';
import { loadSettings, parseSettings, saveSettings, SETTINGS_KEY } from '../settingsStore';

describe('parseSettings', () => {
  test('null / empty -> default settings', () => {
    expect(parseSettings(null)).toEqual(defaultSettings());
    expect(parseSettings('')).toEqual(defaultSettings());
  });

  test('malformed JSON -> default settings (no throw)', () => {
    expect(parseSettings('{not json')).toEqual(defaultSettings());
  });

  test('unreadable schema version -> default settings', () => {
    expect(parseSettings(JSON.stringify({ version: 999 }))).toEqual(defaultSettings());
    expect(parseSettings(JSON.stringify({ version: 'nope' }))).toEqual(defaultSettings());
  });

  test('reads real toggles and seen tutorials', () => {
    const parsed = parseSettings(
      JSON.stringify({
        version: 1,
        soundEnabled: false,
        hapticsEnabled: false,
        seenTutorials: ['game:gravity', 'mechanic:hazard'],
      }),
    );
    expect(parsed).toEqual({
      version: 1,
      soundEnabled: false,
      hapticsEnabled: false,
      seenTutorials: ['game:gravity', 'mechanic:hazard'],
    });
  });

  test('malformed toggle fields fall back to the safe default (on)', () => {
    const parsed = parseSettings(JSON.stringify({ version: 1, soundEnabled: 'nope', hapticsEnabled: 1 }));
    expect(parsed.soundEnabled).toBe(true);
    expect(parsed.hapticsEnabled).toBe(true);
  });

  test('a non-array or mixed-type seenTutorials drops only the bad entries', () => {
    expect(parseSettings(JSON.stringify({ version: 1, seenTutorials: 'nope' })).seenTutorials).toEqual([]);
    expect(
      parseSettings(JSON.stringify({ version: 1, seenTutorials: ['game:gravity', 5, null] })).seenTutorials,
    ).toEqual(['game:gravity']);
  });
});

describe('loadSettings / saveSettings round-trip', () => {
  test('what is saved is what is loaded', async () => {
    const backend = createMemoryBackend();
    let settings = defaultSettings();
    settings = withSoundEnabled(settings, false);
    settings = withHapticsEnabled(settings, false);
    settings = withTutorialSeen(settings, 'game:binairo');

    await saveSettings(backend, settings);
    const loaded = await loadSettings(backend);

    expect(loaded).toEqual(settings);
  });

  test('loading a fresh backend yields default settings', async () => {
    const loaded = await loadSettings(createMemoryBackend());
    expect(loaded).toEqual(defaultSettings());
  });

  test('a throwing backend degrades to default settings instead of rejecting', async () => {
    const brokenBackend = {
      getItem: () => Promise.reject(new Error('disk gone')),
      setItem: () => Promise.reject(new Error('disk gone')),
      removeItem: () => Promise.reject(new Error('disk gone')),
    };
    await expect(loadSettings(brokenBackend)).resolves.toEqual(defaultSettings());
    await expect(saveSettings(brokenBackend, defaultSettings())).resolves.toBeUndefined();
  });

  test('persists under the documented key', async () => {
    const backend = createMemoryBackend();
    await saveSettings(backend, withSoundEnabled(defaultSettings(), false));
    const raw = await backend.getItem(SETTINGS_KEY);
    expect(raw).toContain('soundEnabled');
  });
});
