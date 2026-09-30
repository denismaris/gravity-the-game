import { SWIPE_THRESHOLD, advanceSwipe, directionForAccessibilityAction, newSwipeTrack } from '../useSwipeGesture';

describe('directionForAccessibilityAction', () => {
  test('maps each of the four rotor action names to its direction', () => {
    expect(directionForAccessibilityAction('up')).toBe('up');
    expect(directionForAccessibilityAction('down')).toBe('down');
    expect(directionForAccessibilityAction('left')).toBe('left');
    expect(directionForAccessibilityAction('right')).toBe('right');
  });

  test('rejects anything that is not one of the four directions', () => {
    expect(directionForAccessibilityAction('activate')).toBeNull();
    expect(directionForAccessibilityAction('magicTap')).toBeNull();
    expect(directionForAccessibilityAction('')).toBeNull();
    expect(directionForAccessibilityAction('UP')).toBeNull();
  });
});

describe('advanceSwipe', () => {
  test('fires mid-drag, the moment the threshold is crossed', () => {
    const track = newSwipeTrack();
    expect(advanceSwipe(track, SWIPE_THRESHOLD - 1, 2)).toBeNull();
    expect(advanceSwipe(track, SWIPE_THRESHOLD + 1, 2)).toBe('right');
  });

  test('a long drag in one direction is one swipe, not a stream', () => {
    const track = newSwipeTrack();
    expect(advanceSwipe(track, 0, -30)).toBe('up');
    expect(advanceSwipe(track, 0, -90)).toBeNull();
    expect(advanceSwipe(track, 0, -200)).toBeNull();
  });

  test('one touch can turn and fire again without lifting', () => {
    const track = newSwipeTrack();
    expect(advanceSwipe(track, 30, 0)).toBe('right');
    expect(advanceSwipe(track, 34, 30)).toBe('down');
    expect(advanceSwipe(track, 4, 32)).toBe('left');
  });
});
