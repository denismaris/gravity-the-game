/**
 * Gravity
 * Root application shell.
 *
 * @format
 */

import React, { useCallback, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConstellationScreen, GameScreen, HomeScreen, TrajectoryScreen } from './src/screens';
import { getLevelById } from './src/game/levels';
import { getConstellationById } from './src/game/constellation';
import { getTrajectoryById } from './src/game/trajectory';
import { GameKind } from './src/game/journey';
import { PlayerProgressProvider } from './src/progression';
import { theme } from './src/theme';

interface Selected {
  kind: GameKind;
  puzzleId: string;
}

/**
 * App wires up the global providers and switches between the hub (`Home`)
 * and whichever game the current Journey entry belongs to. There is no
 * level select. A real navigator can replace this state switch later.
 */
function App(): React.JSX.Element {
  const [selected, setSelected] = useState<Selected | null>(null);

  const exit = useCallback(() => setSelected(null), []);
  // Shared by all three games' completion screens: advancing to "the next
  // puzzle" always means the next entry in the interleaved Journey, whatever
  // game it belongs to - this is what keeps finishing a puzzle rotating
  // through Gravity/Constellation/Trajectory instead of each game only ever
  // advancing within itself.
  const openPuzzle = useCallback(
    (kind: GameKind, puzzleId: string) => setSelected({ kind, puzzleId }),
    [],
  );

  let screen: React.JSX.Element;
  if (!selected) {
    screen = <HomeScreen onOpen={setSelected} />;
  } else if (selected.kind === 'constellation') {
    const puzzle = getConstellationById(selected.puzzleId);
    screen = puzzle ? (
      <ConstellationScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
    ) : (
      <HomeScreen onOpen={setSelected} />
    );
  } else if (selected.kind === 'trajectory') {
    const puzzle = getTrajectoryById(selected.puzzleId);
    screen = puzzle ? (
      <TrajectoryScreen key={puzzle.id} puzzle={puzzle} onExit={exit} onNextPuzzle={openPuzzle} />
    ) : (
      <HomeScreen onOpen={setSelected} />
    );
  } else {
    const level = getLevelById(selected.puzzleId);
    screen = level ? (
      <GameScreen key={level.id} level={level} onExit={exit} onNextPuzzle={openPuzzle} />
    ) : (
      <HomeScreen onOpen={setSelected} />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <PlayerProgressProvider>
        <View style={styles.root}>{screen}</View>
      </PlayerProgressProvider>
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
