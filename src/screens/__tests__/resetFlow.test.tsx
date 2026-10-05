import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from '../HomeScreen';
import { PlayerProgressProvider, emptyProgress, usePlayerProgress } from '../../progression';
import { PLAYER_PROGRESS_KEY } from '../../progression/playerProgressStore';
import { createMemoryBackend } from '../../storage';
import { SettingsProvider } from '../../settings';

/**
 * Resetting the save (Settings, or signing out) while Home is mounted
 * underneath must leave a Home that renders - a played save swapped for a
 * new player's in one step.
 */
test('Home survives the save being reset under it', async () => {
  let api!: ReturnType<typeof usePlayerProgress>;
  function Probe(): null {
    api = usePlayerProgress();
    return null;
  }
  const errors: unknown[] = [];
  const spy = jest.spyOn(console, 'error').mockImplementation((...args) => errors.push(args));
  const noop = () => {};
  const played = { ...emptyProgress(), introSeen: true, coins: 900, currentLevel: 7, streak: { current: 5, best: 5, lastPlayedKey: null } };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
        <SettingsProvider backend={createMemoryBackend({})}>
          <PlayerProgressProvider backend={createMemoryBackend({ [PLAYER_PROGRESS_KEY]: JSON.stringify(played) })}>
            <Probe />
            <HomeScreen onOpen={noop} onOpenSettings={noop} onOpenAchievements={noop} onOpenJourney={noop} onOpenShop={noop} onOpenLedger={noop} onOpenLeaderboard={noop} />
          </PlayerProgressProvider>
        </SettingsProvider>
      </SafeAreaProvider>,
    );
  });
  await act(async () => {
    api.resetProgress();
  });
  await act(async () => {
    jest.advanceTimersByTime?.(1000);
  });
  spy.mockRestore();
  expect(errors.map(e => String((e as unknown[])[0]).slice(0, 300))).toEqual([]);
  expect(api.progress.coins).toBe(emptyProgress().coins);
  expect(api.progress.currentBatch).not.toBeNull();
  await act(async () => renderer.unmount());
});
