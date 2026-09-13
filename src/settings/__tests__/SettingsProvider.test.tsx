import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { createMemoryBackend, StorageBackend } from '../../storage';
import * as renderingMock from '../../game/rendering';
import { SettingsProvider, useSettings } from '../SettingsProvider';
import { SETTINGS_KEY } from '../settingsStore';

jest.mock('../../game/rendering', () => ({
  setHapticsEnabled: jest.fn(),
  setSoundEnabled: jest.fn(),
}));
const setHapticsEnabledMock = jest.mocked(renderingMock.setHapticsEnabled);
const setSoundEnabledMock = jest.mocked(renderingMock.setSoundEnabled);

async function renderWithCapturedApi(backend?: StorageBackend) {
  const api: { current: ReturnType<typeof useSettings> | null } = { current: null };

  function Capture() {
    api.current = useSettings();
    return null;
  }

  await act(async () => {
    ReactTestRenderer.create(
      <SettingsProvider backend={backend}>
        <Capture />
      </SettingsProvider>,
    );
  });

  return api;
}

beforeEach(() => {
  setHapticsEnabledMock.mockClear();
  setSoundEnabledMock.mockClear();
});

describe('SettingsProvider - defaults and toggles', () => {
  test('starts ready with sound and haptics on', async () => {
    const api = await renderWithCapturedApi(createMemoryBackend());
    expect(api.current!.ready).toBe(true);
    expect(api.current!.settings.soundEnabled).toBe(true);
    expect(api.current!.settings.hapticsEnabled).toBe(true);
  });

  test('syncs the imperative rendering gates on load', async () => {
    await renderWithCapturedApi(createMemoryBackend());
    expect(setSoundEnabledMock).toHaveBeenCalledWith(true);
    expect(setHapticsEnabledMock).toHaveBeenCalledWith(true);
  });

  test('toggling sound updates state, persists, and re-syncs the gate', async () => {
    const backend = createMemoryBackend();
    const api = await renderWithCapturedApi(backend);

    await act(async () => {
      api.current!.setSoundEnabled(false);
    });

    expect(api.current!.settings.soundEnabled).toBe(false);
    expect(setSoundEnabledMock).toHaveBeenLastCalledWith(false);

    const raw = await backend.getItem(SETTINGS_KEY);
    expect(JSON.parse(raw!).soundEnabled).toBe(false);
  });

  test('toggling haptics does not affect sound, and vice versa', async () => {
    const api = await renderWithCapturedApi(createMemoryBackend());

    await act(async () => {
      api.current!.setHapticsEnabled(false);
    });

    expect(api.current!.settings.hapticsEnabled).toBe(false);
    expect(api.current!.settings.soundEnabled).toBe(true);
  });
});

describe('SettingsProvider - tutorials', () => {
  test('a tutorial is unseen until marked', async () => {
    const api = await renderWithCapturedApi(createMemoryBackend());
    expect(api.current!.hasSeenTutorial('game:gravity')).toBe(false);

    await act(async () => {
      api.current!.markTutorialSeen('game:gravity');
    });

    expect(api.current!.hasSeenTutorial('game:gravity')).toBe(true);
  });

  test('marking a tutorial persists it', async () => {
    const backend = createMemoryBackend();
    const api = await renderWithCapturedApi(backend);

    await act(async () => {
      api.current!.markTutorialSeen('mechanic:hazard');
    });

    const raw = await backend.getItem(SETTINGS_KEY);
    expect(JSON.parse(raw!).seenTutorials).toEqual(['mechanic:hazard']);
  });
});

/**
 * Regression coverage for the same load-vs-write race fixed in
 * `PlayerProgressProvider` (see its own test file for the full writeup): a
 * mutation applied before the initial `loadSettings()` resolves must survive
 * and be replayed on top of the real loaded data, not lost or used to
 * silently overwrite disk with a write based on the default settings.
 */
describe('SettingsProvider - mutation vs. initial load race', () => {
  test('a toggle before the load resolves survives, and never wipes what was already on disk', async () => {
    const seeded = { version: 1, soundEnabled: false, hapticsEnabled: true, seenTutorials: ['game:gravity'] };
    const backend = createMemoryBackend({ [SETTINGS_KEY]: JSON.stringify(seeded) });

    let releaseLoad!: () => void;
    const gate = new Promise<void>(resolve => {
      releaseLoad = resolve;
    });
    const delayedBackend: StorageBackend = {
      getItem: async key => {
        await gate;
        return backend.getItem(key);
      },
      setItem: (key, value) => backend.setItem(key, value),
      removeItem: key => backend.removeItem(key),
    };

    const api: { current: ReturnType<typeof useSettings> | null } = { current: null };
    function Capture() {
      api.current = useSettings();
      return null;
    }

    act(() => {
      ReactTestRenderer.create(
        <SettingsProvider backend={delayedBackend}>
          <Capture />
        </SettingsProvider>,
      );
    });

    expect(api.current!.ready).toBe(false);

    act(() => {
      api.current!.markTutorialSeen('mechanic:hazard');
    });
    expect(api.current!.hasSeenTutorial('mechanic:hazard')).toBe(true);

    releaseLoad();
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
    });

    expect(api.current!.ready).toBe(true);
    // The pre-load mutation survives...
    expect(api.current!.hasSeenTutorial('mechanic:hazard')).toBe(true);
    // ...on top of what was really on disk, not a default base.
    expect(api.current!.settings.soundEnabled).toBe(false);
    expect(api.current!.hasSeenTutorial('game:gravity')).toBe(true);

    const persisted = JSON.parse((await backend.getItem(SETTINGS_KEY))!);
    expect(persisted.soundEnabled).toBe(false);
    expect(persisted.seenTutorials).toEqual(['game:gravity', 'mechanic:hazard']);
  });
});
