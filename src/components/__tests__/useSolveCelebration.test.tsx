import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SOLVE_CELEBRATION_MS, useSolveCelebration } from '../useSolveCelebration';

/**
 * Every game screen mounts its completion card behind this gate, so the
 * board's own finish animation gets the screen to itself for a beat
 * before a scrim and a card land on top of it. Before the gate existed,
 * all eight celebrations played entirely underneath the card.
 */

function Probe({ solved, delayMs }: { solved: boolean; delayMs?: number }): React.JSX.Element {
  const show = useSolveCelebration(solved, delayMs);
  return <Text>{show ? 'card' : 'waiting'}</Text>;
}

function textOf(renderer: ReactTestRenderer.ReactTestRenderer): string {
  return renderer.root
    .findAll(node => typeof node.type === 'string', { deep: true })
    .flatMap(node => node.children.filter((child): child is string => typeof child === 'string'))
    .join('');
}

describe('useSolveCelebration', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('holds the card back for the celebration beat, then shows it', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<Probe solved={false} />);
    });
    expect(textOf(renderer)).toBe('waiting');

    act(() => {
      renderer.update(<Probe solved />);
    });
    // The instant the board is solved the card must still be absent -
    // this is the whole point of the gate.
    expect(textOf(renderer)).toBe('waiting');

    act(() => {
      jest.advanceTimersByTime(SOLVE_CELEBRATION_MS - 20);
    });
    expect(textOf(renderer)).toBe('waiting');

    act(() => {
      jest.advanceTimersByTime(40);
    });
    expect(textOf(renderer)).toBe('card');
  });

  test('drops the card again the moment the board is restarted', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<Probe solved />);
    });
    act(() => {
      jest.advanceTimersByTime(SOLVE_CELEBRATION_MS + 10);
    });
    expect(textOf(renderer)).toBe('card');

    act(() => {
      renderer.update(<Probe solved={false} />);
    });
    expect(textOf(renderer)).toBe('waiting');
  });

  test('a restart mid-beat does not let a stale card through afterwards', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<Probe solved />);
    });
    act(() => {
      jest.advanceTimersByTime(SOLVE_CELEBRATION_MS / 2);
      renderer.update(<Probe solved={false} />);
    });
    act(() => {
      jest.advanceTimersByTime(SOLVE_CELEBRATION_MS * 2);
    });
    expect(textOf(renderer)).toBe('waiting');
  });

  test('the beat is long enough to read but not a wait', () => {
    // Pinned deliberately: every board's finish animation is tuned to
    // land inside this, so moving it silently desynchronises all of them.
    // Raised from 620ms after play-testing called the finishes too fast.
    expect(SOLVE_CELEBRATION_MS).toBeGreaterThanOrEqual(900);
    expect(SOLVE_CELEBRATION_MS).toBeLessThanOrEqual(1400);
  });
});
