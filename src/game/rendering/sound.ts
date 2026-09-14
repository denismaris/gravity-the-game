import Sound from 'react-native-sound';
import { HapticKind } from './haptics';

/**
 * Short synthesized sound effects, one per `HapticKind` (see `haptics.ts` -
 * the two are deliberately the same closed set, fired together by
 * `triggerFeedback`, so every tactile moment in the app is also an audible
 * one). Generated as plain sine tones (no external assets, no licensing to
 * track) - see the repo's design notes for the synthesis script.
 *
 * Android: bundled as `android/app/src/main/res/raw/*.wav`, resolved by
 * filename automatically. iOS: the same files need to be added to the Xcode
 * project bundle by hand (Xcode -> right-click the project -> "Add Files") -
 * see `react-native-sound`'s README. Until that's done, iOS playback fails
 * silently (see the try/catch below) rather than breaking anything.
 */
const FILES: Record<HapticKind, string> = {
  gravityChange: 'sfx_move.wav',
  targetReached: 'sfx_target.wav',
  solved: 'sfx_solve.wav',
  step: 'sfx_step.wav',
  failed: 'sfx_fail.wav',
  tap: 'sfx_tap.wav',
  mirrorPlace: 'sfx_mirror_place.wav',
  mirrorGem: 'sfx_mirror_gem.wav',
  mirrorSolve: 'sfx_mirror_solve.wav',
  towersPlace: 'sfx_towers_place.wav',
  towersConflict: 'sfx_towers_conflict.wav',
  towersRowComplete: 'sfx_towers_row_complete.wav',
  towersSolve: 'sfx_towers_solve.wav',
  binairoToggle: 'sfx_binairo_toggle.wav',
  binairoError: 'sfx_binairo_error.wav',
  binairoRowBalance: 'sfx_binairo_row_balance.wav',
  binairoSolve: 'sfx_binairo_solve.wav',
  tentsPlant: 'sfx_tents_plant.wav',
  tentsError: 'sfx_tents_error.wav',
  tentsRowComplete: 'sfx_tents_row_complete.wav',
  tentsSolve: 'sfx_tents_solve.wav',
};

let soundEnabled = true;
let initialized = false;
const players = new Map<HapticKind, Sound>();

function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;

  // "Ambient": mixes with whatever else is playing (music, a podcast) and
  // still respects the iOS silent switch - the polite default for a casual
  // game's sound effects, as opposed to "Playback" which would interrupt
  // other audio and play even when muted.
  Sound.setCategory('Ambient');

  (Object.keys(FILES) as HapticKind[]).forEach(kind => {
    const player = new Sound(FILES[kind], Sound.MAIN_BUNDLE, () => {
      // A load failure (most likely: not yet added to the iOS bundle) just
      // means this one effect stays silent - every other call site is
      // already guarded, so nothing else is affected.
    });
    players.set(kind, player);
  });
}

/** Globally enables/disables sound effects (e.g. from a future settings screen). */
export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

/**
 * Plays the short effect for `kind`, restarting it from the beginning if
 * it's still playing (the `step` sound in particular can be retriggered
 * many times a second while dragging). Fire-and-forget and defensive in the
 * same spirit as `triggerHaptic` - a missing native module, an unlinked
 * platform, or a decode failure never breaks gameplay, it just means this
 * one call is silent.
 */
export function triggerSound(kind: HapticKind): void {
  if (!soundEnabled) return;

  try {
    ensureInitialized();
    const player = players.get(kind);
    if (!player || !player.isLoaded()) return;
    player.stop(() => player.play());
  } catch {
    // Never let a missing/failing audio backend break gameplay.
  }
}
