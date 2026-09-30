#!/usr/bin/env python3
"""
Synthesizes the per-game sound effects for Bridges, Bloom, Mosaic and
Adjacent - the four games that used to borrow other games' voices.

Each game gets sounds drawn from its own world: Bridges is wood and a
harbour bell, Bloom a kalimba's tines, Mosaic ceramic and glass, Adjacent
soft bubble pops. Everything is additive synthesis (sines with their own
decays, a little filtered noise for the knocks) - no samples, nothing to
license - written as 44.1 kHz mono 16-bit WAV, the format of the rest of
the set, into both native projects.

Run from the repo root:  python3 tools/make_game_sounds.py
Then link the new files into Xcode:  cd ios && ruby add_sounds_to_xcodeproj.rb
"""
import os
import wave

import numpy as np

SR = 44100
OUT_DIRS = ['ios/GravityInit/Sounds', 'android/app/src/main/res/raw']
RNG = np.random.default_rng(7)


def timeline(seconds):
    return np.arange(int(SR * seconds)) / SR


def tone(t, freq, amp=1.0, decay=0.2, attack=0.004, glide_to=None, glide_time=0.05):
    """A sine with an exponential decay and a short attack ramp (no click).
    `glide_to` bends the pitch from `freq` to it over `glide_time`."""
    if glide_to is None:
        phase = 2 * np.pi * freq * t
    else:
        f = np.where(t < glide_time, freq + (glide_to - freq) * (t / glide_time), glide_to)
        phase = 2 * np.pi * np.cumsum(f) / SR
    env = np.exp(-t / decay) * np.clip(t / attack, 0, 1)
    return amp * env * np.sin(phase)


def partials(t, freq, ratios, amps, decays, attack=0.003):
    out = np.zeros_like(t)
    for ratio, amp, decay in zip(ratios, amps, decays):
        out += tone(t, freq * ratio, amp, decay, attack)
    return out


def bandpass_noise(t, low, high, decay, amp=1.0):
    """White noise band-limited in the frequency domain, with a decay -
    the 'knock' in a knock."""
    noise = RNG.standard_normal(len(t))
    spectrum = np.fft.rfft(noise)
    freqs = np.fft.rfftfreq(len(t), 1 / SR)
    spectrum[(freqs < low) | (freqs > high)] = 0
    shaped = np.fft.irfft(spectrum, len(t))
    shaped /= max(1e-9, np.abs(shaped).max())
    return amp * shaped * np.exp(-t / decay) * np.clip(t / 0.001, 0, 1)


def at(signal, seconds, total):
    """`signal` placed `seconds` into a buffer `total` samples long."""
    out = np.zeros(total)
    start = int(SR * seconds)
    end = min(total, start + len(signal))
    out[start:end] = signal[: end - start]
    return out


def finish(signal, peak):
    """Normalises to `peak`, fades the last 12 ms, removes any DC."""
    signal = signal - signal.mean()
    fade = min(len(signal), int(SR * 0.012))
    signal[-fade:] *= np.linspace(1, 0, fade)
    return signal / max(1e-9, np.abs(signal).max()) * peak


# --- Bridges: wood and a harbour bell ------------------------------------

def plank(t, freq, weight=1.0):
    body = partials(t, freq, [1, 2.63, 4.1], [1, 0.45, 0.2], [0.045, 0.025, 0.015])
    return body * weight + bandpass_noise(t, 700, 2600, 0.008, 0.35 * weight)


def bell(t, freq, amp=1.0, ring=0.5):
    return amp * partials(t, freq, [1, 2.0, 2.4, 3.0, 4.2], [1, 0.5, 0.35, 0.25, 0.15], [ring, ring * 0.7, ring * 0.5, ring * 0.4, ring * 0.25])


def bridges_build():
    t = timeline(0.16)
    return finish(plank(t, 196), 0.6)


def bridges_remove():
    t = timeline(0.09)
    lift = tone(t, 330, 1, 0.03, glide_to=280, glide_time=0.05)
    return finish(lift + bandpass_noise(t, 1200, 3200, 0.005, 0.2), 0.42)


def bridges_island():
    t = timeline(0.62)
    return finish(bell(t, 1046.5, 1, 0.42), 0.62)


def bridges_blocked():
    total = int(SR * 0.22)
    t = timeline(0.12)
    knock = partials(t, 130, [1, 2.2], [1, 0.3], [0.04, 0.02]) + bandpass_noise(t, 200, 900, 0.01, 0.4)
    return finish(at(knock, 0, total) + at(knock * 0.7, 0.075, total), 0.7)


def bridges_solve():
    total = int(SR * 1.3)
    t = timeline(1.0)
    notes = [(783.99, 0.0, 0.8), (987.77, 0.12, 0.8), (1174.66, 0.24, 0.85), (1567.98, 0.38, 1.0)]
    out = np.zeros(total)
    for freq, start, amp in notes:
        out += at(bell(t, freq, amp, 0.55 if freq < 1500 else 0.8), start, total)
    return finish(out, 0.9)


# --- Bloom: kalimba tines --------------------------------------------------

def tine(t, freq, amp=1.0, ring=0.35):
    # A kalimba's bright second mode sits near 5.4x, and dies almost at once.
    return amp * partials(t, freq, [1, 5.4, 2.0], [1, 0.25, 0.12], [ring, 0.05, ring * 0.5], attack=0.002)


def bloom_turn():
    t = timeline(0.08)
    flick = tone(t, 1400, 1, 0.028, glide_to=1900, glide_time=0.04) + tone(t, 2800, 0.2, 0.015)
    return finish(flick, 0.38)


def bloom_close():
    t = timeline(0.48)
    return finish(tine(t, 880), 0.65)


def bloom_solve():
    total = int(SR * 1.1)
    t = timeline(0.9)
    run = [1046.5, 1174.66, 1318.51, 1567.98, 1760.0]
    out = np.zeros(total)
    for i, freq in enumerate(run):
        out += at(tine(t, freq, 0.75, 0.3), i * 0.07, total)
    out += at(tine(t, 2093.0, 1.0, 0.55), len(run) * 0.07 + 0.03, total)
    return finish(out, 0.85)


# --- Mosaic: ceramic and glass ---------------------------------------------

def mosaic_pickup():
    t = timeline(0.07)
    clink = partials(t, 2637, [1, 1.5, 2.3], [1, 0.4, 0.2], [0.035, 0.02, 0.012], attack=0.001)
    return finish(clink, 0.34)


def mosaic_place():
    t = timeline(0.09)
    clack = tone(t, 1320, 1, 0.025, attack=0.001) + tone(t, 330, 0.8, 0.02) + bandpass_noise(t, 1500, 4200, 0.006, 0.6)
    return finish(clack, 0.55)


def mosaic_return():
    t = timeline(0.07)
    soft = tone(t, 880, 1, 0.02, attack=0.001) + bandpass_noise(t, 900, 2400, 0.005, 0.35)
    return finish(soft, 0.34)


def glass(t, freq, amp=1.0):
    tremolo = 1 + 0.12 * np.sin(2 * np.pi * 6 * t)
    return amp * tremolo * partials(t, freq, [1, 2.76], [1, 0.18], [0.7, 0.25], attack=0.02)


def mosaic_solve():
    total = int(SR * 1.4)
    t = timeline(1.2)
    chord = [659.25, 830.61, 987.77, 1318.51]
    out = np.zeros(total)
    for i, freq in enumerate(chord):
        out += at(glass(t, freq, 0.8 if i < 3 else 1.0), i * 0.045, total)
    return finish(out, 0.8)


# --- Adjacent: bubble pops -------------------------------------------------

def pop(t, low, high, amp=1.0):
    return tone(t, low, amp, 0.035, attack=0.001, glide_to=high, glide_time=0.025)


def adjacent_pop():
    t = timeline(0.07)
    return finish(pop(t, 400, 900), 0.5)


def adjacent_combo():
    total = int(SR * 0.34)
    t = timeline(0.3)
    out = at(pop(t, 600, 1200), 0, total) + at(pop(t, 900, 1800, 0.9), 0.045, total)
    out += at(partials(t, 2093, [1, 2.0], [0.5, 0.15], [0.18, 0.08]), 0.09, total)
    return finish(out, 0.75)


def adjacent_solve():
    total = int(SR * 0.8)
    t = timeline(0.6)
    out = np.zeros(total)
    for i, (low, high) in enumerate([(500, 1000), (660, 1320), (800, 1600), (1000, 2000)]):
        out += at(pop(t, low, high, 0.8), i * 0.06, total)
    for freq in (1046.5, 1318.51, 1567.98):
        out += at(partials(t, freq, [1, 2.0], [0.45, 0.12], [0.35, 0.15]), 0.26, total)
    return finish(out, 0.85)


SOUNDS = {
    'sfx_bridges_build': bridges_build,
    'sfx_bridges_remove': bridges_remove,
    'sfx_bridges_island': bridges_island,
    'sfx_bridges_blocked': bridges_blocked,
    'sfx_bridges_solve': bridges_solve,
    'sfx_bloom_turn': bloom_turn,
    'sfx_bloom_close': bloom_close,
    'sfx_bloom_solve': bloom_solve,
    'sfx_mosaic_pickup': mosaic_pickup,
    'sfx_mosaic_place': mosaic_place,
    'sfx_mosaic_return': mosaic_return,
    'sfx_mosaic_solve': mosaic_solve,
    'sfx_adjacent_pop': adjacent_pop,
    'sfx_adjacent_combo': adjacent_combo,
    'sfx_adjacent_solve': adjacent_solve,
}


def write(path, signal):
    data = (np.clip(signal, -1, 1) * 32767).astype('<i2').tobytes()
    with wave.open(path, 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SR)
        out.writeframes(data)


if __name__ == '__main__':
    for name, make in SOUNDS.items():
        signal = make()
        for directory in OUT_DIRS:
            write(os.path.join(directory, f'{name}.wav'), signal)
        print(f'{name}.wav  {len(signal) / SR:.2f}s  peak {np.abs(signal).max():.2f}  rms {np.sqrt((signal ** 2).mean()):.3f}')
