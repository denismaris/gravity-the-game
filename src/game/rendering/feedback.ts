import { HapticKind, triggerHaptic } from './haptics';
import { triggerSound } from './sound';

/**
 * Fires both halves of a tactile+audible moment at once. `haptics.ts` and
 * `sound.ts` share the same `HapticKind` closed set by design (a haptic
 * without a matching sound, or vice versa, is the exception rather than the
 * rule) - this is what every call site should reach for. The two low-level
 * functions stay separately exported for the rare spot that only wants one.
 */
export function triggerFeedback(kind: HapticKind): void {
  triggerHaptic(kind);
  triggerSound(kind);
}
