import { Platform, Vibration } from 'react-native';
import RNHapticFeedback, { HapticEvent } from 'react-native-haptic-feedback';

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
  | 'bloomSolve'
  | 'mosaicPickup'
  | 'mosaicPlace'
  | 'mosaicReturn'
  | 'mosaicSolve'
  | 'bridgesBuild'
  | 'bridgesRemove'
  | 'bridgesIsland'
  | 'bridgesBlocked'
  | 'bridgesSolve'
  | 'adjacentPop'
  | 'adjacentCombo'
  | 'adjacentSolve'
  | 'uiPage'
  | 'coin';

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

  // Mosaic: the lightest touch to lift a piece, a firm set as it presses
  // into the grout, a soft nudge when one slides home, and a long rising
  // run for the finished picture.
  mosaicPickup: 4,
  mosaicPlace: 16,
  mosaicReturn: 6,
  mosaicSolve: [0, 16, 45, 18, 45, 22, 45, 30],

  // Bridges: a firm set as a bridge lands (iOS plays a richer plank-by-
  // plank pattern of its own - see `BridgesScreen`), a light lift when one
  // comes away, a solid tap when an island's number is met, a soft refusal
  // for a bridge blocked by another, and a long rising run for the whole
  // archipelago joining up.
  bridgesBuild: 14,
  bridgesRemove: 6,
  bridgesIsland: 18,
  bridgesBlocked: 10,
  bridgesSolve: [0, 14, 45, 16, 45, 20, 45, 28],

  // Adjacent: a light pop for each group cleared, a fuller double for a
  // run big enough to multiply its score, and a bubbling finish.
  adjacentPop: 6,
  adjacentCombo: [0, 10, 40, 14],
  adjacentSolve: [0, 12, 40, 14, 40, 18, 40, 26],

  // The app's own UI: a page turned (a tab), and a coin landing (a claim
  // or a purchase) - a quick two-beat "clink".
  uiPage: 4,
  coin: [0, 8, 40, 12],
};

/** A transient: one tap, at `time` ms. */
const tap = (time: number, intensity: number, sharpness: number): HapticEvent => ({ time, type: 'transient', intensity, sharpness });
/** A continuous buzz - a hum, a scrape - for `duration` ms. */
const hum = (time: number, duration: number, intensity: number, sharpness: number): HapticEvent => ({ time, type: 'continuous', duration, intensity, sharpness });

/**
 * A win, felt: three taps climbing in strength, then a short warm hum as
 * the board settles - with `sharpness` the game's own material (soft earth
 * for Tents, glass for Mirror Maze).
 */
function finale(sharpness: number): HapticEvent[] {
  return [tap(0, 0.45, sharpness), tap(85, 0.62, sharpness), tap(170, 0.85, sharpness), hum(190, 240, 0.22, sharpness * 0.6)];
}

/**
 * Each game's own feel on the Taptic Engine, designed the way the sounds
 * were: what the thing would feel like if it were real. Low sharpness is
 * soft and dull (earth, felt, wood), high sharpness crisp (glass, a stamp,
 * a coin). Kinds not listed here fall back to their pattern above.
 * iOS only - Android's vibrator can play durations, not textures.
 */
const TEXTURES: Partial<Record<HapticKind, HapticEvent[]>> = {
  // Gravity: the board tilting is a short slide under the thumb; a piece
  // landing on its ring is a soft, settled thunk.
  gravityChange: [hum(0, 60, 0.28, 0.2)],
  targetReached: [tap(0, 0.7, 0.3), tap(36, 0.25, 0.15)],
  // A fall is one low, dull buzz - wrong before the eye finds why.
  failed: [hum(0, 160, 0.55, 0.05)],
  // Every win: a short climb that blooms - in each game's own material.
  solved: finale(0.5),
  mirrorSolve: finale(0.95),
  towersSolve: finale(0.45),
  binairoSolve: finale(0.75),
  tentsSolve: finale(0.15),
  arukoneSolve: finale(0.6),
  fillapixSolve: finale(0.85),
  lightsOutSolve: finale(0.35),
  bloomSolve: finale(0.3),
  mosaicSolve: finale(0.8),
  bridgesSolve: finale(0.4),
  adjacentSolve: finale(0.55),
  // Tents: a peg driven into soft ground - a dull thump and its settle.
  tentsPlant: [tap(0, 0.75, 0.08), tap(38, 0.3, 0.05)],
  tentsRowComplete: [tap(0, 0.5, 0.2), tap(70, 0.6, 0.25), tap(140, 0.75, 0.3)],
  tentsError: [hum(0, 90, 0.45, 0.05)],
  // Binairo: a rubber stamp - the crisp strike, then the press.
  binairoToggle: [tap(0, 0.8, 0.85), hum(8, 45, 0.25, 0.1)],
  binairoRowBalance: [tap(0, 0.55, 0.7), tap(60, 0.7, 0.75)],
  binairoError: [tap(0, 0.6, 0.1), tap(70, 0.45, 0.1)],
  // Lights Out: a lamp coming on hums, a lamp going off clicks.
  lightsOutTap: [tap(0, 0.55, 0.5), hum(10, 110, 0.22, 0.12)],
  lightsOutDarker: [tap(0, 0.45, 0.35)],
  // Mirror Maze: glass - a fine, bright tick; a gem rings.
  mirrorPlace: [tap(0, 0.45, 1)],
  mirrorGem: [tap(0, 0.7, 1), hum(10, 160, 0.18, 0.9)],
  // Skyscrapers: a block set down - a solid, woody thunk.
  towersPlace: [tap(0, 0.8, 0.4), tap(30, 0.25, 0.2)],
  towersConflict: [tap(0, 0.55, 0.1), tap(60, 0.45, 0.1)],
  towersRowComplete: [tap(0, 0.5, 0.5), tap(60, 0.65, 0.55), tap(120, 0.8, 0.6)],
  // Arukone+: a cord pulled over pegs - the faintest catch per square.
  arukoneStep: [tap(0, 0.28, 0.6)],
  arukoneJoin: [tap(0, 0.6, 0.5), tap(50, 0.8, 0.6)],
  arukoneReject: [hum(0, 70, 0.4, 0.05)],
  // Fill-a-Pix: a pencil - a short scratch across the paper.
  fillapixToggle: [hum(0, 40, 0.38, 0.95), tap(42, 0.3, 0.6)],
  fillapixClueSatisfied: [tap(0, 0.5, 0.8)],
  // Bloom: a petal turning on its stem - a soft swish.
  bloomTurn: [hum(0, 55, 0.3, 0.25)],
  bloomClose: [tap(0, 0.55, 0.45), hum(15, 140, 0.2, 0.3)],
  // Mosaic: ceramic - a light clink to lift, a firm clack to set.
  mosaicPickup: [tap(0, 0.35, 0.95)],
  mosaicPlace: [tap(0, 0.8, 0.8), tap(24, 0.35, 0.9)],
  mosaicReturn: [tap(0, 0.4, 0.6)],
  // Adjacent: bubbles - a pop, and a run of pops for a combo.
  adjacentPop: [tap(0, 0.55, 0.3), tap(18, 0.3, 0.8)],
  adjacentCombo: [tap(0, 0.6, 0.3), tap(45, 0.7, 0.5), tap(90, 0.85, 0.7)],
  // Bridges: a plank laid (the full plank-by-plank lay is BridgesScreen's).
  bridgesBuild: [tap(0, 0.7, 0.35)],
  bridgesRemove: [tap(0, 0.4, 0.3)],
  bridgesIsland: [tap(0, 0.6, 0.9), hum(10, 180, 0.15, 0.8)],
  bridgesBlocked: [tap(0, 0.5, 0.1), tap(70, 0.4, 0.1)],
  // The app: a page, and a coin.
  uiPage: [tap(0, 0.3, 0.7)],
  coin: [tap(0, 0.6, 1), tap(55, 0.75, 1)],
};

let hapticsEnabled = true;

/** Globally enables/disables haptics (e.g. from a future settings screen). */
export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

/** Loose options for the native module: vibrate on hardware without a
 * Taptic Engine, and fire even with Android's touch-feedback setting off
 * (the app has its own haptics switch, which is the one that counts). */
const NATIVE_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: true };

/**
 * A pattern as Taptic Engine taps: each pulse becomes one transient, its
 * strength scaled from the pulse's length - a 4ms tick is a whisper, a
 * 45ms buzz a firm knock. Exported for its tests.
 */
export function patternToEvents(pattern: number | number[]): HapticEvent[] {
  const pulses: Array<{ at: number; ms: number }> = [];
  if (typeof pattern === 'number') pulses.push({ at: 0, ms: pattern });
  else {
    let at = 0;
    for (let i = 0; i < pattern.length; i += 1) {
      if (i % 2 === 1) pulses.push({ at, ms: pattern[i] });
      at += pattern[i];
    }
  }
  return pulses.map(({ at, ms }) => ({
    time: at,
    type: 'transient' as const,
    intensity: Math.min(1, 0.3 + ms / 40),
    sharpness: Math.min(0.9, 0.35 + ms / 100),
  }));
}

/**
 * Fires one of the app's haptic moments.
 *
 * iOS goes through Core Haptics (`react-native-haptic-feedback`). It used
 * React Native's own `Vibration`, which on iOS can only play the one fixed
 * system buzz, ignores every duration here, and is suppressed outright in
 * several ringer/haptics settings - players reported feeling nothing at
 * all. Android keeps `Vibration`, which honours these durations literally.
 *
 * Fire-and-forget: haptics are a nicety, so any failure is swallowed.
 */
export function triggerHaptic(kind: HapticKind): void {
  if (!hapticsEnabled) return;

  try {
    if (Platform.OS === 'ios') RNHapticFeedback.triggerPattern(TEXTURES[kind] ?? patternToEvents(PATTERNS[kind]), NATIVE_OPTIONS);
    else Vibration.vibrate(PATTERNS[kind]);
  } catch {
    // Never let a missing/failing vibration API break gameplay.
  }
}

/** Plays a hand-built pattern - the maze ball's roll, say, which is shaped
 * to its own path rather than one of the fixed kinds above. */
export function playHapticEvents(events: HapticEvent[]): void {
  if (!hapticsEnabled || events.length === 0) return;
  try {
    RNHapticFeedback.triggerPattern(events, NATIVE_OPTIONS);
  } catch {
    // As above.
  }
}

/** Cuts off whatever pattern is playing - a roll interrupted by a swipe. */
export function stopHaptics(): void {
  try {
    RNHapticFeedback.stop();
  } catch {
    // As above.
  }
}
