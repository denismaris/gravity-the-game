import { AccessibilityInfo } from 'react-native';

/**
 * Speaks a short line to a screen reader (VoiceOver, TalkBack), and only
 * then: with none running this does nothing. iOS reads out what a move
 * changed only when told to; a label that quietly updated was never heard.
 *
 * Lines queued within `settleMs` of each other collapse into the last, so
 * three quick moves speak where the board ended up, not all three counts.
 */
let screenReader = false;
AccessibilityInfo.isScreenReaderEnabled?.()
  .then(on => {
    screenReader = on;
  })
  .catch(() => {});
AccessibilityInfo.addEventListener?.('screenReaderChanged', on => {
  screenReader = on;
});

let pending: ReturnType<typeof setTimeout> | null = null;

export function announce(line: string, settleMs = 450): void {
  if (!screenReader) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    AccessibilityInfo.announceForAccessibility(line);
  }, settleMs);
}
