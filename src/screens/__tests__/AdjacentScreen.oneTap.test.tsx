import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdjacentScreen } from '../AdjacentScreen';
import { PlayerProgressProvider } from '../../progression';
import { SettingsProvider, defaultSettings } from '../../settings';
import { SETTINGS_KEY } from '../../settings/settingsStore';
import { createMemoryBackend } from '../../storage';
import { AdjacentPuzzle, cascadeScore } from '../../game/adjacent';

/**
 * Regression test for a bug caught by playing the real screen on a
 * simulator: **one press cleared two runs.** The board lost six tiles to
 * a three-tile run and the score jumped by 400 instead of 200.
 *
 * The cause was the tap being applied from inside a `setState` updater
 * that also pushed history, queued the fall animation, spawned a score
 * pop-up and fired haptics. A state updater must be pure and React is
 * free to invoke it more than once; every one of those effects therefore
 * ran twice, and the second application landed on the already-updated
 * board. The fix computes the move outside the updater (reading the live
 * board through a ref, since the tap resolves after the preview delay)
 * and calls the setters plainly.
 *
 * The test presses one cell and asserts the score is *exactly* one run's
 * worth - the single observable that separates "applied once" from
 * "applied twice", and one that no amount of animation tuning can
 * accidentally satisfy.
 */

/** A settled 4x4 with one obvious three-tile run of colour 1:
 * (2,1), (3,1) and (3,2). The target is set far out of reach so the
 * screen never reaches its solved state and never records a completion. */
const PUZZLE: AdjacentPuzzle = {
  id: 'adjacent-test-one-tap',
  name: 'Fixture',
  difficulty: 'easy',
  size: 4,
  colors: 4,
  initial: [
    [null, null, null, null],
    [null, null, null, null],
    [null, 1, null, null],
    [3, 1, 1, 2],
  ],
  targetScore: 10_000,
};

function findByLabelPrefix(root: ReactTestRenderer.ReactTestInstance, prefix: string) {
  return root.findAll(
    node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith(prefix),
    { deep: true },
  );
}

/** Every string rendered anywhere in the tree, flattened - the kicker's
 * score line is read out of this rather than by reaching for a specific
 * node, so the test does not break the next time the header is laid out
 * differently. */
function allText(root: ReactTestRenderer.ReactTestInstance): string {
  return root
    .findAll(node => typeof node.type === 'string', { deep: true })
    .flatMap(node => node.children.filter((child): child is string => typeof child === 'string'))
    .join(' | ');
}

describe('AdjacentScreen - one press applies exactly one clear', () => {
  test('a three-tile run scores one cascade, not two', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <SafeAreaProvider
          initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
        >
          {/* A player past the first-time lesson, which takes the whole screen. */}
          <SettingsProvider backend={createMemoryBackend({ [SETTINGS_KEY]: JSON.stringify({ ...defaultSettings(), seenTutorials: ['game:adjacent'] }) })}>
            <PlayerProgressProvider>
              <AdjacentScreen puzzle={PUZZLE} onExit={() => {}} onNextPuzzle={() => {}} />
            </PlayerProgressProvider>
          </SettingsProvider>
        </SafeAreaProvider>,
      );
    });

    const root = renderer.root;
    expect(allText(root)).toContain('ADJACENT · 0 / 10000');

    // Row 4, column 2 in one-based screen terms is grid (3, 1) - the
    // bottom of the run.
    const [cell] = findByLabelPrefix(root, 'Row 4, column 2,');
    expect(cell.props.accessibilityLabel).toContain('run of 3');

    // Finger down highlights the run and scores nothing - the preview is
    // tied to the press rather than to a timer, so this is the whole of
    // the delay between touching a run and seeing it marked.
    await act(async () => {
      cell.props.onPressIn();
    });
    expect(allText(root)).toContain('ADJACENT · 0 / 10000');

    // Finger up clears it, immediately - and once.
    await act(async () => {
      cell.props.onPress();
    });

    expect(cascadeScore(3)).toBe(200);
    expect(allText(root)).toContain(`ADJACENT · ${cascadeScore(3)} / 10000`);
    expect(allText(root)).not.toContain(`ADJACENT · ${cascadeScore(3) * 2} / 10000`);

    await act(async () => {
      renderer.unmount();
    });
  });
});
