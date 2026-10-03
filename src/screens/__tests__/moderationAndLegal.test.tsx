import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PlayerProgressProvider } from '../../progression';
import { createMemoryBackend } from '../../storage';
import { privacyPolicy, termsOfUse } from '../../legal/documents';

/**
 * The leaderboard's Report and Hide, and the legal documents - driven
 * through their real buttons (simctl cannot tap). The backend is a
 * stand-in: one board of two players, and a record of what was reported.
 */
const reported: string[] = [];
const hiddenSaved: string[][] = [];
jest.mock('../../backend', () => {
  const actual = jest.requireActual('../../backend');
  return {
    ...actual,
    backendConfigured: () => true,
    getProfile: async () => ({ displayName: 'Ana', country: 'RO', city: null }),
    fetchBoard: async () => [
      { place: 1, player: 'p-mean', name: 'Mean Name', country: 'RO', city: 'Cluj', score: 30000, isMe: false },
      { place: 2, player: 'p-me', name: 'Ana', country: 'RO', city: null, score: 40000, isMe: true },
    ],
    reportPlayer: async (player: string) => {
      reported.push(player);
      return true;
    },
    hiddenPlayers: async () => new Set<string>(),
    setPlayerHidden: async (player: string, hidden: boolean) => {
      const next = hidden ? [player] : [];
      hiddenSaved.push(next);
      return new Set(next);
    },
  };
});

import { LeaderboardScreen } from '../LeaderboardScreen';
import { LegalScreen } from '../LegalScreen';

async function mount(ui: React.ReactElement) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
        <PlayerProgressProvider backend={createMemoryBackend()}>{ui}</PlayerProgressProvider>
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
  const texts = () => renderer.root.findAll(node => typeof node.props.children === 'string').map(node => node.props.children as string);
  const labels = () => renderer.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel as string);
  return { renderer, press, texts, labels };
}

describe('leaderboard moderation', () => {
  test('another player can be reported once, and hidden; you cannot report yourself', async () => {
    const { renderer, press, texts, labels } = await mount(<LeaderboardScreen onExit={() => {}} onPlayDaily={() => {}} />);
    expect(labels()).toContain('Report or hide Mean Name');
    expect(labels()).not.toContain('Report or hide Ana');

    await press('Report or hide Mean Name');
    await press('Report this name');
    expect(reported).toEqual(['p-mean']);
    expect(texts().join(' ')).toContain('A name reported by several players is hidden');

    await press('Report or hide Mean Name');
    expect(texts()).toContain('Reported');
    await press('Hide this player');
    expect(hiddenSaved).toEqual([['p-mean']]);
    const row = labels().find(l => l.startsWith('place 1,'))!;
    expect(row).toContain('Hidden player');
    expect(row).not.toContain('Mean Name');
    expect(row).not.toContain('Cluj');
    await act(async () => renderer.unmount());
  });
});

describe('legal documents', () => {
  test('the privacy policy, terms and licences all open', async () => {
    for (const doc of ['privacy', 'terms', 'licenses'] as const) {
      const { renderer, texts, labels } = await mount(<LegalScreen doc={doc} onClose={() => {}} />);
      const all = texts().join(' ');
      if (doc === 'privacy') expect(all).toContain('Delete my account and data');
      if (doc === 'terms') expect(all).toContain('cannot be exchanged for money');
      if (doc === 'licenses') expect(labels().some(l => l.endsWith('MIT licence'))).toBe(true);
      await act(async () => renderer.unmount());
    }
  });

  test('are written without em dashes', () => {
    const all = JSON.stringify([privacyPolicy(), termsOfUse()]);
    expect(all).not.toMatch(/—| - /);
  });
});
