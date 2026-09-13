import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { PressableScale } from '../PressableScale';

/**
 * Regression tests for a real gap: `PressableScale` used to pass `onPress`
 * straight through with no guard at all. Most buttons in the app are
 * idempotent under a duplicate fire (re-dispatching `restart`, re-opening the
 * same puzzle), but a spot like Sudoku/Constellation's Hint button mutates
 * state on every call (burns one hint, drops a star tier) - a single
 * physical tap that somehow produces two `onPress` calls would silently cost
 * the player twice. The fix resets a "already fired" guard on every
 * `onPressIn` and swallows any `onPress` beyond the first per press, without
 * ever touching two genuinely separate presses.
 */
function renderScale(onPress: () => void) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <PressableScale onPress={onPress} feedback={false}>
        <></>
      </PressableScale>,
    );
  });
  // Found by shape rather than `findByType(Pressable)`: RN's `Pressable`
  // export doesn't reliably identity-match across this test file and
  // `PressableScale.tsx` under this project's Jest/RN preset, but the inner
  // pressable is still the only node `PressableScale` gives both handlers to.
  return renderer.root.find(
    node => typeof node.props.onPressIn === 'function' && typeof node.props.onPress === 'function',
  );
}

describe('PressableScale double-fire guard', () => {
  test('a normal press-in/press/press-out cycle fires onPress once', () => {
    const onPress = jest.fn();
    const pressable = renderScale(onPress);

    act(() => {
      pressable.props.onPressIn({});
      pressable.props.onPress({});
      pressable.props.onPressOut({});
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('a duplicate onPress from the same physical press is swallowed', () => {
    const onPress = jest.fn();
    const pressable = renderScale(onPress);

    act(() => {
      pressable.props.onPressIn({});
      pressable.props.onPress({});
      pressable.props.onPress({}); // spurious duplicate, same gesture
      pressable.props.onPressOut({});
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('two separate presses both fire, no matter how close together', () => {
    const onPress = jest.fn();
    const pressable = renderScale(onPress);

    act(() => {
      pressable.props.onPressIn({});
      pressable.props.onPress({});
      pressable.props.onPressOut({});
      pressable.props.onPressIn({}); // a fresh press resets the guard
      pressable.props.onPress({});
      pressable.props.onPressOut({});
    });

    expect(onPress).toHaveBeenCalledTimes(2);
  });
});
