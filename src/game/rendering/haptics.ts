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
  | 'tentsSolve'
  | 'arukoneStep'
  | 'arukoneJoin'
  | 'arukoneReject'
  | 'arukoneSolve'
  | 'fillapixToggle'
  | 'fillapixClueSatisfied'
  | 'fillapixSolve'
  | 'lightsOutTap'
  | 'lightsOutDarker'
  | 'lightsOutSolve'
  | 'mazeContact'
  | 'mazeSolve'
  | 'bloomTurn'
  | 'bloomClose'
  | 'bloomSolve';

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

  // Arukone+. A drag fires `arukoneStep` once per square crossed - as
  // frequent as Binairo's own toggle, so it stays just as light (matching
  // the shared `step` it replaces); joining a pair is this game's own
  // real milestone, weighted like Towers'/Tents' row-complete; a reject
  // (the drag hit a wall or another path) sits between Towers' conflict
  // and Tents' error - a real "no", not yet the loudest one in the app;
  // the solve is its own short rising pair, distinct from every other
  // game's own shape.
  arukoneStep: 5,
  arukoneJoin: 15,
  arukoneReject: 11,
  arukoneSolve: [0, 14, 42, 20],

  // Fill-a-Pix. A tap is a deliberate single action (not a drag), so it
  // sits with Mirror Maze's/Towers' own "place" weight rather than
  // Binairo's rapid-fire toggle; a clue newly satisfied is a real but
  // common signal - lighter than the other three games' own milestones,
  // since a single tap can satisfy several clues at once and this should
  // read as steady positive feedback, not a fanfare every time. No error
  // kind - like Mirror Maze, there is no illegal move here. The solve is
  // its own short rising pair.
  fillapixToggle: 6,
  fillapixClueSatisfied: 12,
  fillapixSolve: [0, 13, 44, 19],

  // Lights Out. A press flips five lights at once, so its base tick sits
  // a touch firmer than the one-mark "place" actions elsewhere; a press
  // that leaves the board darker than it found it is the only progress
  // this game has, and gets the heavier of the two (but well short of a
  // row-complete - it happens roughly every other press). The solve is
  // the one shape in the app that *falls* rather than rises: four pulses
  // thinning out, lights going off one after another.
  lightsOutTap: 7,
  lightsOutDarker: 11,
  lightsOutSolve: [0, 24, 38, 18, 38, 13, 38, 9],

  // The calming interstitial's maze. A wall contact is a definite, felt
  // "thock" - firmer than any other game's per-move tick, since it fires
  // far less often (gated on a minimum incoming speed, not every slide);
  // the solve is its own longer rising triple, distinct from every game's
  // since a maze filling is a bigger, slower-building moment than a
  // single move.
  // Android honours these durations literally, and 16ms sits at the edge
  // of what many phone motors can spin up for at all - a wall hit reported
  // as "no vibration". 30ms is a clearly felt tap; iOS ignores the value
  // and plays its own fixed system buzz either way.
  mazeContact: 30,
  mazeSolve: [0, 30, 60, 30, 60, 40],

  // Bloom: a light click per quarter turn (it is the most frequent action
  // in the game, so the softest), a firmer tap when a loop closes, and a
  // rising triple for the whole board.
  bloomTurn: 5,
  bloomClose: 14,
  bloomSolve: [0, 14, 45, 18, 45, 26],
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
