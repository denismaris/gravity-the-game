import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PlayerProgressProvider, PracticeProvider, emptyProgress, practiceBoards, useLastBonus, usePlayerProgress } from '..';
import { PLAYER_PROGRESS_KEY } from '../playerProgressStore';
import { createMemoryBackend } from '../../storage';
import { ROTATION } from '../../game/journey';
import { buildPuzzle } from '../../game/journey/prepare';

/** Settings' "Try a game": a run of starter boards per game, played inside
 * a practice board that saves nothing. */
describe('practice boards', () => {
  test('every game has six distinct boards that open', () => {
    for (const kind of ROTATION) {
      const boards = practiceBoards(kind);
      expect(boards).toHaveLength(6);
      expect(new Set(boards).size).toBe(6);
      for (const id of boards) expect(() => buildPuzzle(kind, id)).not.toThrow();
    }
  });

  test('a practice solve pays nothing and leaves the save untouched', async () => {
    let real!: ReturnType<typeof usePlayerProgress>;
    let practice!: ReturnType<typeof usePlayerProgress>;
    let bonus: ReturnType<typeof useLastBonus> = null;
    function Real(): null {
      real = usePlayerProgress();
      return null;
    }
    function Practice(): null {
      practice = usePlayerProgress();
      bonus = useLastBonus();
      return null;
    }
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PlayerProgressProvider backend={createMemoryBackend({ [PLAYER_PROGRESS_KEY]: JSON.stringify({ ...emptyProgress(), coins: 40 }) })}>
          <Real />
          <PracticeProvider>
            <Practice />
          </PracticeProvider>
        </PlayerProgressProvider>,
      );
    });
    const id = practiceBoards('bridges')[0];
    let outcome!: ReturnType<typeof practice.recordCompletion>;
    await act(async () => {
      outcome = practice.recordCompletion(id, 0);
    });
    expect(outcome.coinsEarned).toBe(0);
    expect(outcome.best.stars).toBe(3);
    expect(real.coins).toBe(40);
    expect(real.progress.levels[id]).toBeUndefined();

    // A real solve's bonuses never show on a practice card.
    await act(async () => {
      real.recordCompletion(id, 0);
    });
    expect(real.progress.levels[id]).toBeDefined();
    expect(real.lastBonus).not.toBeNull();
    expect(bonus).toBeNull();
    await act(async () => renderer.unmount());
  });
});
