import { Vibration } from 'react-native';

/**
 * The specific in-game moments that deserve a tactile nudge. Kept as a
 * closed set (rather than letting callers pass raw durations) so haptics
 * stay consistent and easy to re-tune from one place.
 */
export type HapticKind = 'gravityChange' | 'targetReached' | 'solved';

/**
 * Pattern in milliseconds passed to `Vibration.vibrate`. A single number is
 * one short pulse; an array alternates [wait, vibrate, wait, vibrate, ...].
 * Durations are intentionally tiny - this is meant to be felt, not heard.
 */
const PATTERNS: Record<HapticKind, number | number[]> = {
  // A very short tick: "your input was received and something moved".
  gravityChange: 8,
  // Slightly firmer than a gravity tick: "a piece landed where it belongs".
  targetReached: 14,
  // A quick double-pulse: distinct from the two above without being showy.
  solved: [0, 18, 55, 18],
};

let hapticsEnabled = true;

/** Globally enables/disables haptics (e.g. from a future settings screen). */
export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

/**
 * Small, reusable abstraction over the device's vibration motor.
 *
 * This project has no native haptics dependency (e.g. `expo-haptics` /
 * `react-native-haptic-feedback`) installed, and adding one would require a
 * native rebuild that is out of scope for this pass. `Vibration` ships
 * with React Native core, needs no extra native module, and is enough to
 * deliver short, subtle "tick" feedback on both platforms. If richer,
 * platform-native haptics (e.g. iOS's Taptic Engine via
 * `UIImpactFeedbackGenerator`) are wanted later, swap the implementation
 * of this single function - every call site is already routed through it.
 *
 * Deliberately fire-and-forget and defensive: haptics are a nicety, never
 * a requirement, so any failure (unsupported platform, no vibration
 * motor, test environment) is swallowed rather than surfaced.
 */
export function triggerHaptic(kind: HapticKind): void {
  if (!hapticsEnabled) return;

  try {
    Vibration.vibrate(PATTERNS[kind]);
  } catch {
    // Never let a missing/failing vibration API break gameplay.
  }
}
