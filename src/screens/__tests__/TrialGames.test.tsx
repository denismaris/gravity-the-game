import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LilyPadsTrialScreen as LilyPadsScreen } from '../LilyPadsScreen';
import { VanesTrialScreen as VanesScreen } from '../VanesScreen';
import { PlayerProgressProvider, emptyProgress } from '../../progression';
import { PLAYER_PROGRESS_KEY } from '../../progression/playerProgressStore';
import { createMemoryBackend } from '../../storage';
import { SettingsProvider, defaultSettings } from '../../settings';
import { SETTINGS_KEY } from '../../settings/settingsStore';
import { getLilyTrial, hop, hopsFrom, initialLilyState } from '../../game/lilypads';
import { HOP_MS } from '../../components/LilyPadsBoard';
import { getVaneTrial } from '../../game/vanes';
import { forgetAllBoards } from '../../progression/boardSaves';

// Each test opens its board fresh: a board left half played by the last
// one would otherwise reopen as it was left, as it does in the app.
beforeEach(() => forgetAllBoards());

/** The two games on trial, driven through their boards. */
async function mount(screen: React.ReactElement) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
        <SettingsProvider backend={createMemoryBackend({ [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), seenTutorials: ['game:lilypads', 'game:vanes'] }) })}>
          <PlayerProgressProvider backend={createMemoryBackend({ [PLAYER_PROGRESS_KEY]: JSON.stringify(emptyProgress()) })}>{screen}</PlayerProgressProvider>
        </SettingsProvider>
      </SafeAreaProvider>,
    );
  });
  return renderer;
}
const text = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.findAll(n => typeof n.props.children === 'string').map(n => n.props.children as string).join(' | ');
const at = (size: number, cells: number, row: number, col: number) => {
  const inset = (size / (cells + 0.64)) * 0.32;
  const cell = (size - inset * 2) / cells;
  return { nativeEvent: { locationX: inset + col * cell + cell / 2, locationY: inset + row * cell + cell / 2 } };
};

// Two quick taps: the second waits for the frog to land, then hops - it
// is never dropped, and never starts while the frog is in the air.
test('Lily Pads: a tap made mid-hop waits for the landing, then hops', async () => {
  jest.useFakeTimers();
  const r = await mount(<LilyPadsScreen onExit={() => {}} />);
  const p = getLilyTrial(0);
  const total = p.pads.length - 1;
  const board = r.root.find(n => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Pond') && n.props.onResponderRelease);
  const size = board.props.style.width as number;
  const first = hopsFrom(p, initialLilyState(p))[0];
  const afterFirst = hop(p, initialLilyState(p), first);
  const second = hopsFrom(p, afterFirst)[0];
  const tap = async (pad: number) =>
    act(async () => {
      board.props.onResponderGrant(at(size, p.size, p.pads[pad].row, p.pads[pad].col));
      board.props.onResponderRelease(at(size, p.size, p.pads[pad].row, p.pads[pad].col));
    });
  await tap(first);
  await tap(second);
  expect(text(r)).toContain(`${total - 1} ${total - 1 === 1 ? 'pad' : 'pads'} to go`);
  await act(async () => {
    jest.advanceTimersByTime(HOP_MS + 20);
  });
  expect(text(r)).toContain(`${total - 2} ${total - 2 === 1 ? 'pad' : 'pads'} to go`);
  await act(async () => r.unmount());
  jest.useRealTimers();
});

test('Lily Pads: tapping a pad in reach hops there, and undo brings the pad back', async () => {
  jest.useFakeTimers();
  const r = await mount(<LilyPadsScreen onExit={() => {}} />);
  const p = getLilyTrial(0);
  const total = p.pads.length - 1;
  expect(text(r)).toContain(`${total} pads to go`);
  const board = r.root.find(n => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Pond') && n.props.onResponderRelease);
  const size = board.props.style.width as number;
  const target = p.pads[hopsFrom(p, initialLilyState(p))[0]];
  await act(async () => {
    board.props.onResponderGrant(at(size, p.size, target.row, target.col));
    board.props.onResponderRelease(at(size, p.size, target.row, target.col));
  });
  expect(text(r)).toContain(`${total - 1} ${total - 1 === 1 ? 'pad' : 'pads'} to go`);
  const undo = r.root.find(n => n.props.accessibilityLabel === 'Undo' && typeof n.props.onPress === 'function');
  await act(async () => undo.props.onPress());
  expect(text(r)).toContain(`${total} pads to go`);
  await act(async () => r.unmount());
  jest.useRealTimers();
});

test('Weathervanes: tapping a vane turns it, and the kicker follows the wind', async () => {
  jest.useFakeTimers();
  const r = await mount(<VanesScreen onExit={() => {}} />);
  const p = getVaneTrial(0);
  const board = r.root.find(n => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Roof') && n.props.onResponderRelease);
  const size = board.props.style.width as number;
  const before = text(r);
  const free = p.fixed.findIndex(f => f === null);
  for (let k = 0; k < 4; k += 1) {
    await act(async () => board.props.onResponderRelease(at(size, p.size, p.vanes[free].row, p.vanes[free].col)));
  }
  // Four quarter turns bring it back where it was.
  expect(text(r)).toBe(before);
  await act(async () => r.unmount());
  jest.useRealTimers();
});
