"""Store screenshots for Tessera: six slides, laid out as three panoramic
pairs - each pair is one picture cut in two, so side by side in the store
they read as a single spread.

Each pair shares a flat ground, a giant low-contrast tessera turned across
the seam, and one ribbon of small mosaic tiles that runs unbroken through
all six slides. Every slide: a serif headline, one quiet line, one phone.

Inputs: work/shots/<name>.png (simulator screenshots, see shot.sh).
Output: marketing/screenshots/ios-6.9/NN.png (1320x2868, App Store) and
marketing/screenshots/android/NN.png (1080x1920, Google Play's 9:16 limit).
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, 'work', 'shots')
OUT = os.path.join(HERE, '..', '..', 'marketing', 'screenshots')
SERIF = '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
SANS = '/System/Library/Fonts/SFNS.ttf'
CREAM = (244, 235, 216)
MUTED = (186, 172, 196)
GOLD = (233, 186, 92)

# The twelve games' own colours, for the ribbon.
ACCENTS = [(92, 150, 214), (222, 120, 70), (226, 132, 82), (226, 120, 150), (130, 140, 230), (110, 180, 110),
           (226, 140, 80), (160, 110, 210), (236, 120, 160), (80, 190, 170), (230, 180, 70), (90, 150, 200)]

SLIDES = [
    # (shot, headline lines, gold word, sub line)
    ('home', ['Twelve calm', 'puzzles.'], 'calm', 'One almanac, and a new puzzle every day.'),
    ('mirror', ['Bend the', 'light.'], 'light.', 'Mirror Maze, Mosaic, Bloom and nine more.'),
    ('bloom', ['Easy to start.', 'Hard to stop.'], 'stop.', 'Hints when you want them, never when you don’t.'),
    ('mosaic', ['Feel every', 'win.'], 'win.', 'Three stars and coins for every solve.'),
    ('ledger', ['Watch yourself', 'get sharper.'], 'sharper.', 'Every game’s record, kept in one ledger.'),
    ('shopgames', ['Make it', 'yours.'], 'yours.', 'Skins, chimes and confetti, earned by playing.'),
]
# One ground per pair.
GROUNDS = [(30, 21, 40), (17, 22, 40), (34, 22, 30)]
TILE_TONE = [(46, 33, 62), (27, 35, 62), (52, 34, 45)]


def font(path, size):
    return ImageFont.truetype(path, size)


def headline(draw, lines, gold, x_center, top, size):
    f = font(SERIF, size)
    y = top
    for line in lines:
        words = line.split(' ')
        widths = [draw.textlength(w, font=f) for w in words]
        space = draw.textlength(' ', font=f)
        total = sum(widths) + space * (len(words) - 1)
        x = x_center - total / 2
        for w, ww in zip(words, widths):
            draw.text((x, y), w, font=f, fill=GOLD if w == gold else CREAM)
            x += ww + space
        y += size * 1.12
    return y


def sub(draw, text, x_center, top, size):
    f = font(SANS, size)
    w = draw.textlength(text, font=f)
    draw.text((x_center - w / 2, top), text, font=f, fill=MUTED)


def phone(shot, width):
    """A clean device: the screenshot in a dark body with a fine rim, a
    side slab below for depth, and a soft shadow - no gloss, no gradient."""
    scr = Image.open(os.path.join(SHOTS, f'{shot}.png')).convert('RGB')
    h = int(width * scr.height / scr.width)
    scr = scr.resize((width, h), Image.LANCZOS)
    bez = int(width * 0.028)
    bw, bh = width + bez * 2, h + bez * 2
    r_out = int(bw * 0.135)
    r_in = r_out - bez
    side = int(width * 0.012)  # the slab under the body: geometry, not shading
    pad = int(width * 0.16)
    img = Image.new('RGBA', (bw + pad * 2, bh + pad * 2 + side), (0, 0, 0, 0))
    sh = Image.new('L', img.size, 0)
    ImageDraw.Draw(sh).rounded_rectangle([pad + bez, pad + bez * 3, pad + bw - bez, pad + bh + side + bez * 2], r_out, fill=150)
    sh = sh.filter(ImageFilter.GaussianBlur(width * 0.05))
    img.alpha_composite(Image.merge('RGBA', (Image.new('L', img.size, 0),) * 3 + (sh,)))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([pad, pad + side, pad + bw - 1, pad + bh + side - 1], r_out, fill=(8, 6, 11, 255))
    d.rounded_rectangle([pad, pad, pad + bw - 1, pad + bh - 1], r_out, fill=(22, 19, 27, 255), outline=(78, 70, 90, 255), width=max(2, width // 300))
    mask = Image.new('L', (width * 2, h * 2), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, width * 2 - 1, h * 2 - 1], r_in * 2, fill=255)
    mask = mask.resize((width, h), Image.LANCZOS)
    s = scr.convert('RGBA')
    s.putalpha(mask)
    img.alpha_composite(s, (pad + bez, pad + bez))
    return img, pad


def tessera(size, color, radius_frac=0.2):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle([0, 0, size - 1, size - 1], int(size * radius_frac), fill=color + (255,))
    return img


def ribbon(canvas, offset_x, total_w, W, H, unit):
    """One band of tiles along a slow wave, continuous across every slide:
    a tile's place depends on its x in the whole six-slide strip, so the
    two halves of a pair (and one pair to the next) meet exactly."""
    rng = np.random.default_rng(3)
    step = 64 * unit
    n = int(total_w / step) + 4
    for i in range(n):
        gx = i * step - step
        jit = rng.uniform(-1, 1, 4)
        x = gx - offset_x
        if x < -200 * unit or x > W + 200 * unit:
            continue
        # Two waves added: one long swell across the pairs, one ripple.
        y = H * 0.66 + math.sin(gx / total_w * math.pi * 3.0 + 0.6) * H * 0.07 + math.sin(gx / (520 * unit)) * 34 * unit
        for row in (-1, 0, 1):
            if row != 0 and rng.random() < 0.18:
                continue
            size = int((52 + jit[1] * 6) * unit * (0.86 if row else 1.0))
            ang = math.degrees(math.atan2(math.cos(gx / total_w * math.pi * 3.0 + 0.6) * H * 0.075 * math.pi * 3 / total_w, 1)) + jit[2] * 7
            col = ACCENTS[(i * 5 + row * 3) % 12]
            t = tessera(size, col).rotate(-ang, resample=Image.BICUBIC, expand=True)
            alpha = 1.0 if row == 0 else 0.7
            t.putalpha(t.getchannel('A').point(lambda v, a=alpha: int(v * a)))
            canvas.alpha_composite(t, (int(x + jit[0] * 6 * unit - t.width / 2), int(y + row * 66 * unit + jit[3] * 5 * unit - t.height / 2)))


def big_tessera(canvas, cx, cy, size, color, angle, unit):
    """Two nested tiles, turned across the seam, with a fine gold edge on
    the outer one - the shape that makes a pair one picture."""
    for frac, tone, edge in ((1.0, color, True), (0.6, tuple(min(255, c + 10) for c in color), False)):
        n = int(size * frac)
        img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
        ImageDraw.Draw(img).rounded_rectangle([0, 0, n - 1, n - 1], int(n * 0.16), fill=tone + (255,),
                                               outline=(GOLD + (70,)) if edge else None, width=max(2, int(3 * unit)))
        img = img.rotate(angle, resample=Image.BICUBIC, expand=True)
        canvas.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))


def render(W, H, phone_frac, head_size, sub_size, head_top, phone_top, folder):
    unit = W / 1320
    total_w = W * 6
    os.makedirs(os.path.join(OUT, folder), exist_ok=True)
    for pair in range(3):
        canvas = Image.new('RGBA', (W * 2, H), GROUNDS[pair] + (255,))
        # The pair's shared shape, turned across the seam.
        big_tessera(canvas, W, H * 0.5, int(W * 1.3), TILE_TONE[pair], 14 + pair * 9, unit)
        ribbon(canvas, pair * 2 * W, total_w, W * 2, H, unit)
        d = ImageDraw.Draw(canvas)
        for k in range(2):
            shot, lines, gold, line = SLIDES[pair * 2 + k]
            cx = W * k + W / 2
            y = headline(d, lines, gold, cx, head_top, head_size)
            sub(d, line, cx, y + head_size * 0.18, sub_size)
            ph, pad = phone(shot, int(W * phone_frac))
            # Each phone leans a touch toward the seam, so the pair faces in.
            tilt = -3.2 if k == 0 else 3.2
            ph = ph.rotate(tilt, resample=Image.BICUBIC, expand=True)
            nudge = W * 0.035 * (1 if k == 0 else -1)
            canvas.alpha_composite(ph, (int(cx + nudge - ph.width / 2), int(phone_top - pad * 0.9)))
        for k in range(2):
            n = pair * 2 + k + 1
            canvas.crop((W * k, 0, W * (k + 1), H)).convert('RGB').save(os.path.join(OUT, folder, f'{n:02d}.png'), optimize=True)
        canvas.convert('RGB').resize((W, H // 2)).save(os.path.join(OUT, folder, f'pair-{pair + 1}-preview.jpg'), quality=88)


if __name__ == '__main__':
    render(1320, 2868, phone_frac=0.64, head_size=128, sub_size=44, head_top=250, phone_top=700, folder='ios-6.9')
    render(1080, 1920, phone_frac=0.52, head_size=92, sub_size=34, head_top=140, phone_top=450, folder='android')
    print('done')
