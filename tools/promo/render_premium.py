"""Tessera promo, take two: a motion-graphics cut rendered frame by frame.

Inputs in tools/promo/work: cfr/<scene>.mp4 (see record.sh), emblems.png
(the twelve GameEmblems on #15101B, 3 across), adfree_off.png and
adfree_on.png (Shop > Boosts, scrolled to the Ad-free card), and the score
from make_music.py (loudness-normalised to -14 LUFS).

21 s, 1080x1920, 30 fps, cut to a 100 bpm score (beat = 0.6 s). Every frame
is composed here - living background, close-up boards with bloom, kinetic
type, whip pans with motion blur, a 3D-tilted phone, sparkles, a logo with
a light sweep - and piped straight into ffmpeg.
"""
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work')
CFR = os.path.join(HERE, 'cfr')
REPO = '/Users/marisdenis/DEV/gravity-the-game'
W, H, FPS = 1080, 1920, 30
TOTAL = 26.0
LOGO_T = 21.6
BEAT = 0.6

INK = (21, 16, 27)
CREAM = (242, 232, 212)
GOLD = (233, 186, 92)
GEORGIA_BOLD = '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
MONO = '/System/Library/Fonts/SFNSMono.ttf'
SANS = '/System/Library/Fonts/SFNS.ttf'

ACCENT = {
    'mirror': (92, 150, 214),
    'mosaic': (222, 120, 70),
    'gravity': (226, 132, 82),
    'bloom': (226, 120, 150),
    'lights': (130, 140, 230),
    'gold': GOLD,
    'plum': (120, 80, 170),
}

rng = np.random.default_rng(11)


# --- Easing ---------------------------------------------------------------

def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_in_out(x):
    x = clamp(x)
    return 3 * x * x - 2 * x * x * x


def back_out(x, s=1.7):
    x = clamp(x)
    return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2


# --- Source footage -------------------------------------------------------

def load_clip(name, start, end, n, crop, size):
    """`n` frames spanning [start, end] of a recording, cropped (x, y, w, h)
    and scaled to `size`, as PIL images."""
    x, y, w, h = crop
    tw, th = size
    span = end - start + 0.1
    cmd = ['ffmpeg', '-v', 'error', '-ss', f'{start:.3f}', '-i', os.path.join(CFR, f'{name}.mp4'), '-t', f'{span:.3f}',
           '-vf', f'crop={w}:{h}:{x}:{y},scale={tw}:{th}:flags=lanczos', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, th, tw, 3)
    out = []
    for i in range(n):
        t = (end - start) * (i / max(1, n - 1))
        idx = min(len(frames) - 1, int(round(t * 30)))
        out.append(Image.fromarray(frames[idx]))
    return out


# --- Cached drawing pieces ----------------------------------------------

_cache = {}


def cached(key, make):
    if key not in _cache:
        _cache[key] = make()
    return _cache[key]


def blob(color, radius):
    def make():
        blur = radius * 0.45
        pad = int(blur * 3)
        size = radius * 2 + pad * 2
        a = Image.new('L', (size, size), 0)
        ImageDraw.Draw(a).ellipse([pad, pad, pad + radius * 2, pad + radius * 2], fill=255)
        a = a.filter(ImageFilter.GaussianBlur(blur))
        img = Image.new('RGBA', (size, size), color + (0,))
        img.putalpha(a.point(lambda v: int(v * 0.55)))
        return img
    return cached(('blob', color, radius), make)


def rounded_mask(w, h, r):
    def make():
        m = Image.new('L', (w * 2, h * 2), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, w * 2 - 1, h * 2 - 1], r * 2, fill=255)
        return m.resize((w, h), Image.LANCZOS)
    return cached(('mask', w, h, r), make)


def shadow(w, h, r, strength=190, blur=46, drop=34):
    def make():
        pad = blur * 2 + 20
        s = Image.new('L', (w + pad * 2, h + pad * 2), 0)
        ImageDraw.Draw(s).rounded_rectangle([pad, pad + drop, pad + w, pad + h + drop], r, fill=strength)
        s = s.filter(ImageFilter.GaussianBlur(blur))
        img = Image.new('RGBA', s.size, (0, 0, 0, 0))
        img.putalpha(s)
        return img, pad
    return cached(('shadow', w, h, r, strength, blur, drop), make)


def aura(w, h, r, color):
    """A soft glow of the game's colour around a card."""
    def make():
        pad = 140
        s = Image.new('L', (w + pad * 2, h + pad * 2), 0)
        ImageDraw.Draw(s).rounded_rectangle([pad - 10, pad - 10, pad + w + 10, pad + h + 10], r + 10, fill=120)
        s = s.filter(ImageFilter.GaussianBlur(70))
        img = Image.new('RGBA', s.size, color + (0,))
        img.putalpha(s)
        return img, pad
    return cached(('aura', w, h, r, color), make)


def text_img(text, path, size, color, tracking=0):
    def make():
        f = ImageFont.truetype(path, size)
        d = ImageDraw.Draw(Image.new('RGBA', (10, 10)))
        width = sum(d.textlength(ch, font=f) for ch in text) + tracking * max(0, len(text) - 1)
        asc, desc = f.getmetrics()
        img = Image.new('RGBA', (int(width) + 8, asc + desc + 8), (0, 0, 0, 0))
        dr = ImageDraw.Draw(img)
        x = 4
        for ch in text:
            dr.text((x, 4), ch, font=f, fill=color)
            x += dr.textlength(ch, font=f) + tracking
        return img
    return cached(('text', text, path, size, color, tracking), make)


def sparkle_sprite(size, color):
    def make():
        s = size * 4
        img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        c = s / 2
        r = s * 0.48
        w = s * 0.07
        d.polygon([(c, c - r), (c + w, c - w), (c + r, c), (c + w, c + w), (c, c + r), (c - w, c + w), (c - r, c), (c - w, c - w)], fill=color + (255,))
        glow = img.filter(ImageFilter.GaussianBlur(s * 0.08))
        out = Image.alpha_composite(glow, img)
        return out.resize((size, size), Image.LANCZOS)
    return cached(('sparkle', size, color), make)


GRAIN = [Image.fromarray(np.uint8(np.clip(128 + rng.normal(0, 7, (H // 2, W // 2)), 0, 255))).resize((W, H)) for _ in range(4)]


def vignette():
    def make():
        y, x = np.mgrid[0:H, 0:W]
        d = np.sqrt(((x - W / 2) / (W * 0.75)) ** 2 + ((y - H / 2) / (H * 0.7)) ** 2)
        return np.clip(1 - 0.42 * d ** 2.2, 0.45, 1)[..., None]
    return cached('vignette', make)


# --- Layers ---------------------------------------------------------------

def background(t, colors):
    """Ink, with three soft colour fields drifting slowly across it."""
    img = Image.new('RGBA', (W, H), INK + (255,))
    for k, color in enumerate(colors):
        r = 520 - k * 60
        b = blob(color, r)
        cx = W * (0.5 + 0.32 * math.sin(t * 0.35 + k * 2.1))
        cy = H * (0.42 + 0.22 * math.cos(t * 0.28 + k * 1.7))
        img.alpha_composite(b, (int(cx - b.width / 2), int(cy - b.height / 2)))
    return img


def bloom(card, amount=0.55):
    """Light that glows: the bright parts, blurred and added back."""
    small = card.resize((card.width // 4, card.height // 4), Image.BILINEAR)
    lum = small.convert('L').point(lambda v: 0 if v < 150 else min(255, (v - 150) * 3))
    bright = Image.composite(small, Image.new('RGB', small.size, (0, 0, 0)), lum)
    glow = bright.filter(ImageFilter.GaussianBlur(9)).resize(card.size, Image.BILINEAR)
    return ImageChops.add(card, glow.point(lambda v: int(v * amount)))


def place_card(frame, card, cx, cy, scale, accent, radius=46, glow=True):
    w, h = int(card.width * scale), int(card.height * scale)
    c = card.resize((w, h), Image.BILINEAR) if scale != 1 else card
    if glow:
        c = bloom(c.convert('RGB'))
    x, y = int(cx - w / 2), int(cy - h / 2)
    a, pad = aura(w, h, radius, accent)
    frame.alpha_composite(a, (x - pad, y - pad))
    s, spad = shadow(w, h, radius)
    frame.alpha_composite(s, (x - spad, y - spad))
    rgba = c.convert('RGBA')
    rgba.putalpha(rounded_mask(w, h, radius))
    frame.alpha_composite(rgba, (x, y))
    rim = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(rim).rounded_rectangle([1, 1, w - 2, h - 2], radius, outline=accent + (150,), width=3)
    frame.alpha_composite(rim, (x, y))


def perspective(img, angle_deg, depth=0.22):
    """Turns a flat image about its vertical axis: the far edge shrinks."""
    w, h = img.size
    a = math.radians(angle_deg)
    shrink = depth * math.sin(abs(a))
    squeeze = math.cos(a)
    nw = int(w * squeeze)
    if angle_deg >= 0:  # right edge further away
        dst = [(0, 0), (nw, h * shrink / 2), (nw, h * (1 - shrink / 2)), (0, h)]
    else:
        dst = [(0, h * shrink / 2), (nw, 0), (nw, h), (0, h * (1 - shrink / 2))]
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    A, B = [], []
    for (xd, yd), (xs, ys) in zip(dst, src):
        A.append([xd, yd, 1, 0, 0, 0, -xs * xd, -xs * yd])
        A.append([0, 0, 0, xd, yd, 1, -ys * xd, -ys * yd])
        B += [xs, ys]
    coeffs = np.linalg.solve(np.array(A, dtype=float), np.array(B, dtype=float))
    return img.transform((nw, h), Image.PERSPECTIVE, tuple(coeffs), Image.BICUBIC)


def kinetic(frame, words, t, start, y, size=118, colors=None, gap=0.18):
    """Words that rise into place one after another, each with a tiny
    overshoot, centred as a line."""
    imgs = [text_img(wd, GEORGIA_BOLD, size, (colors or [CREAM] * len(words))[i]) for i, wd in enumerate(words)]
    space = size * 0.28
    total = sum(i.width for i in imgs) + space * (len(imgs) - 1)
    x = (W - total) / 2
    for k, im in enumerate(imgs):
        p = (t - start - k * gap) / 0.32
        if p > 0:
            e = back_out(p, 1.4)
            dy = (1 - e) * 70
            alpha = clamp(p * 1.6)
            layer = im.copy()
            if alpha < 1:
                layer.putalpha(layer.getchannel('A').point(lambda v: int(v * alpha)))
            frame.alpha_composite(layer, (int(x), int(y + dy)))
        x += im.width + space


def kicker(frame, text, t, start, y, color):
    im = text_img(text, MONO, 34, color, tracking=9)
    p = clamp((t - start) / 0.4)
    if p <= 0:
        return
    layer = im.copy()
    layer.putalpha(layer.getchannel('A').point(lambda v: int(v * p)))
    frame.alpha_composite(layer, (int((W - im.width) / 2), int(y + (1 - ease_out(p)) * 20)))


class Sparkles:
    """Gold sparks thrown from a point, falling and fading."""

    def __init__(self):
        self.bursts = []

    def burst(self, at, x, y, count=26, spread=520, color=GOLD):
        parts = []
        for _ in range(count):
            ang = rng.uniform(0, 2 * math.pi)
            spd = rng.uniform(0.35, 1.0) * spread
            parts.append((math.cos(ang) * spd, math.sin(ang) * spd - 180, rng.uniform(16, 38), rng.uniform(0.7, 1.3)))
        self.bursts.append((at, x, y, parts, color))

    def draw(self, frame, t):
        for at, x, y, parts, color in self.bursts:
            age = t - at
            if age < 0 or age > 1.4:
                continue
            for vx, vy, size, life in parts:
                a = age / life
                if a >= 1:
                    continue
                px = x + vx * age
                py = y + vy * age + 420 * age * age
                sp = sparkle_sprite(int(size * (1 - 0.4 * a)), color)
                layer = sp.copy()
                layer.putalpha(layer.getchannel('A').point(lambda v, a=a: int(v * (1 - a) ** 1.3)))
                frame.alpha_composite(layer, (int(px - sp.width / 2), int(py - sp.height / 2)))


# --- The cut ----------------------------------------------------------------

def card_frames(name, src, crop, n, width=940):
    x, y, w, h = crop
    th = int(width * h / w)
    return load_clip(name, src[0], src[1], n, crop, (width, th))


SECTIONS = []  # (start, end, render(frame, t, local))
sparkles = Sparkles()


def closeup_section(start, end, name, src, crop, kick, words, accent, word_colors=None, cy=1110, push=(1.06, 1.0)):
    n = int(round((end - start) * FPS)) + 1
    frames = card_frames(name, src, crop, n)

    def render(frame, t):
        local = t - start
        i = min(n - 1, int(local * FPS))
        p = local / (end - start)
        scale = push[0] + (push[1] - push[0]) * ease_out(p)
        place_card(frame, frames[i], W / 2, cy, scale, accent)
        kicker(frame, kick, t, start + 0.05, 250, accent)
        kinetic(frame, words, t, start + 0.08, 310, colors=word_colors)
    SECTIONS.append((start, end, render, [ACCENT['plum'], accent, (40, 30, 60)]))


def build():
    # A  0.0-2.4  Hook: Mirror Maze, beam building, slow push out.
    closeup_section(0.0, 2.4, 'mirror', (3.0, 7.2), (90, 840, 1030, 1040), 'MIRROR MAZE', ['Bend', 'the', 'light.'], ACCENT['mirror'],
                    word_colors=[CREAM, CREAM, (150, 196, 245)], push=(1.12, 1.0))
    sparkles.burst(2.05, W / 2 + 190, 1150, count=18, spread=420, color=(200, 225, 255))
    # B-E  Quick cuts on the drop.
    closeup_section(2.4, 3.6, 'mosaic', (3.4, 9.1), (100, 800, 1010, 1220), 'MOSAIC', ['Build.'], ACCENT['mosaic'], word_colors=[(245, 160, 110)])
    closeup_section(3.6, 4.8, 'gravity', (2.8, 7.6), (70, 700, 1066, 1300), 'GRAVITY', ['Slide.'], ACCENT['gravity'], word_colors=[(245, 170, 120)])
    closeup_section(4.8, 6.0, 'bloom', (2.8, 8.7), (90, 810, 1030, 1030), 'BLOOM', ['Bloom.'], ACCENT['bloom'], word_colors=[(245, 160, 190)])
    sparkles.burst(5.75, W / 2, 1110, count=22, spread=480, color=(255, 190, 210))
    closeup_section(6.0, 7.2, 'lights', (2.4, 5.0), (90, 810, 1030, 1030), 'LIGHTS OUT', ['Solve.'], ACCENT['lights'], word_colors=[(180, 190, 255)])

    # F  7.2-9.6  Twelve games, popping into a grid on the beat.
    sheet = Image.open(os.path.join(HERE, 'emblems.png')).convert('RGB')
    emblems = []
    for k in range(12):
        r, c = divmod(k, 3)
        cx, cy = 30 + 382 * (c + 0.5), 360 + 450 * (r + 0.5)
        tile = sheet.crop((int(cx - 172), int(cy - 172), int(cx + 172), int(cy + 172))).resize((236, 236), Image.LANCZOS).convert('RGBA')
        tile.putalpha(rounded_mask(236, 236, 52))
        emblems.append(tile)

    def emblems_render(frame, t):
        local = t - 7.2
        kinetic(frame, ['12', 'games.'], t, 7.25, 250, colors=[GOLD, CREAM], size=132)
        for k, tile in enumerate(emblems):
            at = 0.15 + k * 0.1
            p = (local - at) / 0.35
            if p <= 0:
                continue
            r, c = divmod(k, 3)
            s = back_out(p, 2.2)
            size = max(1, int(236 * s))
            im = tile.resize((size, size), Image.BILINEAR)
            x = W / 2 + (c - 1) * 290 - size / 2
            y = 640 + r * 290 - size / 2 + 118
            sh, pad = shadow(236, 236, 52, strength=150, blur=24, drop=16)
            if p >= 1:
                frame.alpha_composite(sh, (int(W / 2 + (c - 1) * 290 - 118 - pad), int(640 + r * 290 - pad)))
            frame.alpha_composite(im, (int(x), int(y)))
        kicker(frame, 'ONE ALMANAC', t, 8.75, 1830 - 60, GOLD)
    SECTIONS.append((7.2, 9.6, emblems_render, [ACCENT['plum'], ACCENT['gold'], ACCENT['mirror']]))
    for k in range(12):
        r, c = divmod(k, 3)
        if k in (2, 6, 11):
            sparkles.burst(7.2 + 0.15 + k * 0.1 + 0.2, W / 2 + (c - 1) * 290, 758 + r * 290, count=10, spread=260)

    # G  9.6-12.0  The phone, tilted, Home turning.
    phone_w = 640
    home = load_clip('home', 2.6, 8.4, int(2.4 * FPS) + 1, (0, 0, 1206, 2622), (phone_w, int(phone_w * 2622 / 1206)))

    def phone(frame, img, angle, cx, cy, accent):
        w, h = img.size
        rgba = img.convert('RGBA')
        rgba.putalpha(rounded_mask(w, h, 74))
        body = Image.new('RGBA', (w + 24, h + 24), (0, 0, 0, 0))
        ImageDraw.Draw(body).rounded_rectangle([0, 0, w + 23, h + 23], 86, fill=(30, 26, 38, 255), outline=(96, 84, 112, 255), width=3)
        body.alpha_composite(rgba, (12, 12))
        turned = perspective(body, angle)
        a, pad = aura(turned.width, turned.height, 80, accent)
        frame.alpha_composite(a, (int(cx - turned.width / 2 - pad), int(cy - turned.height / 2 - pad)))
        s, spad = shadow(turned.width, turned.height, 80, strength=200, blur=50, drop=50)
        frame.alpha_composite(s, (int(cx - turned.width / 2 - spad), int(cy - turned.height / 2 - spad)))
        frame.alpha_composite(turned, (int(cx - turned.width / 2), int(cy - turned.height / 2)))

    def home_render(frame, t):
        local = t - 9.6
        p = local / 2.4
        i = min(len(home) - 1, int(local * FPS))
        angle = 16 - 10 * ease_out(p)
        rise = (1 - ease_out(local / 0.6)) * 140
        phone(frame, home[i], angle, W / 2 + 30, 1300 + rise, ACCENT['gravity'])
        kicker(frame, 'EVERY DAY', t, 9.65, 210, (240, 162, 122))
        kinetic(frame, ['A', 'new', 'puzzle,'], t, 9.7, 270, size=104)
        kinetic(frame, ['every', 'day.'], t, 9.95, 390, size=104, colors=[CREAM, (240, 162, 122)])
    SECTIONS.append((9.6, 12.0, home_render, [ACCENT['gravity'], ACCENT['plum'], (60, 40, 70)]))

    # H  12.0-14.4  The leaderboard, the phone turned the other way, a #1 badge.
    board = load_clip('board', 2.95, 3.06, 2, (0, 0, 1206, 2622), (phone_w, int(phone_w * 2622 / 1206)))[1]

    def board_render(frame, t):
        local = t - 12.0
        p = local / 2.4
        angle = -16 + 10 * ease_out(p)
        rise = (1 - ease_out(local / 0.6)) * 140
        phone(frame, board, angle, W / 2 - 30, 1300 + rise, ACCENT['gold'])
        kicker(frame, 'LEADERBOARDS', t, 12.05, 210, GOLD)
        kinetic(frame, ['Race', 'the'], t, 12.1, 270, size=112)
        kinetic(frame, ['world.'], t, 12.3, 390, size=112, colors=[GOLD])
        # A gold "#1" medal pops beside the top row.
        bp = (local - 0.7) / 0.35
        if bp > 0:
            s = back_out(bp, 2.4)
            medal = cached('medal', lambda: _medal())
            size = max(1, int(190 * s))
            m = medal.resize((size, size), Image.BILINEAR)
            frame.alpha_composite(m, (int(W / 2 + 250 - size / 2), int(1130 - size / 2)))
    SECTIONS.append((12.0, 14.4, board_render, [ACCENT['gold'], ACCENT['plum'], (60, 40, 70)]))
    sparkles.burst(12.85, W / 2 + 250, 1130, count=24, spread=430)

    # I  14.4-16.8  The three stars.
    card = load_clip('lights', 5.0, 7.0, int(2.4 * FPS) + 1, (90, 600, 1030, 1420), (860, int(860 * 1420 / 1030)))

    def stars_render(frame, t):
        local = t - 14.4
        i = min(len(card) - 1, int(local * FPS))
        scale = 1.08 - 0.08 * ease_out(local / 2.4)
        place_card(frame, card[i], W / 2, 1170, scale, ACCENT['gold'], radius=50)
        kicker(frame, 'EVERY SOLVE', t, 14.45, 230, GOLD)
        kinetic(frame, ['Earn', 'every', 'star.'], t, 14.5, 290, size=110, colors=[CREAM, CREAM, GOLD])
    SECTIONS.append((14.4, 16.8, stars_render, [ACCENT['gold'], ACCENT['lights'], (50, 36, 70)]))
    sparkles.burst(15.0, W / 2 - 110, 1020, count=16, spread=360)
    sparkles.burst(15.15, W / 2, 1000, count=16, spread=360)
    sparkles.burst(15.3, W / 2 + 110, 1020, count=16, spread=360)

    # K  16.8-19.2  Every puzzle pays: coins fly into the purse.
    coin = cached('coin', _coin)
    gains = [10, 25, 10, 40, 15, 25, 30, 20, 25]
    launches = [(0.18 + k * 0.16, float(rng.uniform(140, 940))) for k in range(len(gains))]
    counter_y = 1080

    def coins_render(frame, t):
        local = t - 16.8
        kicker(frame, 'EVERY PUZZLE', t, 16.85, 230, GOLD)
        kinetic(frame, ['Every', 'puzzle', 'pays.'], t, 16.9, 290, size=100, colors=[CREAM, CREAM, GOLD])
        landed = [k for k, (at, _x) in enumerate(launches) if local >= at + 0.55]
        value = 1843 + sum(gains[k] for k in landed)
        bump = sum(max(0.0, 1 - (local - (launches[k][0] + 0.55)) / 0.18) for k in landed) * 0.06
        label = text_img(f'{value:,}', GEORGIA_BOLD, int(150 * (1 + bump)), CREAM)
        big = coin.resize((150, 150), Image.LANCZOS)
        total_w = big.width + 30 + label.width
        x0 = (W - total_w) / 2
        frame.alpha_composite(big, (int(x0), int(counter_y - 75)))
        frame.alpha_composite(label, (int(x0 + big.width + 30), int(counter_y - label.height / 2 - 6)))
        target = (x0 + 75, counter_y)
        for k, (at, sx) in enumerate(launches):
            p = (local - at) / 0.55
            if 0 <= p < 1:
                e = ease_in_out(p)
                px = sx + (target[0] - sx) * e
                py = 1960 + (target[1] - 1960) * e - math.sin(math.pi * e) * 420
                spin = abs(math.cos(p * math.pi * 3))
                cw = max(6, int(110 * (0.25 + 0.75 * spin)))
                c = coin.resize((cw, 110), Image.BILINEAR)
                frame.alpha_composite(c, (int(px - cw / 2), int(py - 55)))
        # One running total above the counter, growing as coins land.
        earned = value - 1843
        if earned > 0:
            last = max(launches[k][0] + 0.55 for k in landed)
            pop = max(0.0, 1 - (local - last) / 0.2) * 0.12
            g = text_img(f'+{earned}', GEORGIA_BOLD, int(76 * (1 + pop)), GOLD)
            frame.alpha_composite(g, (int((W - g.width) / 2), int(counter_y - 210 - g.height / 2)))
        kicker(frame, 'SPEND IT IN THE SHOP', t, 18.3, 1330, (240, 162, 122))
    SECTIONS.append((16.8, 19.2, coins_render, [ACCENT['gold'], (200, 120, 40), (50, 36, 70)]))
    for at, _x in launches:
        sparkles.burst(16.8 + at + 0.55, W / 2 - 160, 1080, count=7, spread=240)

    # L  19.2-21.6  Spend it on ad-free time.
    off = Image.open(os.path.join(HERE, 'adfree_off.png')).convert('RGB').resize((phone_w, int(phone_w * 2622 / 1206)), Image.LANCZOS)
    on = Image.open(os.path.join(HERE, 'adfree_on.png')).convert('RGB').resize((phone_w, int(phone_w * 2622 / 1206)), Image.LANCZOS)
    tap = (int(275 * phone_w / 1206), int(1372 * phone_w / 1206))

    def adfree_render(frame, t):
        local = t - 19.2
        screen = (off if local < 1.12 else on).copy()
        tp = (local - 0.85) / 0.55
        if 0 <= tp < 1:
            d = ImageDraw.Draw(screen, 'RGBA')
            r = 18 + tp * 70
            d.ellipse([tap[0] - r, tap[1] - r, tap[0] + r, tap[1] + r], outline=(255, 245, 225, int(230 * (1 - tp))), width=6)
            if tp < 0.4:
                d.ellipse([tap[0] - 22, tap[1] - 22, tap[0] + 22, tap[1] + 22], fill=(255, 245, 225, int(150 * (1 - tp / 0.4))))
        angle = 15 - 9 * ease_out(local / 2.4)
        rise = (1 - ease_out(local / 0.6)) * 140
        phone(frame, screen, angle, W / 2 + 30, 1300 + rise, ACCENT['gold'])
        kicker(frame, 'AD-FREE TIME', t, 19.25, 210, GOLD)
        kinetic(frame, ['Spend', 'it', 'on'], t, 19.3, 270, size=104)
        kinetic(frame, ['ad-free', 'time.'], t, 19.5, 390, size=104, colors=[GOLD, CREAM])
        sp = (local - 1.45) / 0.35
        if sp > 0:
            st = cached('stamp', _stamp)
            s = back_out(sp, 2.2)
            size = max(1, int(st.width * s))
            im = st.resize((size, size), Image.BILINEAR)
            frame.alpha_composite(im, (int(W / 2 + 255 - size / 2), int(1150 - size / 2)))
    SECTIONS.append((19.2, 21.6, adfree_render, [ACCENT['gold'], ACCENT['plum'], (60, 40, 70)]))
    sparkles.burst(19.2 + 1.5, W / 2 + 255, 1150, count=22, spread=420)

    # J  The logo.
    icon = Image.open(f'{REPO}/ios/GravityInit/Images.xcassets/AppIcon.appiconset/icon-1024x1024@1x.png').convert('RGBA').resize((340, 340), Image.LANCZOS)
    icon.putalpha(rounded_mask(340, 340, 78))
    rays = cached('rays', _rays)

    def logo_render(frame, t):
        local = t - LOGO_T
        # Slowly turning light rays behind.
        rp = clamp(local / 0.8)
        if rp > 0:
            r = rays.rotate(local * 9, resample=Image.BILINEAR)
            r.putalpha(r.getchannel('A').point(lambda v: int(v * rp * 0.55)))
            frame.alpha_composite(r, (int(W / 2 - r.width / 2), int(820 - r.height / 2)))
        p = local / 0.55
        if p > 0:
            s = back_out(p, 1.9)
            size = max(1, int(340 * s))
            im = icon.resize((size, size), Image.BILINEAR)
            sh, pad = shadow(340, 340, 78, strength=210, blur=40, drop=34)
            if p >= 1:
                frame.alpha_composite(sh, (int(W / 2 - 170 - pad), int(820 - 170 - pad)))
            # The light sweep across the icon.
            sp = (local - 0.7) / 0.7
            if 0 < sp < 1 and size == 340:
                band = Image.new('L', (340, 340), 0)
                bx = -200 + sp * 740
                ImageDraw.Draw(band).polygon([(bx, 0), (bx + 90, 0), (bx - 60, 340), (bx - 150, 340)], fill=170)
                band = band.filter(ImageFilter.GaussianBlur(14))
                band = ImageChops.multiply(band, im.getchannel('A'))
                im = im.copy()
                im.alpha_composite(Image.merge('RGBA', (Image.new('L', (340, 340), 255),) * 3 + (band,)))
            frame.alpha_composite(im, (int(W / 2 - size / 2), int(820 - size / 2)))
        # TESSERA, letter by letter.
        letters = 'TESSERA'
        f_imgs = [text_img(ch, GEORGIA_BOLD, 128, CREAM) for ch in letters]
        track = 26
        total = sum(i.width for i in f_imgs) + track * (len(f_imgs) - 1)
        x = (W - total) / 2
        for k, im in enumerate(f_imgs):
            lp = (local - 0.55 - k * 0.06) / 0.35
            if lp > 0:
                a = clamp(lp * 1.4)
                layer = im.copy()
                layer.putalpha(layer.getchannel('A').point(lambda v, a=a: int(v * a)))
                frame.alpha_composite(layer, (int(x), int(1080 + (1 - ease_out(lp)) * 50)))
            x += im.width + track
        tag = text_img('Calm puzzles, every day.', SANS, 48, (200, 186, 210))
        tp = clamp((local - 1.25) / 0.5)
        if tp > 0:
            layer = tag.copy()
            layer.putalpha(layer.getchannel('A').point(lambda v: int(v * tp)))
            frame.alpha_composite(layer, (int((W - tag.width) / 2), int(1260 + (1 - ease_out(tp)) * 24)))
        pill = cached('pill', _pill)
        pp = (local - 1.55) / 0.4
        if pp > 0:
            s = back_out(pp, 1.6)
            pw, ph = max(1, int(pill.width * s)), max(1, int(pill.height * s))
            pim = pill.resize((pw, ph), Image.BILINEAR)
            frame.alpha_composite(pim, (int((W - pw) / 2), int(1400 - ph / 2 + 50)))
        # The impact: a quick flash.
        if local < 0.28:
            flash = Image.new('RGBA', (W, H), (255, 244, 225, int(170 * (1 - local / 0.28))))
            frame.alpha_composite(flash)
    SECTIONS.append((LOGO_T, TOTAL, logo_render, [ACCENT['plum'], ACCENT['gold'], ACCENT['mirror']]))
    sparkles.burst(LOGO_T + 0.05, W / 2, 820, count=40, spread=720)


def _coin():
    s = 440
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([20, 20, s - 20, s - 20], fill=(183, 137, 47, 255))
    d.ellipse([20, 20, s - 20, s - 34], fill=(214, 168, 66, 255))
    d.ellipse([70, 66, s - 70, s - 84], outline=(240, 205, 120, 255), width=12)
    c = s / 2 - 8
    r = 62
    d.polygon([(s / 2, c - r), (s / 2 + r, c), (s / 2, c + r), (s / 2 - r, c)], fill=(255, 243, 212, 255))
    glow = img.filter(ImageFilter.GaussianBlur(16))
    return Image.alpha_composite(glow, img)


def _stamp():
    s = 460
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    red = (214, 84, 74, 255)
    d.ellipse([20, 20, s - 20, s - 20], fill=red)
    d.ellipse([46, 46, s - 46, s - 46], outline=(255, 238, 228, 255), width=8)
    f = ImageFont.truetype(GEORGIA_BOLD, 108)
    for k, line in enumerate(['NO', 'ADS']):
        tw = d.textlength(line, font=f)
        d.text(((s - tw) / 2, 110 + k * 118), line, font=f, fill=(255, 250, 244, 255))
    img = img.rotate(-12, resample=Image.BICUBIC)
    glow = img.filter(ImageFilter.GaussianBlur(14))
    return Image.alpha_composite(glow, img).resize((230, 230), Image.LANCZOS)


def _medal():
    s = 380
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([20, 20, s - 20, s - 20], fill=(201, 154, 46, 255))
    d.ellipse([46, 46, s - 46, s - 46], outline=(255, 226, 150, 255), width=8)
    f = ImageFont.truetype(GEORGIA_BOLD, 150)
    tw = d.textlength('#1', font=f)
    d.text(((s - tw) / 2, 95), '#1', font=f, fill=(255, 251, 240, 255))
    glow = img.filter(ImageFilter.GaussianBlur(18))
    return Image.alpha_composite(glow, img).resize((190, 190), Image.LANCZOS)


def _rays():
    s = 1500
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = s / 2
    for k in range(18):
        a = k * math.pi * 2 / 18
        w = math.pi / 18 / 2.2
        d.polygon([(c, c), (c + math.cos(a - w) * c, c + math.sin(a - w) * c), (c + math.cos(a + w) * c, c + math.sin(a + w) * c)], fill=(233, 186, 92, 70))
    img = img.filter(ImageFilter.GaussianBlur(10))
    m = Image.new('L', (s, s), 0)
    ImageDraw.Draw(m).ellipse([0, 0, s, s], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(220))
    img.putalpha(ImageChops.multiply(img.getchannel('A'), m))
    return img


def _pill():
    f = ImageFont.truetype(SANS, 40)
    d = ImageDraw.Draw(Image.new('RGBA', (10, 10)))
    text = 'Coming soon on iPhone & Android'
    tw = d.textlength(text, font=f)
    w, h = int(tw + 110), 100
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    dr.rounded_rectangle([0, 0, w - 1, h - 1], h // 2, fill=CREAM + (255,))
    dr.text(((w - tw) / 2, 26), text, font=f, fill=INK)
    return img


CUTS = [2.4, 3.6, 4.8, 6.0, 7.2, 9.6, 12.0, 14.4, 16.8, 19.2, LOGO_T]
WHIP = 0.13


def section_at(t):
    for s in SECTIONS:
        if s[0] <= t < s[1]:
            return s
    return SECTIONS[-1]


def raw_frame(t):
    start, end, render, colors = section_at(t)
    frame = background(t, colors)
    render(frame, t)
    sparkles.draw(frame, t)
    return frame


def compose(t):
    """A frame, with a whip pan across any cut it falls near."""
    near = min(CUTS, key=lambda c: abs(c - t))
    d = t - near
    if abs(d) < WHIP and near != LOGO_T:
        k = 1 - abs(d) / WHIP  # 1 at the cut
        shift = int(ease_in_out(k) * W * 0.42) * (-1 if d < 0 else 1)
        base = np.asarray(raw_frame(t).convert('RGB')).astype(np.float32)
        base = np.roll(base, shift, axis=1)
        # Motion blur along the pan.
        taps = 7
        span = int(k * 140)
        acc = np.zeros_like(base)
        for i in range(taps):
            acc += np.roll(base, int((i / (taps - 1) - 0.5) * span), axis=1)
        arr = acc / taps
    else:
        arr = np.asarray(raw_frame(t).convert('RGB')).astype(np.float32)
    # Grade: vignette and grain.
    arr *= vignette()
    g = np.asarray(GRAIN[int(t * FPS) % len(GRAIN)]).astype(np.float32)[..., None] - 128
    arr += g * 0.9
    # Fade out the very end.
    if t > TOTAL - 0.5:
        arr *= (TOTAL - t) / 0.5
    return np.clip(arr, 0, 255).astype(np.uint8)


def main():
    build()
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'promo_video.mp4')
    only = float(sys.argv[2]) if len(sys.argv) > 2 else None
    if only is not None:  # one still, for checking
        Image.fromarray(compose(only)).save(out)
        return
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    n = int(TOTAL * FPS)
    for i in range(n):
        enc.stdin.write(compose(i / FPS).tobytes())
        if i % 60 == 0:
            print(f'frame {i}/{n}', flush=True)
    enc.stdin.close()
    enc.wait()


if __name__ == '__main__':
    main()
