/**
 * Gravity
 * Root application shell.
 *
 * @format
 */

import React, { useCallback, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameScreen, LevelSelectScreen } from './src/screens';
import { LevelDefinition } from './src/game/levels';
import { PlayerProgressProvider } from './src/progression';
import { theme } from './src/theme';

/**
 * App is intentionally minimal: it only wires up global providers
 * (safe area, status bar) and switches between the level select screen
 * and the game screen. Once real navigation is introduced
 * (src/navigation), this simple state switch will be replaced by a
 * navigator - for now it's the "simple level selection/debug system" used
 * to jump between the 20 hand-authored levels while testing.
 */
function App(): React.JSX.Element {
  const [selectedLevel, setSelectedLevel] = useState<LevelDefinition | null>(null);

  const handleExit = useCallback(() => setSelectedLevel(null), []);
  const handleNextLevel = useCallback((next: LevelDefinition) => setSelectedLevel(next), []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <PlayerProgressProvider>
        <View style={styles.root}>
          {selectedLevel ? (
            // `key={selectedLevel.id}` forces a full remount whenever the
            // level changes - including when jumping straight from one
            // level's "Next Level" button to the next, not just when
            // returning to Level Select first. Without this, GameScreen's
            // internal session/animation state (useReducer/useState) would
            // be reused across levels since the element type/position in
            // the tree never changes, leaving the new level briefly showing
            // the previous level's (already-solved) board.
            <GameScreen
              key={selectedLevel.id}
              level={selectedLevel}
              onExit={handleExit}
              onNextLevel={handleNextLevel}
            />
          ) : (
            <LevelSelectScreen onSelectLevel={setSelectedLevel} />
          )}
        </View>
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
