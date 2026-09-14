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
  BinairoScreen,
  BrowseScreen,
  GameScreen,
  HomeScreen,
  MirrorMazeScreen,
  SettingsScreen,
  TentsScreen,
  TowersScreen,
} from './src/screens';
import { ScreenTransition } from './src/components';
import { getLevelById } from './src/game/levels';
import { getMirrorMazeById } from './src/game/mirror';
import { getTentsTreesById } from './src/game/tents';
import { getTowersById } from './src/game/towers';
import { getBinairoById } from './src/game/binairo';
import { GameKind } from './src/game/journey';
import { PlayerProgressProvider } from './src/progression';
import { SettingsProvider } from './src/settings';
import { theme } from './src/theme';

interface Selected {
  kind: GameKind;
  puzzleId: string;
}

/** Settings, Browse and Achievements are reachable only from Home, and
 * opening a puzzle from any of them closes it - so one flag alongside
 * `selected` is enough; they can never be meaningfully "open" at the same
 * time as a puzzle. */
type OverlayRoute = 'settings' | 'browse' | 'achievements' | null;

/**
 * App wires up the global providers and switches between the hub (`Home`)
 * and whichever game the current Journey entry belongs to. There is no
 * level select. A real navigator can replace this state switch later.
 */
function App(): React.JSX.Element {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [overlayRoute, setOverlayRoute] = useState<OverlayRoute>(null);

  const exit = useCallback(() => setSelected(null), []);
  // Shared by every game's completion screen (as "next puzzle") and by
  // Browse (as "open this specific puzzle"): advancing/opening always means
  // going straight to a Journey entry, whatever game it belongs to - this is
  // what keeps finishing a puzzle rotating through the whole Journey instead
  // of each game only ever advancing within itself. Also closes Browse/
  // Settings, in case this came from there.
  const openPuzzle = useCallback((kind: GameKind, puzzleId: string) => {
    setOverlayRoute(null);
    setSelected({ kind, puzzleId });
  }, []);

  const homeScreen = (
    <HomeScreen
      onOpen={setSelected}
      onOpenSettings={() => setOverlayRoute('settings')}
      onOpenBrowse={() => setOverlayRoute('browse')}
      onOpenAchievements={() => setOverlayRoute('achievements')}
    />
  );

  let screen: React.JSX.Element;
  let routeKey: string;
  if (!selected && overlayRoute === 'settings') {
    screen = <SettingsScreen onExit={() => setOverlayRoute(null)} />;
    routeKey = 'settings';
  } else if (!selected && overlayRoute === 'browse') {
    screen = <BrowseScreen onOpen={openPuzzle} onExit={() => setOverlayRoute(null)} />;
    routeKey = 'browse';
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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SettingsProvider>
        <PlayerProgressProvider>
          <View style={styles.root}>
            <ScreenTransition routeKey={routeKey}>{screen}</ScreenTransition>
          </View>
        </PlayerProgressProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});

export default App;
