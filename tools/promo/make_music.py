"""An original 100 bpm score for the Tessera promo, cut to its picture.

Stereo, 44.1 kHz. Intro (hook) -> riser -> drop at 2.4 s -> groove under the
fast cuts -> build -> impact on the logo at 16.8 s -> ring out.
Every hit the picture needs (whooshes on cuts, pops for the emblems, a
sparkle for the stars) is placed on the same clock as the edit.
"""
import sys
import wave

import numpy as np

SR = 44100
BPM = 100
BEAT = 60 / BPM
TOTAL = 26.4
N = int(SR * TOTAL)
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)
SEND = np.zeros(N)  # reverb send (mono)


def t_of(seconds):
    return np.arange(int(SR * seconds)) / SR


def add(sig, at, pan=0.0, send=0.0, gain=1.0):
    i = int(at * SR)
    if i >= N:
        return
    n = min(len(sig), N - i)
    s = sig[:n] * gain
    L[i:i + n] += s * np.cos((pan + 1) * np.pi / 4) * 1.414
    R[i:i + n] += s * np.sin((pan + 1) * np.pi / 4) * 1.414
    SEND[i:i + n] += s * send


def note(name):
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + 12 * (octave - 4)) / 12)


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def bandnoise(seconds, lo, hi):
    n = int(SR * seconds)
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec[(f < lo) | (f > hi)] = 0
    out = np.fft.irfft(spec, n)
    return out / (np.abs(out).max() + 1e-9)


# --- Instruments ----------------------------------------------------------

def kick():
    t = t_of(0.45)
    freq = 46 + 110 * np.exp(-t * 28)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * np.exp(-t * 7.5)
    click = bandnoise(0.45, 2000, 8000) * np.exp(-t * 300) * 0.25
    return (body + click) * 0.95


def clap():
    t = t_of(0.4)
    n = bandnoise(0.4, 900, 6000)
    env = np.exp(-t * 20)
    for d in (0.010, 0.022):  # the clap's little flutter
        env += np.exp(-np.maximum(t - d, 0) * 60) * (t >= d) * 0.6
    tone = np.sin(2 * np.pi * 210 * t) * np.exp(-t * 25) * 0.3
    return (n * env + tone) * 0.42


def hat(open_=False):
    t = t_of(0.25 if open_ else 0.07)
    n = bandnoise(len(t) / SR, 7000, 16000)
    return n * np.exp(-t * (14 if open_ else 70)) * 0.16


def pluck(freq, ring=0.28):
    t = t_of(ring * 4)
    env = np.exp(-t / ring) * np.clip(t / 0.003, 0, 1)
    return env * (np.sin(2 * np.pi * freq * t) + 0.32 * np.sin(2 * np.pi * 2 * freq * t) + 0.08 * np.sin(2 * np.pi * 3 * freq * t)) * 0.22


def bass(freq, length):
    t = t_of(length)
    env = np.clip(t / 0.01, 0, 1) * np.exp(-t * 2.2)
    return (np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * 2 * freq * t)) * env * 0.38


def pad(freqs, length):
    t = t_of(length)
    env = np.clip(t / 0.5, 0, 1) * np.clip((length - t) / 0.6, 0, 1)
    l = np.zeros(len(t))
    r = np.zeros(len(t))
    for f in freqs:
        l += np.sin(2 * np.pi * f * 0.997 * t) + 0.3 * np.sin(2 * np.pi * 2 * f * 1.002 * t)
        r += np.sin(2 * np.pi * f * 1.003 * t + 0.7) + 0.3 * np.sin(2 * np.pi * 2 * f * 0.998 * t)
    return l * env * 0.05, r * env * 0.05


def riser(length):
    t = t_of(length)
    n = bandnoise(length, 300, 12000)
    sweep = np.sin(2 * np.pi * np.cumsum(220 + 1400 * (t / length) ** 2) / SR)
    env = (t / length) ** 2.2
    return (n * 0.5 + sweep * 0.25) * env * 0.5


def impact():
    t = t_of(2.4)
    freq = 38 + 90 * np.exp(-t * 9)
    boom = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 2.2)
    crash = bandnoise(2.4, 3000, 14000) * np.exp(-t * 3.0) * 0.35
    return (boom * 1.1 + crash) * 0.8


def whoosh(length=0.42):
    t = t_of(length)
    n = bandnoise(length, 400, 7000)
    env = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 2
    return n * env * 0.3


def pop(freq):
    t = t_of(0.18)
    f = freq * (1 + 0.6 * np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 26) * 0.22


def sparkle():
    out = np.zeros(int(SR * 1.4))
    for k, f in enumerate([note('E6'), note('G6'), note('B6'), note('E7'), note('G7')]):
        t = t_of(1.4 - k * 0.06)
        s = np.sin(2 * np.pi * f * t) * np.exp(-t * 4) * 0.08
        i = int(k * 0.06 * SR)
        n = min(len(s), len(out) - i)
        out[i:i + n] += s[:n]
    return out


# --- The arrangement ----------------------------------------------------

CHORDS = [  # one bar each: Am, F, C, G
    [note('A3'), note('C4'), note('E4')],
    [note('F3'), note('A3'), note('C4')],
    [note('C4'), note('E4'), note('G4')],
    [note('G3'), note('B3'), note('D4')],
]
ROOTS = [note('A2'), note('F2'), note('C3'), note('G2')]

DROP = 4 * BEAT          # 2.4 s
LOGO = 36 * BEAT         # 21.6 s
CUTS = [6, 8, 10, 12, 16, 20, 24, 28, 32]  # in beats: where the picture cuts

bars = int(np.ceil(TOTAL / (4 * BEAT)))
kick_times = []
for b in range(bars):
    start = b * 4 * BEAT
    chord = CHORDS[b % 4]
    pl, pr = pad(chord, 4 * BEAT + 0.6)
    i = int(start * SR)
    n = min(len(pl), N - i)
    if n > 0:
        L[i:i + n] += pl[:n]
        R[i:i + n] += pr[:n]
    # The music-box arpeggio, sixteenths, all the way through.
    arp = chord + [chord[0] * 2, chord[1] * 2]
    for s in range(16):
        at = start + s * BEAT / 4
        if at >= TOTAL - 0.4:
            break
        f = arp[[0, 2, 4, 1, 3, 2, 4, 0][s % 8]] * 2
        add(pluck(f), at, pan=(-0.45 if s % 2 else 0.45), send=0.35, gain=0.9 if s % 4 else 1.15)
    for beat in range(4):
        at = start + beat * BEAT
        groove = DROP <= at < LOGO
        if groove:
            kick_times.append(at)
            add(kick(), at, gain=1.0)
            add(bass(ROOTS[b % 4], BEAT * 0.9), at, gain=1.0)
            add(bass(ROOTS[b % 4] * 2, BEAT * 0.4), at + BEAT / 2, gain=0.5)
            if beat in (1, 3):
                add(clap(), at, send=0.5)
            add(hat(), at + BEAT / 2, pan=0.3)
            add(hat(), at + BEAT / 4, pan=-0.3, gain=0.5)
            add(hat(), at + 3 * BEAT / 4, pan=-0.3, gain=0.5)
        # A little hat lift in the intro, so it is not empty.
        if at < DROP and beat >= 2:
            add(hat(True), at + BEAT / 2, pan=0.2, gain=0.6)

# Sidechain: everything ducks a touch after each kick - the "pump".
duck = np.ones(N)
for k in kick_times:
    i = int(k * SR)
    t = t_of(0.32)
    n = min(len(t), N - i)
    duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.45 * np.exp(-t[:n] * 9))
L *= duck
R *= duck

# The moments the picture needs.
add(riser(DROP - 0.3), 0.3, send=0.2, gain=1.0)
add(impact(), DROP, send=0.6, gain=1.0)
for c in CUTS:
    add(whoosh(), c * BEAT - 0.22, pan=-0.4, send=0.2, gain=1.0)
for k in range(12):  # the twelve emblems, popping up the scale
    scale = [note('A4'), note('C5'), note('E5'), note('G5'), note('A5'), note('C6')]
    add(pop(scale[k % 6] * (2 if k >= 6 else 1)), 12 * BEAT + 0.15 + k * 0.1, pan=(k % 3 - 1) * 0.5, send=0.3)
add(sparkle(), 24 * BEAT + 0.35, send=0.7, gain=1.4)
add(riser(LOGO - 33 * BEAT), 33 * BEAT, send=0.2, gain=0.8)


def ching(freq):
    t = t_of(0.5)
    body = (np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * freq * 2.76 * t) + 0.25 * np.sin(2 * np.pi * freq * 5.4 * t))
    return body * np.exp(-t * 9) * np.clip(t / 0.002, 0, 1) * 0.12


# Coins landing in the purse, climbing; then the ad-free stamp.
for k in range(9):
    add(ching(note('E6') * 2 ** (k / 12 * 1.5)), 28 * BEAT + 0.25 + k * 0.16, pan=(k % 3 - 1) * 0.4, send=0.35)
add(impact()[: int(SR * 0.6)] * 0.5, 32 * BEAT + 1.45, send=0.4)
add(sparkle(), 32 * BEAT + 1.5, send=0.6, gain=1.0)
add(impact(), LOGO, send=0.8, gain=1.15)

# The app's own Glass Harp chime on the logo, if it is to hand.
if len(sys.argv) > 1:
    with wave.open(sys.argv[1]) as w:
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2') / 32768.0
    add(raw, LOGO + 0.25, send=0.4, gain=1.3)

# A soft hall on the send.
verb = np.zeros(N)
for delay, gain in [(0.043, 0.5), (0.067, 0.44), (0.091, 0.38), (0.127, 0.31), (0.181, 0.25), (0.247, 0.19), (0.331, 0.14), (0.433, 0.1), (0.571, 0.07)]:
    d = int(SR * delay)
    verb[d:] += SEND[:-d] * gain
verb = lowpass(verb, 5200)
L += verb * 0.55
R += np.roll(verb, int(SR * 0.011)) * 0.55

# Fade the tail, glue, and limit softly.
fade = np.clip((TOTAL - np.arange(N) / SR) / 1.2, 0, 1)
L *= fade
R *= fade
mix = np.stack([L, R], axis=1)
mix = np.tanh(mix * 0.8) / np.tanh(0.8)
mix = mix / np.abs(mix).max() * 0.92

with wave.open(sys.argv[2] if len(sys.argv) > 2 else 'promo_music.wav', 'wb') as out:
    out.setnchannels(2)
    out.setsampwidth(2)
    out.setframerate(SR)
    out.writeframes((mix * 32767).astype('<i2').tobytes())
print(f'{TOTAL}s, drop {DROP:.2f}s, logo {LOGO:.2f}s')
