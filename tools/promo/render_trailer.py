"""Tessera promo, take three: a trailer cut to a 120 bpm score.

25 s, 1080x1920, 30 fps. One beat = 0.5 s and every cut lands on one.

  0.0  Hook       "Stop scrolling." / "Start solving." slammed in on the beat
  2.0  Montage    all twelve games, one a beat, footage at 3x, a 01-12 count
  8.0  The wall   the last board shrinks into its tile; the twelve emblems
                  land; the camera dives through Lights Out
 10.0  The win    the three-star card, a spark on every star
 12.5  Daily      Home on a tilted phone, a streak counting up to 30 days
 15.0  World      the leaderboard, a #1 medal slams in
 17.0  Coins      every puzzle pays; coins pour into the purse
 19.0  Ad-free    spend them on ad-free time
 21.0  Logo       the end card

Shared drawing helpers come from render_premium.py. Inputs in work/: cfr/<game>.mp4
for all twelve games plus home and board (record.sh), emblems.png, adfree_off.png,
adfree_on.png. Score: make_music_trailer.py, loudness-normalised to -14 LUFS.
"""
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_premium as r  # noqa: E402

r.CFR = os.path.join(HERE, 'cfr')
W, H, FPS = r.W, r.H, r.FPS
BEAT = 0.5
TOTAL = 25.0
INK, CREAM, GOLD = r.INK, r.CREAM, r.GOLD
SERIF, MONO, SANS = r.GEORGIA_BOLD, r.MONO, r.SANS
clamp, ease_out, ease_in_out, back_out = r.clamp, r.ease_out, r.ease_in_out, r.back_out
text_img, cached, rounded_mask, shadow, aura, place_card = r.text_img, r.cached, r.rounded_mask, r.shadow, r.aura, r.place_card
rng = np.random.default_rng(5)

T_DROP, T_WALL, T_WIN, T_DAILY, T_WORLD, T_COINS, T_ADFREE, T_LOGO = 2.0, 8.0, 10.0, 12.5, 15.0, 17.0, 19.0, 21.0

# The twelve, in montage order: (clip, name, accent, source start, speed, crop)
SQ = (90, 845, 1026, 1026)
GAMES = [
    ('mirror', 'Mirror Maze', (92, 150, 214), 3.4, 3.0, (90, 840, 1030, 1040)),
    ('mosaic', 'Mosaic', (222, 120, 70), 4.6, 3.0, (100, 800, 1010, 1220)),
    ('gravity', 'Gravity', (226, 132, 82), 3.2, 3.0, (70, 700, 1066, 1300)),
    ('bloom', 'Bloom', (226, 120, 150), 4.0, 3.0, (90, 810, 1030, 1030)),
    ('lights', 'Lights Out', (130, 140, 230), 2.6, 2.0, (90, 810, 1030, 1030)),
    ('tents', 'Tents', (110, 180, 110), 5.0, 3.0, SQ),
    ('binairo', 'Binairo', (226, 140, 80), 7.0, 3.0, SQ),
    ('towers', 'Towers', (160, 110, 210), 8.5, 3.0, SQ),
    ('arukone', 'Arukone', (236, 120, 160), 2.9, 2.0, SQ),
    ('fillapix', 'Fill-a-Pix', (80, 190, 170), 5.0, 3.0, SQ),
    ('adjacent', 'Adjacent', (230, 180, 70), 3.8, 1.0, SQ),
    ('bridges', 'Bridges', (90, 150, 200), 4.6, 3.0, (90, 825, 1026, 1026)),
]
CARD_W = 940

SECTIONS = []  # (start, end, render(frame, t), background colours)
sparkles = r.Sparkles()
shake_at = []   # times of impacts, for a short camera shake
flash_at = []   # (time, strength) of white flashes


# --- Type -------------------------------------------------------------------

def put(frame, im, x, y, alpha=1.0):
    if alpha <= 0:
        return
    if alpha < 1:
        im = im.copy()
        im.putalpha(im.getchannel('A').point(lambda v: int(v * alpha)))
    frame.alpha_composite(im, (int(x), int(y)))


def slam(frame, text, t, at, cx, cy, size, color):
    """A word that lands from big and blurred to sharp, in four frames."""
    p = (t - at) / 0.14
    if p <= 0:
        return
    im = text_img(text, SERIF, size, color)
    e = ease_out(p)
    s = 1.0 + 0.45 * (1 - e)
    w, h = max(1, int(im.width * s)), max(1, int(im.height * s))
    layer = im.resize((w, h), Image.BILINEAR)
    if p < 1:
        layer = layer.filter(ImageFilter.GaussianBlur(10 * (1 - e)))
    put(frame, layer, cx - w / 2, cy - h / 2, clamp(p * 1.5))


def reveal(frame, words, t, start, y, size=112, colors=None, gap=0.08, x=None):
    """Words rising out of an invisible line, one after another: a mask
    reveal, not a fade. Centred unless `x` is given."""
    imgs = [text_img(wd, SERIF, size, (colors or [CREAM] * len(words))[i]) for i, wd in enumerate(words)]
    space = size * 0.28
    total = sum(i.width for i in imgs) + space * (len(imgs) - 1)
    cx = (W - total) / 2 if x is None else x
    for k, im in enumerate(imgs):
        p = (t - start - k * gap) / 0.3
        if p > 0:
            e = ease_out(p)
            off = int((1 - e) * im.height)
            visible = im.crop((0, 0, im.width, im.height - off)) if off < im.height else None
            if visible is not None and visible.height > 0:
                frame.alpha_composite(visible, (int(cx), int(y + off)))
        cx += im.width + space


def label(frame, text, t, start, y, color, size=32, tracking=8):
    im = text_img(text, MONO, size, color, tracking=tracking)
    put(frame, im, (W - im.width) / 2, y + (1 - ease_out((t - start) / 0.3)) * 14, clamp((t - start) / 0.25))


# --- Footage ------------------------------------------------------------------

def clip_frames(name, start, speed, seconds, crop, width):
    """The frames for `seconds` of screen time, footage played at `speed`."""
    x, y, w, h = crop
    th = int(width * h / w)
    n = int(round(seconds * FPS)) + 1
    span = seconds * speed
    frames = r.load_clip(name, start, start + span, n, crop, (width, th))
    return frames


def phone(frame, img, angle, cx, cy, accent):
    w, h = img.size
    rgba = img.convert('RGBA')
    rgba.putalpha(rounded_mask(w, h, 74))
    body = Image.new('RGBA', (w + 24, h + 24), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle([0, 0, w + 23, h + 23], 86, fill=(30, 26, 38, 255), outline=(96, 84, 112, 255), width=3)
    body.alpha_composite(rgba, (12, 12))
    turned = r.perspective(body, angle)
    a, pad = aura(turned.width, turned.height, 80, accent)
    frame.alpha_composite(a, (int(cx - turned.width / 2 - pad), int(cy - turned.height / 2 - pad)))
    s, spad = shadow(turned.width, turned.height, 80, strength=200, blur=50, drop=50)
    frame.alpha_composite(s, (int(cx - turned.width / 2 - spad), int(cy - turned.height / 2 - spad)))
    frame.alpha_composite(turned, (int(cx - turned.width / 2), int(cy - turned.height / 2)))


# --- The cut --------------------------------------------------------------

def build():
    # Hook ----------------------------------------------------------------
    mirror_bg = clip_frames('mirror', 2.2, 1.0, 2.0, GAMES[0][5], CARD_W)

    def hook(frame, t):
        # Behind the words, from the second beat, the first board wakes up
        # out of focus - so the drop has somewhere to land.
        if t >= 1.0:
            p = clamp((t - 1.0) / 1.0)
            card = mirror_bg[min(len(mirror_bg) - 1, int(t * FPS))]
            blurred = card.filter(ImageFilter.GaussianBlur(26 * (1 - p) + 6))
            dim = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            place_card(dim, blurred, W / 2, 1110, 1.0 + 0.06 * (1 - p), GAMES[0][2], glow=False)
            put(frame, dim, 0, 0, 0.18 + 0.32 * p)
        # Stop scrolling. (beats 0 and 1), then Start solving. (2 and 3)
        if t < 1.0:
            slam(frame, 'Stop', t, 0.02, W / 2, 820, 190, CREAM)
            slam(frame, 'scrolling.', t, 0.5, W / 2, 1040, 190, CREAM)
        else:
            slam(frame, 'Start', t, 1.0, W / 2, 820, 190, CREAM)
            slam(frame, 'solving.', t, 1.5, W / 2, 1040, 190, GOLD)
    SECTIONS.append((0.0, T_DROP, hook, [(70, 50, 100), (40, 30, 60), GAMES[0][2]]))
    shake_at.extend([0.02, 0.5, 1.0, 1.5])

    # Montage -----------------------------------------------------------------
    for k, (name, title, accent, src, speed, crop) in enumerate(GAMES):
        start = T_DROP + k * BEAT
        frames = clip_frames(name, src, speed, BEAT, crop, CARD_W)

        def montage(frame, t, start=start, frames=frames, title=title, accent=accent, k=k):
            local = t - start
            i = min(len(frames) - 1, int(local * FPS))
            # Punch in on the cut, then a slow drift: alternate directions.
            punch = 1.0 + 0.07 * (1 - ease_out(local / 0.18))
            drift = (local / BEAT) * 0.025 * (1 if k % 2 else -1)
            card = frames[i]
            cy = 1130 if card.height < 1100 else 1170
            place_card(frame, card, W / 2, cy, punch + drift, accent)
            num = text_img(f'{k + 1:02d}', SERIF, 64, GOLD)
            of = text_img(' / 12', SERIF, 64, (150, 136, 160))
            x0 = (W - num.width - of.width) / 2
            frame.alpha_composite(num, (int(x0), 250))
            frame.alpha_composite(of, (int(x0 + num.width), 250))
            name_img = text_img(title, SERIF, 128, CREAM)
            put(frame, name_img, (W - name_img.width) / 2, 345 + (1 - ease_out(local / 0.16)) * 26, clamp(local / 0.08))
        SECTIONS.append((start, start + BEAT, montage, [accent, (40, 30, 60), accent]))
    flash_at.append((T_DROP, 0.75))
    shake_at.append(T_DROP)

    # The wall: twelve emblems, then a dive through Lights Out -----------------
    sheet = Image.open(os.path.join(HERE, 'emblems.png')).convert('RGB')
    TILE, GAP = 250, 300
    order = ['gravity', 'mirror', 'tents', 'towers', 'binairo', 'arukone', 'fillapix', 'lights', 'adjacent', 'bloom', 'mosaic', 'bridges']
    tiles = []
    for k in range(12):
        rr, c = divmod(k, 3)
        cx, cy = 30 + 382 * (c + 0.5), 360 + 450 * (rr + 0.5)
        tile = sheet.crop((int(cx - 172), int(cy - 172), int(cx + 172), int(cy + 172))).resize((TILE, TILE), Image.LANCZOS).convert('RGBA')
        tile.putalpha(rounded_mask(TILE, TILE, 56))
        tiles.append(tile)

    def tile_pos(k):
        rr, c = divmod(k, 3)
        return W / 2 + (c - 1) * GAP, 820 + rr * GAP

    last = clip_frames('bridges', GAMES[11][3] + BEAT * GAMES[11][4], 1.0, 0.5, GAMES[11][5], CARD_W)
    lights_k = order.index('lights')
    dive_at = 1.55  # seconds into the wall

    def wall(frame, t):
        local = t - T_WALL
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        reveal(layer, ['12', 'games.'], t, T_WALL + 0.25, 250, size=140, colors=[GOLD, CREAM])
        reveal(layer, ['One', 'app.'], t, T_WALL + 0.55, 410, size=96, colors=[(200, 186, 210)] * 2)
        bk = order.index('bridges')
        for k, tile in enumerate(tiles):
            x, y = tile_pos(k)
            if k == bk:
                continue
            at = 0.12 + ((k * 7) % 12) * 0.045  # scattered, not a typewriter
            p = (local - at) / 0.3
            if p <= 0:
                continue
            s = back_out(p, 2.0)
            size = max(1, int(TILE * s))
            sh, pad = shadow(TILE, TILE, 56, strength=150, blur=24, drop=16)
            if p >= 1:
                layer.alpha_composite(sh, (int(x - TILE / 2 - pad), int(y - TILE / 2 - pad)))
            layer.alpha_composite(tile.resize((size, size), Image.BILINEAR), (int(x - size / 2), int(y - size / 2)))
        # The match cut: the last board flies home into its own tile.
        p = clamp(local / 0.42)
        x, y = tile_pos(bk)
        e = ease_in_out(p)
        if p < 1:
            card = last[min(len(last) - 1, int(local * FPS))]
            w0 = CARD_W
            w1 = TILE
            w = w0 + (w1 - w0) * e
            cx = W / 2 + (x - W / 2) * e
            cy = 1170 + (y - 1170) * e
            sm = card.resize((max(1, int(w)), max(1, int(w * card.height / card.width))), Image.BILINEAR).convert('RGBA')
            sm.putalpha(rounded_mask(sm.width, sm.height, int(46 + 10 * e)))
            layer.alpha_composite(sm, (int(cx - sm.width / 2), int(cy - sm.height / 2)))
            if p > 0.6:
                put(layer, tiles[bk], x - TILE / 2, y - TILE / 2, (p - 0.6) / 0.4)
        else:
            sh, pad = shadow(TILE, TILE, 56, strength=150, blur=24, drop=16)
            layer.alpha_composite(sh, (int(x - TILE / 2 - pad), int(y - TILE / 2 - pad)))
            layer.alpha_composite(tiles[bk], (int(x - TILE / 2), int(y - TILE / 2)))
        # The dive: scale the whole wall about the Lights Out tile.
        d = (local - dive_at) / 0.45
        if d > 0:
            z = 1 + 9 * (ease_in_out(d) ** 2.2)
            lx, ly = tile_pos(lights_k)
            e = ease_in_out(d)
            ox, oy = lx * z - lx + (lx - W / 2) * e, ly * z - ly + (ly - H / 2) * e
            crop = layer.transform((W, H), Image.AFFINE, (1 / z, 0, ox / z, 0, 1 / z, oy / z), Image.BILINEAR)
            frame.alpha_composite(crop)
        else:
            frame.alpha_composite(layer)
    SECTIONS.append((T_WALL, T_WIN, wall, [(120, 80, 170), GOLD, (92, 150, 214)]))
    sparkles.burst(T_WALL + 0.42, *tile_pos(order.index('bridges')), count=16, spread=320)
    flash_at.append((T_WIN, 0.9))

    # The win: three stars ------------------------------------------------------
    card = r.load_clip('lights', 5.0, 7.0, int(2.5 * FPS) + 1, (90, 600, 1030, 1420), (880, int(880 * 1420 / 1030)))

    def win(frame, t):
        local = t - T_WIN
        i = min(len(card) - 1, int(local * FPS))
        scale = 1.1 - 0.1 * ease_out(local / 2.5)
        place_card(frame, card[i], W / 2, 1180, scale, GOLD, radius=50)
        reveal(frame, ['Feel', 'every'], t, T_WIN + 0.1, 220, size=124)
        reveal(frame, ['win.'], t, T_WIN + 0.3, 360, size=124, colors=[GOLD])
    SECTIONS.append((T_WIN, T_DAILY, win, [GOLD, (130, 140, 230), (50, 36, 70)]))
    for k, dx in enumerate((-115, 0, 115)):
        sparkles.burst(T_WIN + 0.62 + k * 0.15, W / 2 + dx, 1030, count=16, spread=380)

    # Daily: Home, and a streak that keeps growing --------------------------
    pw = 660
    home = r.load_clip('home', 2.6, 8.4, int(2.5 * FPS) + 1, (0, 0, 1206, 2622), (pw, int(pw * 2622 / 1206)))

    def daily(frame, t):
        local = t - T_DAILY
        i = min(len(home) - 1, int(local * FPS))
        angle = 15 - 10 * ease_out(local / 2.5)
        rise = (1 - ease_out(local / 0.5)) * 160
        phone(frame, home[i], angle, W / 2 + 40, 1330 + rise, (226, 132, 82))
        reveal(frame, ['A', 'new', 'puzzle'], t, T_DAILY + 0.05, 220, size=110)
        reveal(frame, ['every', 'day.'], t, T_DAILY + 0.25, 345, size=110, colors=[CREAM, (240, 162, 122)])
        # The streak chip, counting up on the beat.
        cp = (local - 0.55) / 0.3
        if cp > 0:
            days = min(30, 1 + int(max(0.0, local - 0.6) / 1.3 * 29))
            chip = streak_chip(days)
            s = back_out(cp, 1.8)
            cw, ch = max(1, int(chip.width * s)), max(1, int(chip.height * s))
            frame.alpha_composite(chip.resize((cw, ch), Image.BILINEAR), (int(W / 2 - 260 - cw / 2), int(1010 - ch / 2)))
    SECTIONS.append((T_DAILY, T_WORLD, daily, [(226, 132, 82), (120, 80, 170), (60, 40, 70)]))

    # World: the leaderboard and a #1 medal --------------------------------
    board = r.load_clip('board', 2.95, 3.06, 2, (0, 0, 1206, 2622), (pw, int(pw * 2622 / 1206)))[1]
    medal = cached('medal', r._medal)

    def world(frame, t):
        local = t - T_WORLD
        angle = -15 + 10 * ease_out(local / 2.0)
        rise = (1 - ease_out(local / 0.5)) * 160
        phone(frame, board, angle, W / 2 - 40, 1330 + rise, GOLD)
        reveal(frame, ['Beat', 'the'], t, T_WORLD + 0.05, 220, size=124)
        reveal(frame, ['world.'], t, T_WORLD + 0.2, 360, size=124, colors=[GOLD])
        mp = (local - 0.5) / 0.22
        if mp > 0:
            s = 1 + 1.4 * (1 - ease_out(mp)) if mp < 1 else 1.0
            size = max(1, int(210 * s))
            put(frame, medal.resize((size, size), Image.BILINEAR), W / 2 + 230 - size / 2, 1150 - size / 2, clamp(mp * 2))
    SECTIONS.append((T_WORLD, T_COINS, world, [GOLD, (120, 80, 170), (60, 40, 70)]))
    shake_at.append(T_WORLD + 0.72)
    sparkles.burst(T_WORLD + 0.72, W / 2 + 230, 1150, count=26, spread=460)

    # Coins ---------------------------------------------------------------------
    coin = cached('coin', r._coin)
    gains = [10, 25, 10, 40, 15, 25, 30, 20, 25]
    launches = [(0.15 + k * 0.14, float(rng.uniform(140, 940))) for k in range(len(gains))]
    counter_y = 1100

    def coins(frame, t):
        local = t - T_COINS
        reveal(frame, ['Every', 'puzzle'], t, T_COINS + 0.05, 260, size=124)
        reveal(frame, ['pays.'], t, T_COINS + 0.2, 400, size=124, colors=[GOLD])
        landed = [k for k, (at, _x) in enumerate(launches) if local >= at + 0.5]
        value = 1843 + sum(gains[k] for k in landed)
        bump = sum(max(0.0, 1 - (local - (launches[k][0] + 0.5)) / 0.16) for k in landed) * 0.06
        lab = text_img(f'{value:,}', SERIF, int(170 * (1 + bump)), CREAM)
        big = coin.resize((170, 170), Image.LANCZOS)
        x0 = (W - big.width - 30 - lab.width) / 2
        frame.alpha_composite(big, (int(x0), int(counter_y - 85)))
        frame.alpha_composite(lab, (int(x0 + big.width + 30), int(counter_y - lab.height / 2 - 8)))
        target = (x0 + 85, counter_y)
        for k, (at, sx) in enumerate(launches):
            p = (local - at) / 0.5
            if 0 <= p < 1:
                e = ease_in_out(p)
                px = sx + (target[0] - sx) * e
                py = 1900 + (target[1] - 1900) * e - math.sin(p * math.pi) * 380
                sz = int(110 - 40 * e)
                frame.alpha_composite(coin.resize((sz, sz), Image.BILINEAR), (int(px - sz / 2), int(py - sz / 2)))
        earned = value - 1843
        if earned > 0:
            g = text_img(f'+{earned}', SERIF, 84, GOLD)
            frame.alpha_composite(g, (int((W - g.width) / 2), int(counter_y + 150)))
    SECTIONS.append((T_COINS, T_ADFREE, coins, [GOLD, (200, 120, 40), (50, 36, 70)]))
    for at, _x in launches:
        sparkles.burst(T_COINS + at + 0.5, W / 2 - 170, counter_y, count=6, spread=220)

    # Ad-free ------------------------------------------------------------------
    ph = 700
    off = Image.open(os.path.join(HERE, 'adfree_off.png')).convert('RGB').resize((ph, int(ph * 2622 / 1206)), Image.LANCZOS)
    on = Image.open(os.path.join(HERE, 'adfree_on.png')).convert('RGB').resize((ph, int(ph * 2622 / 1206)), Image.LANCZOS)
    tap = (int(275 * ph / 1206), int(1372 * ph / 1206))
    stamp = cached('stamp', r._stamp)

    def adfree(frame, t):
        local = t - T_ADFREE
        screen = (off if local < 0.95 else on).copy()
        tp = (local - 0.7) / 0.5
        if 0 <= tp < 1:
            d = ImageDraw.Draw(screen, 'RGBA')
            rad = 18 + tp * 70
            d.ellipse([tap[0] - rad, tap[1] - rad, tap[0] + rad, tap[1] + rad], outline=(255, 245, 225, int(230 * (1 - tp))), width=6)
            if tp < 0.4:
                d.ellipse([tap[0] - 22, tap[1] - 22, tap[0] + 22, tap[1] + 22], fill=(255, 245, 225, int(150 * (1 - tp / 0.4))))
        angle = 14 - 9 * ease_out(local / 2.0)
        rise = (1 - ease_out(local / 0.5)) * 160
        # The phone sits low and large, so the Ad-free card is the focus.
        phone(frame, screen, angle, W / 2 + 20, 1240 + rise, GOLD)
        reveal(frame, ['Spend', 'it', 'on'], t, T_ADFREE + 0.05, 200, size=110)
        reveal(frame, ['ad-free', 'time.'], t, T_ADFREE + 0.2, 325, size=110, colors=[GOLD, CREAM])
        sp = (local - 1.2) / 0.22
        if sp > 0:
            s = 1 + 1.2 * (1 - ease_out(sp)) if sp < 1 else 1.0
            size = max(1, int(stamp.width * s))
            put(frame, stamp.resize((size, size), Image.BILINEAR), W / 2 + 270 - size / 2, 1000 - size / 2, clamp(sp * 2))
    SECTIONS.append((T_ADFREE, T_LOGO, adfree, [GOLD, (120, 80, 170), (60, 40, 70)]))
    shake_at.append(T_ADFREE + 1.42)
    sparkles.burst(T_ADFREE + 1.42, W / 2 + 270, 1000, count=24, spread=440)

    # Logo ---------------------------------------------------------------------
    icon = Image.open(f'{r.REPO}/ios/GravityInit/Images.xcassets/AppIcon.appiconset/icon-1024x1024@1x.png').convert('RGBA').resize((360, 360), Image.LANCZOS)
    icon.putalpha(rounded_mask(360, 360, 82))
    rays = cached('rays', r._rays)
    pill = cached('pill', r._pill)

    def logo(frame, t):
        local = t - T_LOGO
        rp = clamp(local / 0.8)
        rot = rays.rotate(local * 8, resample=Image.BILINEAR)
        rot.putalpha(rot.getchannel('A').point(lambda v: int(v * rp * 0.6)))
        frame.alpha_composite(rot, (int(W / 2 - rot.width / 2), int(800 - rot.height / 2)))
        p = local / 0.22
        if p > 0:
            s = 1 + 0.9 * (1 - ease_out(p)) if p < 1 else 1.0
            size = max(1, int(360 * s))
            im = icon.resize((size, size), Image.BILINEAR)
            if p >= 1:
                sh, pad = shadow(360, 360, 82, strength=210, blur=40, drop=34)
                frame.alpha_composite(sh, (int(W / 2 - 180 - pad), int(800 - 180 - pad)))
                spx = (local - 0.6) / 0.7
                if 0 < spx < 1:
                    band = Image.new('L', (360, 360), 0)
                    bx = -200 + spx * 780
                    ImageDraw.Draw(band).polygon([(bx, 0), (bx + 90, 0), (bx - 60, 360), (bx - 150, 360)], fill=170)
                    band = ImageChops.multiply(band.filter(ImageFilter.GaussianBlur(14)), im.getchannel('A'))
                    im = im.copy()
                    im.alpha_composite(Image.merge('RGBA', (Image.new('L', (360, 360), 255),) * 3 + (band,)))
            put(frame, im, W / 2 - size / 2, 800 - size / 2, clamp(p * 2))
        letters = 'TESSERA'
        imgs = [text_img(ch, SERIF, 132, CREAM) for ch in letters]
        track = 28
        x = (W - sum(i.width for i in imgs) - track * 6) / 2
        for k, im in enumerate(imgs):
            lp = (local - 0.35 - k * 0.05) / 0.3
            if lp > 0:
                off_y = int((1 - ease_out(lp)) * im.height)
                vis = im.crop((0, 0, im.width, im.height - off_y))
                if vis.height > 0:
                    frame.alpha_composite(vis, (int(x), int(1080 + off_y)))
            x += im.width + track
        tag = text_img('Twelve calm puzzles. One app.', SANS, 50, (205, 190, 215))
        put(frame, tag, (W - tag.width) / 2, 1265 + (1 - ease_out((local - 0.95) / 0.4)) * 20, clamp((local - 0.95) / 0.4))
        pp = (local - 1.3) / 0.35
        if pp > 0:
            breathe = 1 + 0.025 * math.sin(max(0.0, local - 1.8) * 4.2)
            s = back_out(pp, 1.6) * breathe
            pw2, ph2 = max(1, int(pill.width * s)), max(1, int(pill.height * s))
            frame.alpha_composite(pill.resize((pw2, ph2), Image.BILINEAR), (int((W - pw2) / 2), int(1450 - ph2 / 2)))
    SECTIONS.append((T_LOGO, TOTAL, logo, [(120, 80, 170), GOLD, (92, 150, 214)]))
    shake_at.append(T_LOGO)
    flash_at.append((T_LOGO, 0.8))
    sparkles.burst(T_LOGO + 0.05, W / 2, 800, count=44, spread=760)


def streak_chip(days):
    def make():
        f_big = text_img(f'{days}', SERIF, 92, GOLD)
        f_small = text_img('DAY STREAK', MONO, 30, (232, 214, 180), tracking=6)
        w = 60 + f_big.width + 24 + f_small.width + 60
        h = 150
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([0, 8, w - 1, h - 1], 40, fill=(18, 12, 22, 255))
        d.rounded_rectangle([0, 0, w - 1, h - 9], 40, fill=(44, 32, 52, 255), outline=(233, 186, 92, 255), width=3)
        img.alpha_composite(f_big, (60, int((h - 9 - f_big.height) / 2)))
        img.alpha_composite(f_small, (60 + f_big.width + 24, int((h - 9 - f_small.height) / 2) + 4))
        return img
    return cached(('chip', days), make)


# --- Compositing ------------------------------------------------------------

CUTS = [T_DROP + k * BEAT for k in range(12)] + [T_WALL, T_WIN, T_DAILY, T_WORLD, T_COINS, T_ADFREE, T_LOGO]
WHIP_CUTS = {T_DAILY, T_WORLD, T_COINS, T_ADFREE, T_DROP + 4 * BEAT, T_DROP + 8 * BEAT}
WHIP = 0.12


def section_at(t):
    for s in SECTIONS:
        if s[0] <= t < s[1]:
            return s
    return SECTIONS[-1]


def raw_frame(t):
    start, end, render, colors = section_at(t)
    frame = r.background(t, colors)
    render(frame, t)
    sparkles.draw(frame, t)
    return frame


def compose(t):
    near = min(WHIP_CUTS, key=lambda c: abs(c - t))
    d = t - near
    if abs(d) < WHIP:
        k = 1 - abs(d) / WHIP
        shift = int(ease_in_out(k) * W * 0.45) * (-1 if d < 0 else 1)
        base = np.roll(np.asarray(raw_frame(t).convert('RGB')).astype(np.float32), shift, axis=1)
        acc = np.zeros_like(base)
        span = int(k * 160)
        for i in range(7):
            acc += np.roll(base, int((i / 6 - 0.5) * span), axis=1)
        arr = acc / 7
    else:
        arr = np.asarray(raw_frame(t).convert('RGB')).astype(np.float32)
    # Camera shake on the impacts: a few frames, decaying.
    for at in shake_at:
        a = t - at
        if 0 <= a < 0.2:
            amp = 16 * (1 - a / 0.2)
            dx, dy = int(math.sin(a * 140) * amp), int(math.cos(a * 110) * amp)
            arr = np.roll(np.roll(arr, dx, axis=1), dy, axis=0)
    arr *= r.vignette()
    for at, strength in flash_at:
        a = t - at
        if 0 <= a < 0.25:
            arr = arr + (np.array([255, 246, 230], np.float32) - arr) * strength * (1 - a / 0.25) ** 1.6
    g = np.asarray(r.GRAIN[int(t * FPS) % len(r.GRAIN)]).astype(np.float32)[..., None] - 128
    arr += g * 0.8
    if t > TOTAL - 0.4:
        arr *= (TOTAL - t) / 0.4
    return np.clip(arr, 0, 255).astype(np.uint8)


def main():
    build()
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'video.mp4')
    if len(sys.argv) > 2:  # stills, for checking: render_v3.py sheet.png 1.2,3.4,...
        times = [float(x) for x in sys.argv[2].split(',')]
        ims = [Image.fromarray(compose(x)).resize((270, 480)) for x in times]
        cols = min(8, len(ims))
        rows = math.ceil(len(ims) / cols)
        sheet = Image.new('RGB', (270 * cols, 480 * rows))
        for i, im in enumerate(ims):
            sheet.paste(im, ((i % cols) * 270, (i // cols) * 480))
        sheet.save(out)
        return
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    n = int(TOTAL * FPS)
    for i in range(n):
        enc.stdin.write(compose(i / FPS).tobytes())
        if i % 75 == 0:
            print(f'frame {i}/{n}', flush=True)
    enc.stdin.close()
    enc.wait()


if __name__ == '__main__':
    main()
