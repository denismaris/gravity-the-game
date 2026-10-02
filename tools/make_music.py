"""The almanac's ambient loop: a quiet music box over a soft pad.

Writes `music_almanac.m4a` (AAC) for iOS and Android. Seamless: the piece
is rendered with its reverb tail, and the tail is folded back onto the
start, so the end flows into the beginning with no click or gap.

    python3 tools/make_music.py
"""
import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100
BAR = 4.0  # seconds: four beats at 60 bpm
# Four chords, each held two bars, played through twice with the melody
# varied on the repeat: 16 bars, 64 seconds.
CHORDS = [
    [174.61, 220.00, 261.63, 329.63],  # Fmaj7
    [220.00, 261.63, 329.63, 392.00],  # Am7
    [146.83, 174.61, 220.00, 261.63],  # Dm7
    [196.00, 246.94, 293.66, 392.00],  # G (with the octave)
]
# The melody's notes: C major pentatonic, two octaves up.
SCALE = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51]
LOOP = BAR * 2 * len(CHORDS) * 2
TAIL = 6.0


def t_of(seconds):
    return np.arange(int(SR * seconds)) / SR


def place(out, signal, at):
    i = int(SR * at)
    n = min(len(signal), len(out) - i)
    out[i:i + n] += signal[:n]


def musicbox(freq, amp, ring=1.6):
    t = t_of(ring * 4)
    env = np.exp(-t / ring) * np.clip(t / 0.01, 0, 1)
    tone = np.sin(2 * np.pi * freq * t) + 0.1 * np.sin(2 * np.pi * 2 * freq * t) + 0.025 * np.sin(2 * np.pi * 3 * freq * t)
    return amp * env * tone


def pad(freqs, seconds):
    """A slow swell and fade: each chord tone with a slightly detuned twin,
    so the pad breathes instead of droning."""
    t = t_of(seconds + 2.5)
    env = np.clip(t / 1.8, 0, 1) * np.clip((seconds + 2.5 - t) / 2.5, 0, 1)
    out = np.zeros(len(t))
    for f in freqs:
        out += np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * f * 1.003 * t + 1.3)
    return out * env / len(freqs)


def bass(freq, seconds):
    t = t_of(seconds)
    env = np.clip(t / 0.08, 0, 1) * np.exp(-t / 2.4)
    return env * np.sin(2 * np.pi * freq / 2 * t)


def hall(signal):
    """A soft, long room: spaced echoes that fade, then a gentle low-pass."""
    out = signal.copy()
    for delay, gain in [(0.031, 0.42), (0.047, 0.38), (0.071, 0.33), (0.113, 0.28), (0.167, 0.22), (0.241, 0.17), (0.331, 0.12), (0.457, 0.08)]:
        d = int(SR * delay)
        echo = np.zeros_like(signal)
        echo[d:] = signal[:-d] * gain
        out += echo
    for _ in range(3):
        out[1:] = 0.5 * (out[1:] + out[:-1])
    return out


def compose():
    rng = np.random.default_rng(1203)
    total = int(SR * (LOOP + TAIL))
    pads = np.zeros(total)
    lows = np.zeros(total)
    melody = np.zeros(total)
    for rep in range(2):
        for c, chord in enumerate(CHORDS):
            start = (rep * len(CHORDS) + c) * BAR * 2
            place(pads, pad(chord, BAR * 2), start)
            place(lows, bass(chord[0], BAR * 2), start)
            # Sparse notes: about half the beats sound, never two
            # adjacent high leaps, the chord's own tones favoured.
            last = None
            for beat in range(8):
                if rng.random() < (0.42 if rep == 0 else 0.55):
                    continue
                candidates = [f for f in SCALE if any(abs(np.log2(f / (n * 4))) < 0.02 or abs(np.log2(f / (n * 2))) < 0.02 for n in chord)] or SCALE
                pool = candidates if rng.random() < 0.7 else SCALE
                note = pool[rng.integers(len(pool))]
                if last is not None and abs(np.log2(note / last)) > 0.9:
                    note = last
                last = note
                swing = rng.uniform(-0.03, 0.03)
                place(melody, musicbox(note, rng.uniform(0.45, 0.7)), start + beat * 1.0 + swing)
                # Now and then, a quiet answer an octave down.
                if rng.random() < 0.18:
                    place(melody, musicbox(note / 2, 0.3, ring=2.2), start + beat * 1.0 + 0.5)
    mix = 0.55 * pads + 0.35 * lows + 0.5 * melody
    mix = hall(mix)
    # Fold the tail onto the start: the loop point is seamless.
    loop = mix[: int(SR * LOOP)].copy()
    tail = mix[int(SR * LOOP):]
    loop[: len(tail)] += tail
    loop -= loop.mean()
    return loop / np.abs(loop).max() * 0.6


def main():
    signal = compose()
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, 'music.wav')
        with wave.open(wav, 'wb') as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(SR)
            out.writeframes((np.clip(signal, -1, 1) * 32767).astype('<i2').tobytes())
        for directory in ['ios/GravityInit/Sounds', 'android/app/src/main/res/raw']:
            target = os.path.join(directory, 'music_almanac.m4a')
            subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '96000', wav, target], check=True)
            print(target, os.path.getsize(target) // 1024, 'KB')
    print(f'{LOOP:.0f}s loop, peak 0.60')


if __name__ == '__main__':
    main()
