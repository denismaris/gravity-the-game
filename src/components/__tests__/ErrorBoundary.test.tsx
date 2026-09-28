import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { ErrorBoundary } from '../ErrorBoundary';

/** Throws while `shouldThrow.current` is true, renders plain text once it's
 * flipped false - lets a test drive "the bug is still there" vs. "the next
 * render is actually fine" without needing a real bug to reproduce. */
function Bomb({ shouldThrow }: { shouldThrow: { current: boolean } }): React.JSX.Element {
  if (shouldThrow.current) throw new Error('boom');
  return <Text>safe</Text>;
}

describe('ErrorBoundary', () => {
  test('renders children normally when nothing throws', () => {
    const shouldThrow = { current: false };
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ErrorBoundary>
          <Bomb shouldThrow={shouldThrow} />
        </ErrorBoundary>,
      );
    });
    expect(renderer.root.findByType(Text).props.children).toBe('safe');
  });

  test('catches a thrown render error and shows the fallback instead of crashing', () => {
    const shouldThrow = { current: true };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ErrorBoundary>
          <Bomb shouldThrow={shouldThrow} />
        </ErrorBoundary>,
      );
    });
    consoleError.mockRestore();

    expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'Something went wrong')).toBe(true);
  });

  test('"Try again" resets the boundary and re-renders children fresh', () => {
    const shouldThrow = { current: true };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <ErrorBoundary>
          <Bomb shouldThrow={shouldThrow} />
        </ErrorBoundary>,
      );
    });

    // The underlying issue is resolved before the player retries - the
    // realistic case a "Try again" button is actually for.
    shouldThrow.current = false;
    const tryAgain = renderer.root.find(node => typeof node.props.onPress === 'function');
    act(() => {
      tryAgain.props.onPress({});
    });
    consoleError.mockRestore();

    expect(renderer.root.findByType(Text).props.children).toBe('safe');
  });
});
