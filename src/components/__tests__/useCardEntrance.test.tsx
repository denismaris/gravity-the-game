import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Animated, Text } from 'react-native';
import { useCardEntrance } from '../useCardEntrance';

// The hook starts a real, looping-ish animation chain on mount. These
// tests only care about `rowStyle`'s bounds, so the clock is frozen and
// never advanced - otherwise the timers outlive the test and take the
// runner down with them.
jest.useFakeTimers();

/**
 * `rowCount` is hand-maintained against hand-written `rowStyle(n)` calls,
 * and a mismatch used to produce no error at the call site at all - just an
 * `undefined` that surfaced far away inside Animated, and only once a
 * player actually finished a level. These pin the boundary.
 */
function Card({ rowCount, rows }: { rowCount: number; rows: ReadonlyArray<number> }): React.JSX.Element {
  const { rowStyle } = useCardEntrance(rowCount);
  return (
    <>
      {rows.map(i => (
        <Animated.View key={i} style={rowStyle(i)}>
          <Text>{i}</Text>
        </Animated.View>
      ))}
    </>
  );
}

function render(rowCount: number, rows: ReadonlyArray<number>): void {
  act(() => {
    TestRenderer.create(<Card rowCount={rowCount} rows={rows} />);
  });
}

describe('useCardEntrance rowStyle', () => {
  test('serves every row a card declared', () => {
    expect(() => render(6, [0, 1, 2, 3, 4, 5])).not.toThrow();
  });

  test('a card rendering more rows than it declared fails loudly, naming both counts', () => {
    // Exactly the Gravity completion card's bug: six rows rendered, five declared.
    expect(() => render(5, [0, 1, 2, 3, 4, 5])).toThrow(/row 5 requested but only 5 were created/);
  });

  test('declaring more rows than are rendered is harmless', () => {
    expect(() => render(6, [0, 1])).not.toThrow();
  });
});
