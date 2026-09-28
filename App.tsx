/**
 * Gravity
 * Root application shell.
 *
 * @format
 */

import React, { useCallback, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  AchievementsScreen,
  AdjacentScreen,
  BloomScreen,
  ArukoneScreen,
  FillaPixScreen,
  LightsOutScreen,
  BinairoScreen,
  GameScreen,
  HomeScreen,
  MirrorMazeScreen,
  SettingsScreen,
  TentsScreen,
  TowersScreen,
} from './src/screens';
import { ErrorBoundary, LaunchSequence, ScreenTransition } from './src/components';
import { getLevelById } from './src/game/levels';
import { getMirrorMazeById } from './src/game/mirror';
import { getTentsTreesById } from './src/game/tents';
import { getTowersById } from './src/game/towers';
import { getBinairoById } from './src/game/binairo';
import { getArukoneById } from './src/game/arukone';
import { getFillaPixById } from './src/game/fillapix';
import { getLightsOutById } from './src/game/lightsout';
import { getAdjacentById } from './src/game/adjacent';
import { getBloomById } from './src/game/bloom';
import { GameKind, NextPuzzleOptions } from './src/game/journey';
import { CalmingInterstitialScreen } from './src/interstitial';
import { PlayerProgressProvider, usePlayerProgress } from './src/progression';
import { SettingsProvider, useSettings } from './src/settings';
import { theme } from './src/theme';

interface Selected {
  kind: GameKind;
  puzzleId: string;
}

/** Settings and Achievements are reachable only from Home, and opening a
 * puzzle from either closes it - so one flag alongside `selected` is
 * enough; they can never be meaningfully "open" at the same time as a
 * puzzle. No `'browse'` route - the randomized level-batch system (see
 * `src/progression/batches.ts`) replaces the need for a manual
 * level-select/browse screen entirely; there is deliberately no way to
 * pick a specific puzzle by hand. */
type OverlayRoute = 'settings' | 'achievements' | null;

/**
 * App wires up the global providers and renders `AppRoutes` inside them -
 * the actual screen-switching logic needs `useSettings()` (to decide
 * whether the calming interstitial is even on), which only works for a
 * component rendered *inside* `SettingsProvider`, not for `App` itself,
 * since `App` is what instantiates the provider.
 */
function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <SettingsProvider>
          <PlayerProgressProvider>
            <Boot />
          </PlayerProgressProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

/**
 * The cold start: the launch sequence over the app until it has both
 * played its beat and got a loaded app to hand off to.
 *
 * It lives *inside* both providers because it needs their `ready` flags,
 * and it renders over `AppRoutes` rather than instead of it, so the real
 * screen is already mounted and laid out by the time the cover lifts -
 * handing off to a blank frame would undo the whole point.
 *
 * This also covers a rough edge that was always there: both providers hand
 * out defaults until their async storage read resolves, so Home's first
 * frames show level 1's placeholder batch before snapping to the real save
 * (see `withBatch` in `PlayerProgressProvider`). The sequence is over that
 * window, so nobody sees it any more.
 */
function Boot(): React.JSX.Element {
  const { ready: settingsReady } = useSettings();
  const { ready: progressReady } = usePlayerProgress();
  const [launched, setLaunched] = useState(false);
  const finishLaunch = useCallback(() => setLaunched(true), []);

  return (
    <>
      <AppRoutes />
      {!launched && <LaunchSequence appReady={settingsReady && progressReady} onDone={finishLaunch} />}
    </>
  );
}

/**
 * Switches between the hub (`Home`) and whichever game the current level
 * batch's puzzle belongs to, and - between levels - the calming
 * interstitial (see `src/interstitial/`). There is no level select. A real
 * navigator can replace this state switch later.
 */
function AppRoutes(): React.JSX.Element {
  const { settings } = useSettings();
  const [selected, setSelected] = useState<Selected | null>(null);
  const [overlayRoute, setOverlayRoute] = useState<OverlayRoute>(null);
  // The puzzle to open once the calming interstitial finishes - non-null
  // is exactly "the interstitial is showing right now" (see `screen`/
  // `routeKey` below, and `finishInterstitial`).
  const [pendingNext, setPendingNext] = useState<Selected | null>(null);

  const exit = useCallback(() => setSelected(null), []);
  // Shared by every game's completion screen as "next puzzle": advancing
  // always means going straight to the current level batch's next puzzle,
  // whatever game it belongs to, *unless* this solve just completed the
  // batch and the calming interstitial is enabled - then it opens the
  // interstitial first, stashing the real target in `pendingNext` for
  // `finishInterstitial` to open once the player skips or it finishes.
  // Also closes Settings, in case this came from there.
  const openPuzzle = useCallback(
    (kind: GameKind, puzzleId: string, options?: NextPuzzleOptions) => {
      setOverlayRoute(null);
      if (options?.showInterstitial && settings.calmingInterstitialEnabled) {
        setPendingNext({ kind, puzzleId });
      } else {
        setSelected({ kind, puzzleId });
      }
    },
    [settings.calmingInterstitialEnabled],
  );

  const finishInterstitial = useCallback(() => {
    setSelected(pendingNext);
    setPendingNext(null);
  }, [pendingNext]);

  const homeScreen = (
    <HomeScreen
      onOpen={setSelected}
      onOpenSettings={() => setOverlayRoute('settings')}
      onOpenAchievements={() => setOverlayRoute('achievements')}
    />
  );

  let screen: React.JSX.Element;
  let routeKey: string;
  if (pendingNext) {
    screen = <CalmingInterstitialScreen onDone={finishInterstitial} />;
    routeKey = 'interstitial';
  } else if (!selected && overlayRoute === 'settings') {
    screen = <SettingsScreen onExit={() => setOverlayRoute(null)} />;
    routeKey = 'settings';
  } else if (!selected && overlayRoute === 'achievements') {
    screen = <AchievementsScreen onExit={() => setOverlayRoute(null)} />;
    routeKey = 'achievements';
  } else if (!selected) {
    screen = homeScreen;
    routeKey = 'home';
  } else {
    // Exhaustive over `GameKind` and deliberately has no `default`: forgetting
    // a case here is a compile error, not a silent bounce to Home the way an
    // unmatched if/else-if chain would be.
    switch (selected.kind) {
      case 'mirror': {
        const puzzle = getMirrorMazeById(selected.puzzleId);
        screen = puzzle ? (
          <MirrorMazeScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `mirror:${puzzle.id}` : 'home';
        break;
      }
      case 'tents': {
        const puzzle = getTentsTreesById(selected.puzzleId);
        screen = puzzle ? (
          <TentsScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `tents:${puzzle.id}` : 'home';
        break;
      }
      case 'towers': {
        const puzzle = getTowersById(selected.puzzleId);
        screen = puzzle ? (
          <TowersScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `towers:${puzzle.id}` : 'home';
        break;
      }
      case 'binairo': {
        const puzzle = getBinairoById(selected.puzzleId);
        screen = puzzle ? (
          <BinairoScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `binairo:${puzzle.id}` : 'home';
        break;
      }
      case 'arukone': {
        const puzzle = getArukoneById(selected.puzzleId);
        screen = puzzle ? (
          <ArukoneScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `arukone:${puzzle.id}` : 'home';
        break;
      }
      case 'fillapix': {
        const puzzle = getFillaPixById(selected.puzzleId);
        screen = puzzle ? (
          <FillaPixScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `fillapix:${puzzle.id}` : 'home';
        break;
      }
      case 'lightsout': {
        const puzzle = getLightsOutById(selected.puzzleId);
        screen = puzzle ? (
          <LightsOutScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `lightsout:${puzzle.id}` : 'home';
        break;
      }
      case 'adjacent': {
        const puzzle = getAdjacentById(selected.puzzleId);
        screen = puzzle ? (
          <AdjacentScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `adjacent:${puzzle.id}` : 'home';
        break;
      }
      case 'bloom': {
        const puzzle = getBloomById(selected.puzzleId);
        screen = puzzle ? (
          <BloomScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = puzzle ? `bloom:${puzzle.id}` : 'home';
        break;
      }
      case 'gravity': {
        const level = getLevelById(selected.puzzleId);
        screen = level ? (
          <GameScreen key={level.id} level={level} onExit={exit} onNextPuzzle={openPuzzle} />
        ) : (
          homeScreen
        );
        routeKey = level ? `gravity:${level.id}` : 'home';
        break;
      }
    }
  }

  // Home is the root of this app, so "deeper" simply means "not Home".
  // Arriving at Home is therefore always a step back, and everything else
  // a step forward - which is exactly how the two read to a player, and
  // needs no navigation stack to work out.
  const direction = routeKey === 'home' ? 'back' : 'forward';

  return (
    <View style={styles.root}>
      <ScreenTransition routeKey={routeKey} direction={direction}>
        {screen}
      </ScreenTransition>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});

export default App;
