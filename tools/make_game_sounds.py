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


# --- The core set, re-voiced (2026-09-30) ----------------------------------
# The first sounds in the app were plain sine beeps, several close to
# clipping; players found some of them grating. These replace them with
# the same softer, instrument-like voices as the four games above - wood,
# marimba, glass, a muted knock - kept well under full scale, and with the
# frequent ones (a drag step, a toggle) the quietest of all.

def marimba(t, freq, amp=1.0, ring=0.3):
    return amp * partials(t, freq, [1, 3.99, 9.2], [1, 0.12, 0.03], [ring, ring * 0.25, 0.02], attack=0.002)


def run(notes, gap, ring, total, voice=marimba, last_ring=None):
    t = timeline(total)
    out = np.zeros(len(t))
    for i, f in enumerate(notes):
        r = last_ring if (last_ring and i == len(notes) - 1) else ring
        out += at(voice(t, f, 0.8 if i < len(notes) - 1 else 1.0, r), i * gap, len(t))
    return out


def soft_knock(t, freq, amp=1.0):
    return amp * (partials(t, freq, [1, 2.2], [1, 0.25], [0.035, 0.018]) + bandpass_noise(t, 150, 700, 0.008, 0.3))


def knock_pair(freq, peak):
    total = int(SR * 0.2)
    t = timeline(0.1)
    return finish(at(soft_knock(t, freq), 0, total) + at(soft_knock(t, freq * 0.94, 0.7), 0.07, total), peak)


def tick(freq, peak, dur=0.05, decay=0.014, noise=0.25):
    t = timeline(dur)
    return finish(tone(t, freq, 1, decay, attack=0.001) + bandpass_noise(t, 400, 1800, 0.004, noise), peak)


def chime(freq, peak, ring=0.28, dur=0.4):
    t = timeline(dur)
    return finish(partials(t, freq, [1, 2.0, 3.0], [1, 0.3, 0.1], [ring, ring * 0.5, ring * 0.3]), peak)


def glass(t, freq, amp=1.0, ring=0.35):
    return amp * partials(t, freq, [1, 2.76, 5.4], [1, 0.2, 0.06], [ring, ring * 0.4, 0.05], attack=0.002)


C5, D5, E5, G5, A5, C6, E6, G6 = 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1318.5, 1568.0

CORE = {
    # UI and shared
    'sfx_tap': lambda: tick(620, 0.18, dur=0.04, decay=0.01, noise=0.2),
    'sfx_step': lambda: tick(700, 0.18, dur=0.04, decay=0.012, noise=0.1),
    'sfx_move': lambda: finish(tone(timeline(0.14), 190, 1, 0.05) + bandpass_noise(timeline(0.14), 250, 1100, 0.03, 0.45), 0.36),
    'sfx_target': lambda: finish(marimba(timeline(0.4), G5, 1, 0.28), 0.5),
    'sfx_solve': lambda: finish(run([C5, E5, G5, C6], 0.075, 0.3, 0.8, last_ring=0.45), 0.62),
    'sfx_fail': lambda: finish(run([392.0, 293.66], 0.12, 0.18, 0.45, voice=lambda t, f, a, r: soft_knock(t, f, a)), 0.42),
    # Arukone+
    'sfx_arukone_step': lambda: tick(523, 0.16, dur=0.05, decay=0.016, noise=0.08),
    'sfx_arukone_join': lambda: finish(run([E5, A5], 0.06, 0.2, 0.35), 0.45),
    'sfx_arukone_reject': lambda: knock_pair(170, 0.34),
    'sfx_arukone_solve': lambda: finish(run([D5, G5, A5, D5 * 2], 0.07, 0.28, 0.75, last_ring=0.42), 0.62),
    # Binairo
    'sfx_binairo_toggle': lambda: tick(330, 0.22, dur=0.05, decay=0.018, noise=0.3),
    'sfx_binairo_error': lambda: knock_pair(180, 0.32),
    'sfx_binairo_row_balance': lambda: chime(988, 0.36, ring=0.22, dur=0.32),
    'sfx_binairo_solve': lambda: finish(run([E5, G5, C6, E6], 0.07, 0.28, 0.75, last_ring=0.42), 0.62),
    # Fill-a-Pix
    'sfx_fillapix_toggle': lambda: tick(480, 0.2, dur=0.05, decay=0.014, noise=0.35),
    'sfx_fillapix_clue': lambda: chime(1175, 0.3, ring=0.18, dur=0.28),
    'sfx_fillapix_solve': lambda: finish(run([C5, E5, G5, C6], 0.07, 0.3, 0.8, last_ring=0.45), 0.62),
    # Lights Out
    'sfx_lightsout_tap': lambda: finish(marimba(timeline(0.12), 392.0, 1, 0.06), 0.3),
    'sfx_lightsout_darker': lambda: finish(marimba(timeline(0.14), 293.66, 1, 0.07), 0.28),
    'sfx_lightsout_solve': lambda: finish(run([G5 / 2, C5, E5, G5], 0.09, 0.35, 0.9, last_ring=0.5), 0.62),
    # Mirror Maze
    'sfx_mirror_place': lambda: finish(glass(timeline(0.08), G6, 1, 0.03), 0.2),
    'sfx_mirror_gem': lambda: finish(glass(timeline(0.45), E6, 1, 0.3), 0.42),
    'sfx_mirror_solve': lambda: finish(run([E5, G5, C6, E6], 0.08, 0.35, 0.95, voice=glass, last_ring=0.5), 0.6),
    # Tents and Trees
    'sfx_tents_plant': lambda: finish(soft_knock(timeline(0.1), 200), 0.3),
    'sfx_tents_error': lambda: knock_pair(160, 0.32),
    'sfx_tents_row_complete': lambda: finish(run([E5, A5], 0.07, 0.25, 0.45), 0.42),
    'sfx_tents_solve': lambda: finish(run([C5, D5, G5, C6], 0.075, 0.3, 0.8, last_ring=0.45), 0.62),
    # Skyscrapers
    'sfx_towers_place': lambda: finish(soft_knock(timeline(0.09), 247), 0.3),
    'sfx_towers_conflict': lambda: knock_pair(175, 0.32),
    'sfx_towers_row_complete': lambda: finish(run([G5, C6], 0.07, 0.25, 0.45), 0.42),
    'sfx_towers_solve': lambda: finish(run([G5 / 2, C5, E5, G5, C6], 0.07, 0.3, 0.9, last_ring=0.45), 0.62),
    # The break's maze: a soft felt thud on a wall, not a crack.
    'sfx_ink_trail_contact': lambda: finish(tone(timeline(0.12), 120, 1, 0.04) + bandpass_noise(timeline(0.12), 80, 500, 0.02, 0.4), 0.32),
    'sfx_ink_trail_solve': lambda: finish(run([C5, E5, G5, C6, E6], 0.09, 0.35, 1.0, last_ring=0.5), 0.55),
    # New UI voices: a page turned (tabs), and a coin (claims, purchases).
    'sfx_ui_page': lambda: finish(bandpass_noise(timeline(0.12), 500, 3000, 0.035, 1.0) * np.clip(timeline(0.12) / 0.02, 0, 1), 0.16),
    'sfx_coin': lambda: finish(run([E6, G6 * 1.335], 0.06, 0.18, 0.4, voice=glass), 0.4),
}

# The newer games' voices, re-levelled to sit with the core set.
SOUNDS.update({
    'sfx_bridges_solve': lambda: bridges_solve() * (0.62 / 0.9),
    'sfx_bloom_solve': lambda: bloom_solve() * (0.62 / 0.85),
    'sfx_mosaic_solve': lambda: mosaic_solve() * (0.62 / 0.8),
    'sfx_adjacent_solve': lambda: adjacent_solve() * (0.62 / 0.85),
    'sfx_adjacent_combo': lambda: adjacent_combo() * (0.5 / 0.75),
    'sfx_bridges_blocked': lambda: bridges_blocked() * (0.4 / 0.7),
    'sfx_bridges_island': lambda: bridges_island() * (0.45 / 0.62),
    'sfx_mosaic_pickup': lambda: mosaic_pickup() * (0.22 / 0.34),
    # The frequent ones, quieter still: heard dozens of times a board.
    'sfx_bridges_build': lambda: bridges_build() * (0.42 / 0.6),
    'sfx_bloom_turn': lambda: bloom_turn() * (0.28 / 0.38),
    'sfx_bloom_close': lambda: bloom_close() * (0.45 / 0.65),
    'sfx_adjacent_pop': lambda: adjacent_pop() * (0.36 / 0.5),
    'sfx_mosaic_place': lambda: mosaic_place() * (0.4 / 0.55),
})
SOUNDS.update(CORE)


# --- Premium finishes (2026-10-01) ------------------------------------------
# Players found the finish chimes, the row-complete sounds and Mosaic's
# set "noisy". These are a music box in a small room: soft sine tones with
# a gentle attack (no click), only a whisper of the octave above, and a
# short reverb so each note blooms and fades instead of ringing hard.

def musicbox(t, freq, amp=1.0, ring=0.7):
    env = np.exp(-t / ring) * np.clip(t / 0.012, 0, 1)
    return amp * env * (np.sin(2 * np.pi * freq * t) + 0.12 * np.sin(2 * np.pi * 2 * freq * t) + 0.03 * np.sin(2 * np.pi * 3 * freq * t))


def room(signal, mix=0.28):
    """A small, warm room: a handful of decaying echoes, softened."""
    out = signal.copy()
    for delay, gain in [(0.023, 0.5), (0.037, 0.42), (0.053, 0.35), (0.071, 0.28), (0.097, 0.2), (0.131, 0.14)]:
        d = int(SR * delay)
        echo = np.zeros_like(signal)
        echo[d:] = signal[:-d] * gain
        out += echo * mix
    # A gentle low-pass: average with the previous sample, twice.
    for _ in range(2):
        out[1:] = 0.5 * (out[1:] + out[:-1])
    return out


def arpeggio(notes, gap=0.095, ring=0.75, tail=0.9, peak=0.42, last_ring=1.1):
    total = int(SR * (gap * len(notes) + tail))
    t = timeline(gap * len(notes) + tail)
    out = np.zeros(total)
    for i, f in enumerate(notes):
        r = last_ring if i == len(notes) - 1 else ring
        out += at(musicbox(t, f, 0.75 if i < len(notes) - 1 else 0.9, r), i * gap, total)
    return finish(room(out), peak)


def two_note(a, b, peak=0.28):
    total = int(SR * 0.6)
    t = timeline(0.6)
    out = at(musicbox(t, a, 0.8, 0.35), 0, total) + at(musicbox(t, b, 0.9, 0.45), 0.075, total)
    return finish(room(out, 0.22), peak)


F4, A4, B4, FS5 = 349.23, 440.0, 493.88, 739.99
PREMIUM = {
    # Finishes: each game its own key and shape, all gentle.
    'sfx_solve': lambda: arpeggio([C5, E5, G5, C6]),
    'sfx_binairo_solve': lambda: arpeggio([E5, G5, B4 * 2, E6]),
    'sfx_towers_solve': lambda: arpeggio([392.0, B4, D5, G5]),
    'sfx_tents_solve': lambda: arpeggio([F4, A4, C5, F4 * 2]),
    'sfx_arukone_solve': lambda: arpeggio([D5, FS5, A5, D5 * 2]),
    'sfx_fillapix_solve': lambda: arpeggio([C5, D5, G5, C6]),
    'sfx_lightsout_solve': lambda: arpeggio([A4, C5, E5, A5], gap=0.11),
    'sfx_mirror_solve': lambda: arpeggio([E5, A5, B4 * 2, E6]),
    'sfx_bloom_solve': lambda: arpeggio([G5, A5, D5 * 2, E6]),
    'sfx_mosaic_solve': lambda: arpeggio([C5, G5, E6, G6], gap=0.11),
    'sfx_bridges_solve': lambda: arpeggio([D5, FS5, A5, D5 * 2]),
    'sfx_adjacent_solve': lambda: arpeggio([F4 * 2, A5, C6, F4 * 4]),
    'sfx_ink_trail_solve': lambda: arpeggio([C5, E5, G5, B4 * 2, C6], gap=0.1, peak=0.38),
    # A line finished: two soft rising notes, quieter than a finish.
    'sfx_binairo_row_balance': lambda: two_note(G5, B4 * 2),
    'sfx_towers_row_complete': lambda: two_note(E5, G5),
    'sfx_tents_row_complete': lambda: two_note(D5, FS5),
    # Mosaic: felt and porcelain, barely there.
    'sfx_mosaic_pickup': lambda: finish(tone(timeline(0.05), 1568, 1, 0.012, attack=0.003), 0.1),
    'sfx_mosaic_place': lambda: finish(room(tone(timeline(0.18), 523.25, 1, 0.04, attack=0.002) + tone(timeline(0.18), 1046.5, 0.18, 0.025, attack=0.002), 0.18), 0.26),
    'sfx_mosaic_return': lambda: finish(tone(timeline(0.08), 392.0, 1, 0.03, attack=0.002), 0.16),
    # A tab turned: the faintest tick.
    'sfx_ui_page': lambda: finish(tone(timeline(0.04), 1320, 1, 0.008, attack=0.002), 0.08),
}
SOUNDS.update(PREMIUM)


# --- Solve chimes, sold in the shop (2026-10-01) ------------------------------
# Each replaces every game's finish when worn, so each is one complete,
# pleasant gesture at the same loudness as the finishes above.

def kalimba_note(t, f):
    return partials(t, f, [1, 4.2, 9.1], [1, 0.22, 0.06], [0.55, 0.11, 0.04], attack=0.002)


def chime_kalimba():
    notes = [392.0, B4, D5, G5]
    total = int(SR * 1.5)
    t = timeline(1.5)
    out = np.zeros(total)
    for i, f in enumerate(notes):
        out += at(kalimba_note(t, f) * (0.8 if i < 3 else 1.0), i * 0.11, total)
    return finish(room(out, 0.3), 0.42)


def chime_wind():
    rng = np.random.default_rng(7)
    notes = [C5 * 2, D5 * 2, E5 * 2, G5 * 2, A5 * 2, E5 * 2, C5 * 4]
    total = int(SR * 2.4)
    t = timeline(2.4)
    out = np.zeros(total)
    when = 0.0
    for f in notes:
        out += at(partials(t, f, [1, 2.76, 5.4], [1, 0.4, 0.15], [1.1, 0.5, 0.2], attack=0.002) * rng.uniform(0.45, 0.8), when, total)
        when += rng.uniform(0.07, 0.16)
    return finish(room(out, 0.35), 0.38)


def chime_bell():
    t = timeline(3.0)
    f = 329.63
    hum = partials(t, f, [0.5, 1, 1.183, 1.506, 2.0, 2.514], [0.5, 1, 0.45, 0.3, 0.25, 0.12], [2.6, 2.0, 1.4, 1.0, 0.7, 0.4], attack=0.004)
    beat = partials(t, f * 1.0021, [1], [0.35], [2.0], attack=0.004)
    return finish(room(hum + beat, 0.3), 0.42)


def chime_harp():
    t = timeline(2.2)
    out = np.zeros(len(t))
    for i, f in enumerate([E5, 830.61, B4 * 2, E6]):
        start = i * 0.09
        tt = np.clip(t - start, 0, None)
        env = np.clip(tt / 0.09, 0, 1) * np.exp(-tt / 0.9) * (t >= start)
        out += env * (np.sin(2 * np.pi * f * tt) + 0.08 * np.sin(2 * np.pi * 2 * f * tt)) * (1 + 0.04 * np.sin(2 * np.pi * 5.2 * tt)) * (0.7 if i < 3 else 0.9)
    return finish(room(out, 0.3), 0.4)


def chime_patron():
    """A small peal of gilded bells: three bright bell notes, then the
    low bell under them."""
    total = int(SR * 2.8)
    t = timeline(2.8)
    out = np.zeros(total)
    for i, f in enumerate([G5, E5, C5]):
        out += at(partials(t, f, [1, 2.0, 2.76, 5.4], [1, 0.35, 0.3, 0.1], [0.9, 0.6, 0.4, 0.15], attack=0.002) * 0.7, i * 0.16, total)
    out += at(partials(t, C5 / 2, [1, 2.0, 2.4, 3.0], [1, 0.4, 0.25, 0.15], [1.8, 1.2, 0.8, 0.5], attack=0.003) * 0.9, 0.5, total)
    return finish(room(out, 0.32), 0.42)


CHIMES = {
    'sfx_chime_patron': chime_patron,
    'sfx_chime_kalimba': chime_kalimba,
    'sfx_chime_wind': chime_wind,
    'sfx_chime_bell': chime_bell,
    'sfx_chime_harp': chime_harp,
}
SOUNDS.update(CHIMES)


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
