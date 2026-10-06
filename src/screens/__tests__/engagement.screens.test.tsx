import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrandList } from '../../components/ErrandList';
import { JourneyScreen } from '../JourneyScreen';
import { ShopScreen } from '../ShopScreen';
import { LedgerScreen } from '../LedgerScreen';
import { IntroWalkthrough } from '../../components/IntroWalkthrough';
import { PlayerProgressProvider, emptyProgress, errandsFor, usePlayerProgress } from '../../progression';
import { PLAYER_PROGRESS_KEY } from '../../progression/playerProgressStore';
import { createMemoryBackend } from '../../storage';
import { dailyKeyOf, ROTATION } from '../../game/journey';
import { endlessId } from '../../game/endlessId';

/**
 * The shop, the almanac and the errands, driven through their real
 * buttons inside a real progress provider - simctl cannot tap, so this is
 * how the flows are proved.
 */

type Api = ReturnType<typeof usePlayerProgress>;

async function mount(ui: React.ReactElement, save: object) {
  let api!: Api;
  function Probe(): null {
    api = usePlayerProgress();
    return null;
  }
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
        <PlayerProgressProvider backend={createMemoryBackend({ [PLAYER_PROGRESS_KEY]: JSON.stringify({ ...emptyProgress(), ...save }) })}>
          <Probe />
          {ui}
        </PlayerProgressProvider>
      </SafeAreaProvider>,
    );
  });
  const press = async (label: string) => {
    const [button] = renderer.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function');
    if (!button) throw new Error(`no button "${label}"`);
    await act(async () => {
      button.props.onPress();
    });
  };
  return { renderer, api: () => api, press };
}

describe('the shop', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('a purchase takes two taps - the price, then the confirm - and is worn at once', async () => {
    const { api, press, renderer } = await mount(<ShopScreen onExit={() => {}} />, { coins: 500 });
    await press('Style');
    await press('Buy Gold Leaf for 250 coins');
    expect(api().coins).toBe(500);
    await press('Confirm buying Gold Leaf for 250 coins');
    expect(api().coins).toBe(250);
    expect(api().progress.equipped.confetti).toBe('confetti-gold');
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Gold Leaf, worn').length).toBeGreaterThan(0);
    await act(async () => renderer.unmount());
  });

  test('too few coins: no confirm, no charge', async () => {
    const { api, press, renderer } = await mount(<ShopScreen onExit={() => {}} />, { coins: 20 });
    await press('Style');
    await press('Buy Gold Leaf for 250 coins');
    await press('Buy Gold Leaf for 250 coins');
    expect(api().coins).toBe(20);
    expect(api().progress.owned).toEqual([]);
    await act(async () => renderer.unmount());
  });

  test('a streak freeze is bought in one tap, up to three', async () => {
    const { api, press, renderer } = await mount(<ShopScreen onExit={() => {}} />, { coins: 1000 });
    await press('Boosts');
    for (let i = 0; i < 3; i += 1) await press('Buy a streak freeze for 150 coins');
    expect(api().progress.streakFreezes).toBe(3);
    expect(api().coins).toBe(1000 - 450);
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Streak freezes full').length).toBeGreaterThan(0);
    await act(async () => renderer.unmount());
  });
});

describe('the almanac', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("a finished chapter's reward is claimed once, with its cosmetic", async () => {
    const { api, press, renderer } = await mount(<JourneyScreen onExit={() => {}} onOpenShop={() => {}} />, { coins: 0, currentLevel: 13 });
    await press('Claim chapter 1 reward');
    expect(api().coins).toBe(80);
    expect(api().progress.owned).toContain('confetti-gold');
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Claim chapter 1 reward')).toHaveLength(0);
    await act(async () => renderer.unmount());
  });
});

describe('errands', () => {
  test('a finished errand is claimed from its row, once', async () => {
    const dayKey = dailyKeyOf(new Date());
    const errands = errandsFor(dayKey);
    const progress = errands.map(e => e.target);
    const { api, press, renderer } = await mount(<ErrandList />, { coins: 0, errands: { dayKey, progress, claimed: [false, false, false] } });
    await press(`Claim ${errands[0].coins} coins`);
    expect(api().coins).toBe(errands[0].coins);
    expect(api().progress.errandsClaimed).toBe(1);
    await act(async () => renderer.unmount());
  });
});

describe('passes', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('retire a game from the shop: pick it, confirm the price; bring it back free', async () => {
    const { api, press, renderer } = await mount(<ShopScreen onExit={() => {}} />, { coins: 1000 });
    await press('Boosts');
    await press('Retire Mosaic');
    await press('Confirm retiring Mosaic for 600 coins');
    expect(api().progress.retired).toEqual(['mosaic']);
    expect(api().coins).toBe(400);
    expect(api().progress.currentBatch?.puzzles.some(p => p.kind === 'mosaic') ?? false).toBe(false);
    await press('Mosaic, retired. Bring it back');
    expect(api().progress.retired).toEqual([]);
    expect(api().coins).toBe(400);
    await act(async () => renderer.unmount());
  });

  test('a lucky charm doubles the coins of the next paying solves', async () => {
    const { api, press, renderer } = await mount(<ShopScreen onExit={() => {}} />, { coins: 1000 });
    await press('Boosts');
    await press('Buy a lucky charm for 250 coins');
    expect(api().progress.luckyCharges).toBe(10);
    let outcome!: ReturnType<Api['recordCompletion']>;
    await act(async () => {
      outcome = api().recordCompletion('bridges-easy-01', 0);
    });
    expect(outcome.charmed).toBe(true);
    expect(outcome.coinsEarned % 2).toBe(0);
    expect(api().progress.luckyCharges).toBe(9);
    expect(api().lastCharmed).toBe(true);
    await act(async () => renderer.unmount());
  });

  test('swapping the current puzzle charges and replaces it', async () => {
    // A player every game has reached, so there is another game to swap to.
    const levels = Object.fromEntries(ROTATION.map(kind => [endlessId(kind, 'medium', 900), { completed: true, bestMoves: 1, stars: 3 }]));
    const { api, renderer } = await mount(<ErrandList />, { coins: 500, levels });
    const before = api().progress.currentBatch!;
    let swapped: ReturnType<Api['swapPuzzle']> = null;
    await act(async () => {
      swapped = api().swapPuzzle();
    });
    expect(swapped).not.toBeNull();
    expect(api().coins).toBe(400);
    expect(api().progress.currentBatch!.puzzles[0].puzzleId).not.toBe(before.puzzles[0].puzzleId);
    await act(async () => renderer.unmount());
  });
});

describe('the ledger', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('an earned stamp is claimed with a tap on it, and pays', async () => {
    const levels = Object.fromEntries(Array.from({ length: 11 }, (_v, i) => [`tents-e-easy-${i}`, { completed: true, stars: 3, bestMoves: 1 }]));
    const { api, press, renderer } = await mount(<LedgerScreen onExit={() => {}} onOpenShop={() => {}} />, { levels, coins: 0 });
    expect(renderer.root.findAll(node => node.props.children === '1 TO CLAIM').length).toBeGreaterThan(0);
    await press('10 solves stamp: earned, tap to claim');
    expect(api().coins).toBe(25);
    expect(api().progress.stampsClaimed).toEqual(['tents:10']);
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === '10 solves stamp: collected').length).toBeGreaterThan(0);
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === '10 solves stamp: earned, tap to claim')).toHaveLength(0);
    await act(async () => renderer.unmount());
  });
});

describe('the Grand exclusives in the shop', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('are shown, not sold - and can be worn once won', async () => {
    const { api, renderer, press } = await mount(<ShopScreen onExit={() => {}} />, { coins: 5000 });
    await press('Style');
    const locked = renderer.root.findAll(node => node.props.accessibilityLabel === 'Laurel, won in the Weekly Grand, not sold');
    expect(locked.length).toBeGreaterThan(0);
    expect(api().coins).toBe(5000);
    await act(async () => renderer.unmount());

    const won = await mount(<ShopScreen onExit={() => {}} />, { coins: 5000, owned: ['confetti-laurel'] });
    await won.press('Style');
    await won.press('Wear Laurel');
    expect(won.api().progress.equipped.confetti).toBe('confetti-laurel');
    await act(async () => won.renderer.unmount());
  });
});

describe('the first-launch walkthrough', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('pages through to the end and reports done', async () => {
    const done = jest.fn();
    const { press, renderer } = await mount(<IntroWalkthrough onDone={done} />, {});
    for (let i = 0; i < 3; i += 1) await press('Next page');
    await press('Close the introduction');
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(done).toHaveBeenCalledTimes(1);
    await act(async () => renderer.unmount());
  });
});

describe('no purchases in this release', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('the shop sells nothing for real money: no Coins tab, no Patron, no "+" on the purse', async () => {
    const { press, renderer } = await mount(<ShopScreen onExit={() => {}} />, { coins: 500 });
    const labels = () => renderer.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel as string);
    for (const tab of ['Featured', 'Games', 'Style', 'Boosts']) {
      await press(tab);
      expect(labels()).not.toContain('Coins');
      expect(labels().some(l => /Patron|Get more coins|\$\d/.test(l))).toBe(false);
    }
    await act(async () => renderer.unmount());
  });
});
