import { directionForAccessibilityAction } from '../useSwipeGesture';

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
