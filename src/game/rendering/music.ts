import { AppState, AppStateStatus } from 'react-native';
import Sound from 'react-native-sound';

/**
 * The almanac's music: one quiet ambient loop (see `tools/make_music.py`),
 * under everything, for as long as the app is open and music is on.
 *
 * It fades in and out rather than starting or stopping dead, pauses when
 * the app goes to the background, and - like every sound here - stays
 * silent rather than failing if the file cannot be loaded. The "Ambient"
 * audio category means it mixes with the player's own music or podcast
 * and respects the silent switch.
 */
const FILE = 'music_almanac.m4a';
/** Well under the effects: something you notice when it stops. */
const VOLUME = 0.3;
const FADE_STEP_MS = 50;

let player: Sound | null = null;
let loaded = false;
let enabled = false;
let volume = 0;
let fade: ReturnType<typeof setInterval> | null = null;
let listening = false;

function withPlayer(then: (sound: Sound) => void): void {
  try {
    if (player) {
      if (loaded) then(player);
      return;
    }
    const sound = new Sound(FILE, Sound.MAIN_BUNDLE, error => {
      if (error) {
        player = null;
        return;
      }
      loaded = true;
      sound.setNumberOfLoops(-1);
      then(sound);
    });
    player = sound;
  } catch {
    // No audio backend: music simply stays off.
  }
}

function fadeTo(target: number, ms: number, done?: () => void): void {
  if (fade) clearInterval(fade);
  const steps = Math.max(1, Math.round(ms / FADE_STEP_MS));
  const from = volume;
  let step = 0;
  fade = setInterval(() => {
    step += 1;
    volume = from + (target - from) * (step / steps);
    player?.setVolume(volume);
    if (step >= steps) {
      if (fade) clearInterval(fade);
      fade = null;
      done?.();
    }
  }, FADE_STEP_MS);
}

function start(): void {
  withPlayer(sound => {
    if (!enabled) return;
    sound.setVolume(volume);
    sound.play();
    fadeTo(VOLUME, 1800);
  });
}

function stop(): void {
  if (!player || !loaded) return;
  fadeTo(0, 700, () => player?.pause());
}

function onAppState(state: AppStateStatus): void {
  if (state === 'active') {
    if (enabled) start();
  } else if (player && loaded) {
    if (fade) clearInterval(fade);
    fade = null;
    volume = 0;
    player.pause();
  }
}

/** Turns the music on or off, with a fade either way. */
export function setMusicEnabled(on: boolean): void {
  if (!listening) {
    listening = true;
    AppState.addEventListener('change', onAppState);
  }
  if (on === enabled) return;
  enabled = on;
  if (on) start();
  else stop();
}
