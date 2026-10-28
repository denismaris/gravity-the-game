import { Platform } from 'react-native';
import RNHapticFeedback from 'react-native-haptic-feedback';
import { androidEffectFor, setHapticsEnabled, triggerHaptic } from '../haptics';

/**
 * Android plays the same textures as iOS, each tap as the phone's own
 * tuned effect at its own moment, never a timed buzz.
 */
describe('Android haptics', () => {
  const original = Platform.OS;
  beforeEach(() => {
    jest.useFakeTimers();
    (Platform as { OS: string }).OS = 'android';
    setHapticsEnabled(true);
    (RNHapticFeedback.trigger as jest.Mock).mockClear();
    (RNHapticFeedback.triggerPattern as jest.Mock).mockClear();
  });
  afterEach(() => {
    (Platform as { OS: string }).OS = original;
    jest.useRealTimers();
  });

  test('strength picks the effect, light to heavy', () => {
    expect(androidEffectFor(0.2)).toBe('impactLight');
    expect(androidEffectFor(0.45)).toBe('selection');
    expect(androidEffectFor(0.6)).toBe('impactMedium');
    expect(androidEffectFor(0.8)).toBe('rigid');
    expect(androidEffectFor(1)).toBe('impactHeavy');
  });

  test('a finish is three taps climbing, each at its moment', () => {
    triggerHaptic('glassSolve');
    expect(RNHapticFeedback.triggerPattern).not.toHaveBeenCalled();
    expect(RNHapticFeedback.trigger).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(200);
    const types = (RNHapticFeedback.trigger as jest.Mock).mock.calls.map(c => c[0]);
    expect(types).toEqual(['selection', 'impactMedium', 'impactHeavy']);
  });

  test('a moment that is only a hum is still felt, softly', () => {
    triggerHaptic('gravityChange');
    expect((RNHapticFeedback.trigger as jest.Mock).mock.calls.map(c => c[0])).toEqual(['impactLight']);
  });

  test('off means off', () => {
    setHapticsEnabled(false);
    triggerHaptic('refuse');
    jest.advanceTimersByTime(500);
    expect(RNHapticFeedback.trigger).not.toHaveBeenCalled();
  });
});
