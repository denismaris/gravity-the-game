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
  arukoneStep: 'sfx_arukone_step.wav',
  arukoneJoin: 'sfx_arukone_join.wav',
  arukoneReject: 'sfx_arukone_reject.wav',
  arukoneSolve: 'sfx_arukone_solve.wav',
  fillapixToggle: 'sfx_fillapix_toggle.wav',
  fillapixClueSatisfied: 'sfx_fillapix_clue.wav',
  fillapixSolve: 'sfx_fillapix_solve.wav',
  lightsOutTap: 'sfx_lightsout_tap.wav',
  lightsOutDarker: 'sfx_lightsout_darker.wav',
  lightsOutSolve: 'sfx_lightsout_solve.wav',
  // Filenames keep their original `ink_trail` naming (already linked into
  // both native projects - see `ios/add_sounds_to_xcodeproj.rb`) even
  // though the `HapticKind` itself is now named for the interstitial's
  // maze rather than a separate game; renaming the asset on disk would
  // mean re-linking it into the Xcode project for no real benefit.
  mazeContact: 'sfx_ink_trail_contact.wav',
  mazeSolve: 'sfx_ink_trail_solve.wav',
  // The four newer games' own voices, from `tools/make_game_sounds.py`.
  // Bloom is a kalimba: a petal flick for a turn, a tine for a closed
  // flower, a pentatonic run for the garden.
  bloomTurn: 'sfx_bloom_turn.wav',
  bloomClose: 'sfx_bloom_close.wav',
  bloomSolve: 'sfx_bloom_solve.wav',
  // Mosaic is ceramic and glass: a clink to lift, a clack to set, a softer
  // one back to the tray, a glass shimmer for the finished picture.
  mosaicPickup: 'sfx_mosaic_pickup.wav',
  mosaicPlace: 'sfx_mosaic_place.wav',
  mosaicReturn: 'sfx_mosaic_return.wav',
  mosaicSolve: 'sfx_mosaic_solve.wav',
  // Bridges is the harbour: a plank laid, a plank lifted, a ship's bell
  // for an island's number met, two dull knocks for a blocked lane, and
  // the bells together for the archipelago joined.
  bridgesBuild: 'sfx_bridges_build.wav',
  bridgesRemove: 'sfx_bridges_remove.wav',
  bridgesIsland: 'sfx_bridges_island.wav',
  bridgesBlocked: 'sfx_bridges_blocked.wav',
  bridgesSolve: 'sfx_bridges_solve.wav',
  // Adjacent is bubbles: a pop per group, a double pop and a sparkle for
  // a multiplying run, a rising fizz for the cleared board.
  adjacentPop: 'sfx_adjacent_pop.wav',
  adjacentCombo: 'sfx_adjacent_combo.wav',
  adjacentSolve: 'sfx_adjacent_solve.wav',
  uiPage: 'sfx_ui_page.wav',
  coin: 'sfx_coin.wav',
};

/** The same sound fired again within this many ms is skipped - a drag
 * across a board fires a step per square, and a burst of identical
 * clicks is exactly what reads as annoying. */
const REPEAT_GAP_MS = 45;
const lastPlayed = new Map<HapticKind, number>();

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

/** The worn solve chime's file, or null for each game's own finish. */
let solveChime: string | null = null;
const chimes = new Map<string, Sound>();

function chimePlayer(file: string): Sound {
  let player = chimes.get(file);
  if (!player) {
    player = new Sound(file, Sound.MAIN_BUNDLE, () => {});
    chimes.set(file, player);
  }
  return player;
}

/** Whether `kind` is a puzzle's finish - the sound a chime replaces. */
export function isSolveKind(kind: HapticKind): boolean {
  return kind === 'solved' || kind.endsWith('Solve');
}

/** Puts on a solve chime (a bundled file name), or null for the games' own. */
export function setSolveChime(file: string | null): void {
  solveChime = file;
  if (!file) return;
  try {
    chimePlayer(file);
  } catch {
    // Silent, like every other sound here.
  }
}

/** Plays a chime once, for the shop to let a player listen before buying. */
export function previewChime(file: string): void {
  if (!soundEnabled) return;
  try {
    ensureInitialized();
    const player = chimePlayer(file);
    if (player.isLoaded()) player.stop(() => player.play());
  } catch {
    // Silent.
  }
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
    const chime = solveChime && isSolveKind(kind) ? chimePlayer(solveChime) : null;
    const player = chime ?? players.get(kind);
    if (!player || !player.isLoaded()) return;
    const now = Date.now();
    if (now - (lastPlayed.get(kind) ?? -Infinity) < REPEAT_GAP_MS) return;
    lastPlayed.set(kind, now);
    player.stop(() => player.play());
  } catch {
    // Never let a missing/failing audio backend break gameplay.
  }
}
