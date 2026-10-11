import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GlassScreen } from '../GlassScreen';
import { PlayerProgressProvider, emptyProgress } from '../../progression';
import { PLAYER_PROGRESS_KEY } from '../../progression/playerProgressStore';
import { createMemoryBackend } from '../../storage';
import { SettingsProvider, defaultSettings } from '../../settings';
import { SETTINGS_KEY } from '../../settings/settingsStore';
import { GLASS_TEST_WINDOWS } from '../../game/glass';
import { GLASS_PAD } from '../../components/GlassBoard';

/** Stained Glass, driven through its board: one stroke colours every pane
 * the finger crosses, and one undo takes the whole stroke back. */
async function mount() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
        <SettingsProvider backend={createMemoryBackend({ [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), seenTutorials: ['game:glass'] }) })}>
          <PlayerProgressProvider backend={createMemoryBackend({ [PLAYER_PROGRESS_KEY]: JSON.stringify(emptyProgress()) })}>
            <GlassScreen puzzle={GLASS_TEST_WINDOWS[0]} onExit={() => {}} onNextPuzzle={() => {}} />
          </PlayerProgressProvider>
        </SettingsProvider>
      </SafeAreaProvider>,
    );
  });
  return renderer;
}

const text = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.findAll(n => typeof n.props.children === 'string').map(n => n.props.children as string).join(' | ');

test('a stroke across clear panes colours each of them, and undo takes the stroke back', async () => {
  jest.useFakeTimers();
  const r = await mount();
  const w = GLASS_TEST_WINDOWS[0];
  const clear = w.given.map((g, i) => (g === null ? i : -1)).filter(i => i >= 0);
  const before = clear.length;
  expect(text(r)).toContain(`${before} left`);
  const board = r.root.find(n => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Window of') && n.props.onResponderGrant);
  // Board geometry: find a cell of two different clear panes.
  const cellsOf = (pane: number) => w.paneOf.flatMap((row, r0) => row.map((p, c0) => (p === pane ? [r0, c0] : null)).filter(Boolean)) as number[][];
  const size = board.props.style.width as number;
  const inset = (size / (w.cols + GLASS_PAD * 2)) * GLASS_PAD;
  const cell = (size - inset * 2) / w.cols;
  const at = ([r0, c0]: number[]) => ({ nativeEvent: { locationX: inset + c0 * cell + cell / 2, locationY: inset + r0 * cell + cell / 2 } });
  await act(async () => {
    board.props.onResponderGrant(at(cellsOf(clear[0])[0]));
    board.props.onResponderMove(at(cellsOf(clear[1])[0]));
    board.props.onResponderRelease();
  });
  expect(text(r)).toMatch(new RegExp(`(· ${before - 2} left|clash)`));
  const undo = r.root.find(n => n.props.accessibilityLabel === 'Undo' && typeof n.props.onPress === 'function');
  await act(async () => undo.props.onPress());
  expect(text(r)).toContain(`${before} left`);
  await act(async () => r.unmount());
  jest.useRealTimers();
});
