import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PlayerProgressProvider, emptyProgress, usePlayerProgress } from '../../progression';
import { PLAYER_PROGRESS_KEY } from '../../progression/playerProgressStore';
import { HINT_COST, STARTING_INSIGHTS } from '../../progression/coins';
import { createMemoryBackend } from '../../storage';
import { useInsightPower } from '../InsightPower';

/** Insight, driven through its own hook and panel: a charge first, then -
 * with none left - the panel, where coins buy this one. */
async function mount(save: object) {
  let api!: ReturnType<typeof usePlayerProgress>;
  let power!: ReturnType<typeof useInsightPower>;
  let applied = 0;
  function Harness(): React.JSX.Element | null {
    api = usePlayerProgress();
    power = useInsightPower();
    return power.sheet;
  }
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
        <PlayerProgressProvider backend={createMemoryBackend({ [PLAYER_PROGRESS_KEY]: JSON.stringify({ ...emptyProgress(), ...save }) })}>
          <Harness />
        </PlayerProgressProvider>
      </SafeAreaProvider>,
    );
  });
  const use = async () => {
    await act(async () => power.spend(() => (applied += 1)));
  };
  const press = async (label: string) => {
    const [button] = renderer.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function');
    if (!button) throw new Error(`no button "${label}"`);
    await act(async () => button.props.onPress());
  };
  return { api: () => api, power: () => power, applied: () => applied, use, press, renderer };
}

describe('Insight, the superpower', () => {
  test('a new player starts with a few charges', () => {
    expect(emptyProgress().insights).toBe(STARTING_INSIGHTS);
  });

  test('uses a charge when there is one - no panel, no coins', async () => {
    const h = await mount({ insights: 2, coins: 100 });
    await h.use();
    expect(h.applied()).toBe(1);
    expect(h.api().progress.insights).toBe(1);
    expect(h.api().coins).toBe(100);
    expect(h.power().sheet.props.visible).toBe(false);
    await act(async () => h.renderer.unmount());
  });

  test('with none left, the panel opens; coins buy this one', async () => {
    const h = await mount({ insights: 0, coins: 100 });
    await h.use();
    expect(h.applied()).toBe(0);
    expect(h.power().sheet.props.visible).toBe(true);
    await h.press(`Use ${HINT_COST} coins for one Insight`);
    expect(h.applied()).toBe(1);
    expect(h.api().coins).toBe(100 - HINT_COST);
    expect(h.power().sheet.props.visible).toBe(false);
    await act(async () => h.renderer.unmount());
  });

  test('"Not now" closes the panel and changes nothing', async () => {
    const h = await mount({ insights: 0, coins: 100 });
    await h.use();
    await h.press('Not now');
    expect(h.applied()).toBe(0);
    expect(h.api().coins).toBe(100);
    expect(h.power().sheet.props.visible).toBe(false);
    await act(async () => h.renderer.unmount());
  });
});
