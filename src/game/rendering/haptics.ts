import { Vibration } from 'react-native';

/**
 * The specific in-game moments that deserve a tactile nudge. Kept as a
 * closed set (rather than letting callers pass raw durations) so haptics
 * stay consistent and easy to re-tune from one place.
 */
export type HapticKind =
  | 'gravityChange'
  | 'targetReached'
  | 'solved'
  | 'step'
  | 'failed'
  | 'tap'
  // Per-game voices. The shared kinds above stay the default for any game
  // that hasn't been given its own character yet; these exist so a game's
  // core verb, its milestone and its win can be told apart by ear alone.
  | 'mirrorPlace'
  | 'mirrorGem'
  | 'mirrorSolve'
  | 'towersPlace'
  | 'towersConflict'
  | 'towersRowComplete'
  | 'towersSolve'
  | 'binairoToggle'
  | 'binairoError'
  | 'binairoRowBalance'
  | 'binairoSolve'
  | 'tentsPlant'
  | 'tentsError'
  | 'tentsRowComplete'
  | 'tentsSolve';

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
  // The faintest possible nudge: one unit of progress in Constellation or
  // Trajectory (a cell toggled, a path extended by one square) - lighter
  // than `gravityChange` since these fire far more often, per drag frame.
  step: 5,
  // One long, low buzz - deliberately unlike the two short/double pulses
  // above, so a hazard death reads as "wrong" the instant it's felt, before
  // the eye even finds the failure card.
  failed: 45,
  // A near-imperceptible tick for a plain UI button press (see
  // `PressableScale`) - present mostly so it lines up with `sound.ts`'s
  // `tap`, which is the more noticeable half of that pair.
  tap: 4,

  // Mirror Maze. A mirror turning is the game's core verb and fires
  // constantly, so it stays crisp and light; reaching a gem is a genuine
  // milestone and gets noticeably more; the solve is a rising triple,
  // deliberately unlike the shared `solved` double-pulse.
  mirrorPlace: 6,
  mirrorGem: 16,
  mirrorSolve: [0, 12, 45, 16, 45, 28],

  // Skyscrapers. A height entry is the core verb (as frequent as
  // `mirrorPlace`, same weight); a conflict is a soft "no" - present but
  // well short of `failed`, which is reserved for a hazard death; a row/
  // column completing is a real but mid-weight milestone (`mirrorGem`'s
  // weight); the solve is a rising triple, its own shape rather than a
  // copy of `mirrorSolve`'s.
  towersPlace: 6,
  towersConflict: 10,
  towersRowComplete: 16,
  towersSolve: [0, 15, 50, 15, 50, 25],

  // Binairo. The highest-repetition tap in the whole app, so its toggle
  // stays the lightest haptic anywhere (lighter than `tap` itself); an
  // error is a soft "no", quieter even than Skyscrapers' since Binairo's
  // whole palette is deliberately the quietest of the four; a line
  // balancing is a small, real nudge; the solve is its own short rising
  // pair, distinct from (and gentler than) the other three games' solves.
  binairoToggle: 3,
  binairoError: 8,
  binairoRowBalance: 14,
  binairoSolve: [0, 12, 40, 18],

  // Tents and Trees. Planting is a real, deliberate act (unlike Binairo's
  // rapid-fire toggle), so it sits a little firmer; a touching-tents
  // violation is a clear but not alarming "no"; a satisfied line is a
  // solid tick; the solve is its own short rising triple.
  tentsPlant: 9,
  tentsError: 12,
  tentsRowComplete: 15,
  tentsSolve: [0, 14, 45, 14, 45, 22],
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
