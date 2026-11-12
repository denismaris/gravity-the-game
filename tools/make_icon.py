"""
Tessera's app icon, for both platforms, from one script.

Re-run it after changing anything here; never hand-edit the PNGs.

    python3 tools/make_icon.py                # writes into the repo
    OUT=/tmp python3 tools/make_icon.py       # also writes preview sheets
    REPO=/tmp/x python3 tools/make_icon.py    # writes a copy elsewhere

THE MARK
--------
A Portuguese *azulejo*: the eight-pointed star-and-cross, the Moorish motif
Portugal inherited and then covered half of Lisbon with.

It is the right mark for this app beyond looking Portuguese. A *tessera* is
one tile of a mosaic, and this is a pattern that only resolves as a wall -
the star at the centre is whole, the four at the corners are quarters that
their neighbours would complete, and the pattern runs off all four edges.
One tile is a fragment. That is the app: eight games that are each a piece
of one thing.

WHAT WAS TRIED AND REJECTED (four marks, all of it useful)
----------------------------------------------------------
  * the `bloom` poster's flower drawn literally - an icon of a blossom says
    gardening, and it collided with Tents and Trees' own emblem
  * a disc with one quadrant lifted out - read as a pie chart
  * this same star, but sparse: one motif marooned in empty ground with the
    warm colour reduced to a dot. Rejected as bland, correctly. The fix was
    density: full bleed, motifs breaking every edge, and the accent carrying
    real area instead of a highlight
  * real azulejo cobalt. Authentic, and built - but it shared no hue with
    the rest of the app, and on a blue wallpaper the icon half-vanished

COLOUR
------
    magenta #8E2F76   the glaze
    chalk   #F2EDDF   the tin-white ground; never pure white, real azulejo
                      white is warm
    ochre   #D9A441   the yellow Portuguese polychrome tiles use beside
                      blue and white

The magenta sits deliberately between two of the app's own accents -
Skyscrapers' plum-violet (#7E3D96, hue 285) and Arukone+'s deep wine
(#9B3B52, hue 344) - so it belongs to the same family as the interior
without being any single game's colour. Using `towersAccent` itself was
the obvious literal reading of "the app's magenta" and is the one thing
not to do: that colour *means Skyscrapers* inside the app, and handing it
to the whole app's icon would rebuild exactly the identity collision the
Gravity -> Tessera rename just removed.

Ochre beats the app's own `accent` ochre (#B7892F) here, and terracotta,
both of which go muddy against this ground. Four grounds and three accents
were rendered against each other and under an approximation of the iOS
superellipse mask before these were picked.
"""
import math
import os

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

MAGENTA = (0x8E, 0x2F, 0x76)
CHALK = (0xF2, 0xED, 0xDF)
OCHRE = (0xD9, 0xA4, 0x41)

SS = 4

STAR_R = 0.235
"""Outer radius of each star, as a fraction of the tile. Small enough that
the centre star and the corner quarters stay clear of one another."""

STAR_WAIST = 0.42
"""Inner radius as a fraction of the outer. Lower is spikier; this is about
where the points stop reading as a compass rose and start reading as
tilework."""

EDGE_DIAMOND = 0.118
"""Half-diagonal of the ochre diamonds at the edge midpoints. These are the
halves of the 'cross' in star-and-cross, and they are what gives the accent
real area rather than a dot."""

HEART = 0.072
"""Half-diagonal of the ochre diamond at the centre of the middle star."""


def _star_points(cx, cy, r, points=8, phase=-90):
    out = []
    for k in range(points * 2):
        a = math.radians(k * (180 / points) + phase)
        rad = r if k % 2 == 0 else r * STAR_WAIST
        out.append((cx + math.cos(a) * rad, cy + math.sin(a) * rad))
    return out


def _diamond(cx, cy, r):
    return [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]


# --- The glazed four (2026-10-28) ------------------------------------------
# Four plump glazed tiles, like pillows of fired ceramic, on a deep plum
# ground: each catches the light top-left, has a soft rim and a gloss
# across its upper half, and casts a soft shadow. The great star lies
# across all four in cream enamel, carved - every point two facets, one
# lit, one shaded - and a polished gold gem holds the four together where
# they meet, like a clasp. The top-right tile is lifted out of its place,
# floating on a longer shadow: a tessera about to be set.
#
# The app's own UI keeps depth to geometry; the icon alone is lit and
# glossed, at the player's request - a home-screen icon is a small
# object, and this one is meant to look like one worth picking up.
#
# Before it: the same four tiles flat with geometric rims (liked as an
# idea, but "nothing wow"); a single flat star-and-cross tile.

# The ground: the app's own warm paper, lit at the centre - the mark as
# the launch shows it, on the page (2026-10-29: the near-black plum read
# heavy on a home screen). Night keeps a deep plum, for iOS's dark icon.
GROUND_IN = (0xFD, 0xF9, 0xF1)
GROUND_OUT = (0xEA, 0xDF, 0xCC)
NIGHT_IN = (0x3A, 0x0E, 0x30)
NIGHT_OUT = (0x1E, 0x06, 0x19)
# Shadows fall warm and soft on paper; on the night ground, deep.
SHADOW_DAY = ((0x5A, 0x22, 0x4C), 0.72)
SHADOW_NIGHT = ((10, 0, 8), 1.0)
TILE_HI = (0xC4, 0x55, 0xA6)
TILE_MID = (0x93, 0x2F, 0x7B)
TILE_LO = (0x5E, 0x17, 0x4E)
CREAM_HI = (0xFF, 0xFB, 0xF1)
CREAM_LO = (0xD6, 0xC2, 0x9E)
GOLD_HI = (0xFF, 0xE2, 0x8A)
GOLD_MID = (0xE0, 0xA8, 0x3A)
GOLD_LO = (0x9C, 0x67, 0x14)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def grad3(w, h, hi, mid, lo, angle=45, bias=0.0):
    """A three-stop linear gradient across a w x h box, lit from top-left."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    a = math.radians(angle)
    t = ((x / max(1, w - 1)) * math.cos(a) + (y / max(1, h - 1)) * math.sin(a)) / (math.cos(a) + math.sin(a))
    t = np.clip(t + bias, 0, 1)
    out = np.zeros((h, w, 3), np.float32)
    for i in range(3):
        top = np.where(t < 0.5, hi[i] + (mid[i] - hi[i]) * (t / 0.5), mid[i] + (lo[i] - mid[i]) * ((t - 0.5) / 0.5))
        out[..., i] = top
    return Image.fromarray(out.astype(np.uint8))


def radial(w, h, inner, outer, cx=0.5, cy=0.42, r=0.75):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((x / w - cx) / r) ** 2 + ((y / h - cy) / r) ** 2)
    t = np.clip(d, 0, 1)[..., None]
    out = np.array(inner, np.float32) * (1 - t) + np.array(outer, np.float32) * t
    return Image.fromarray(out.astype(np.uint8))


def star_points(cx, cy, r, waist=0.42, points=8, phase=-90):
    out = []
    for k in range(points * 2):
        a = math.radians(k * (180 / points) + phase)
        rad = r if k % 2 == 0 else r * waist
        out.append((cx + math.cos(a) * rad, cy + math.sin(a) * rad))
    return out


def diamond(cx, cy, r):
    return [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]


def mask_of(size, draw_fn):
    m = Image.new('L', (size, size), 0)
    draw_fn(ImageDraw.Draw(m))
    return m


def puffy_tile(w, radius):
    """One pillow tile: glazed body, a soft dark rim at the bottom-right, a
    bright rim at the top-left, and a gloss streak across its upper half."""
    body = grad3(w, w, TILE_HI, TILE_MID, TILE_LO)
    m = Image.new('L', (w, w), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, w - 1], radius=radius, fill=255)
    # Inner shading: darken toward the edges (the puff).
    inner = m.filter(ImageFilter.GaussianBlur(w * 0.06))
    shade = Image.new('RGB', (w, w), TILE_LO)
    body = Image.composite(body, shade, inner.point(lambda v: min(255, int(v * 1.25))))
    tile = Image.new('RGBA', (w, w), (0, 0, 0, 0))
    tile.paste(body, (0, 0), m)
    # Bright rim along the top-left edge.
    rim = Image.new('L', (w, w), 0)
    ImageDraw.Draw(rim).rounded_rectangle([0, 0, w - 1, w - 1], radius=radius, outline=255, width=max(2, int(w * 0.018)))
    rim_mask = ImageChops.multiply(rim, grad3(w, w, (255, 255, 255), (90, 90, 90), (0, 0, 0)).convert('L'))
    tile = Image.alpha_composite(tile, Image.merge('RGBA', (*Image.new('RGB', (w, w), (255, 220, 245)).split(), rim_mask.point(lambda v: int(v * 0.75)))))
    return tile, m


def gloss(w, radius, strength=0.26):
    """A soft specular sweep over the upper-left of a tile."""
    g = Image.new('L', (w, w), 0)
    d = ImageDraw.Draw(g)
    d.ellipse([-w * 0.25, -w * 0.55, w * 0.95, w * 0.42], fill=255)
    g = g.filter(ImageFilter.GaussianBlur(w * 0.05))
    m = Image.new('L', (w, w), 0)
    ImageDraw.Draw(m).rounded_rectangle([w * 0.04, w * 0.04, w * 0.96, w * 0.96], radius=radius, fill=255)
    g = ImageChops.multiply(g, m)
    fade = grad3(w, w, (255, 255, 255), (120, 120, 120), (0, 0, 0), angle=90).convert('L')
    g = ImageChops.multiply(g, fade).point(lambda v: int(v * strength))
    return Image.merge('RGBA', (*Image.new('RGB', (w, w), (255, 255, 255)).split(), g))


def shadow(size, rect, radius, blur, alpha, dy):
    m = Image.new('L', (size, size), 0)
    x0, y0, x1, y1 = rect
    ImageDraw.Draw(m).rounded_rectangle([x0, y0 + dy, x1, y1 + dy], radius=radius, fill=alpha)
    return m.filter(ImageFilter.GaussianBlur(blur))


def enamel(size, polys, hi, lo, lift=0.006, extra=None):
    """Raised enamel shapes: their own gradient, a dark under-edge, a light
    top-edge, as if poured proud of the glaze."""
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    for p in polys:
        d.polygon(p, fill=255)
    body = grad3(size, size, hi, lerp(hi, lo, 0.5), lo, angle=60)
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    # under-edge
    under = ImageChops.offset(m, int(size * lift), int(size * lift * 1.4)).filter(ImageFilter.GaussianBlur(size * 0.004))
    layer.paste((0, 0, 0, 110), (0, 0), under)
    layer.paste(body, (0, 0), m)
    # top highlight edge
    top = ImageChops.subtract(m, ImageChops.offset(m, int(size * 0.004), int(size * 0.004)))
    layer.paste((255, 255, 255, 200), (0, 0), top.filter(ImageFilter.GaussianBlur(1)))
    return layer


def faceted_star(size, cx, cy, r, waist=0.42):
    """The star carved: each point two facets, the one facing the light
    (top-left) bright, the other shaded, with a hairline ridge between."""
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    light = math.radians(225)
    for k in range(8):
        a = math.radians(-90 + k * 45)
        tip = (cx + math.cos(a) * r, cy + math.sin(a) * r)
        wl = (cx + math.cos(a - math.pi / 8) * r * waist, cy + math.sin(a - math.pi / 8) * r * waist)
        wr = (cx + math.cos(a + math.pi / 8) * r * waist, cy + math.sin(a + math.pi / 8) * r * waist)
        for pts, side in (([(cx, cy), wl, tip], -1), ([(cx, cy), tip, wr], 1)):
            normal = a + side * math.pi / 2
            lit = 0.5 + 0.5 * math.cos(normal - light)
            d.polygon(pts, fill=lerp(CREAM_LO, CREAM_HI, 0.15 + 0.85 * lit) + (255,))
    return layer


def compose_layers(size, night=False):
    """The icon as its separate layers, each a full `size` square RGBA:
    the ground, the four tiles (each with its own shadow, its share of the
    star and its gloss; the lifted one last), and the gem. The app's own
    mark and its launch animation are built from these same layers."""
    S = size
    ground = radial(S, S, NIGHT_IN if night else GROUND_IN, NIGHT_OUT if night else GROUND_OUT, r=0.8).convert('RGBA')
    shade_col, shade_k = SHADOW_NIGHT if night else SHADOW_DAY
    soften = lambda m: m.point(lambda v: int(v * shade_k))
    gap = S * 0.016
    margin = S * 0.08
    tw = (S - 2 * margin - gap) / 2
    radius = tw * 0.16
    origins = [(margin, margin), (margin + tw + gap, margin), (margin, margin + tw + gap), (margin + tw + gap, margin + tw + gap)]
    lift = S * 0.026
    lifted = 1
    places = [(x + lift, y - lift) if i == lifted else (x, y) for i, (x, y) in enumerate(origins)]
    tw_i = int(round(tw))
    tile_img, tile_mask = puffy_tile(tw_i, int(radius))
    gl = gloss(tw_i, int(radius))
    cx, cy = S / 2, S / 2
    star_full = faceted_star(S, cx, cy, S * 0.4)
    tiles = []
    for i, (x, y) in enumerate(places):
        far = i == lifted
        layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        # its shadow: the lifted tile casts a longer, softer one
        sh = shadow(S, (x, y, x + tw, y + tw), radius, S * (0.03 if far else 0.014), 170 if far else 140, S * (0.04 if far else 0.016))
        layer.paste(shade_col + (255,), (0, 0), soften(sh))
        ox, oy = origins[i]
        face = Image.new('RGBA', (tw_i, tw_i), (0, 0, 0, 0))
        face.alpha_composite(tile_img)
        # the carved star's share of this tile, with a soft under-shadow
        piece = star_full.crop((int(round(ox)), int(round(oy)), int(round(ox)) + tw_i, int(round(oy)) + tw_i))
        alpha = ImageChops.multiply(piece.split()[3], tile_mask)
        under = ImageChops.offset(alpha, int(S * 0.004), int(S * 0.007)).filter(ImageFilter.GaussianBlur(S * 0.004))
        face.paste((40, 4, 32, 120), (0, 0), ImageChops.multiply(under, tile_mask))
        piece.putalpha(alpha)
        face.alpha_composite(piece)
        face.alpha_composite(gl)
        layer.alpha_composite(face, (int(round(x)), int(round(y))))
        tiles.append(layer)
    # The lifted tile goes on last: its shadow falls over its neighbours.
    tiles = [tiles[0], tiles[2], tiles[3], tiles[1]]
    # The gem: a polished gold stone over the meeting of the four, holding
    # them like a clasp - its own shadow, facets, and a glint.
    gem = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    jr = S * 0.085
    jsh = Image.new('L', (S, S), 0)
    ImageDraw.Draw(jsh).polygon(diamond(cx, cy + S * 0.02, jr), fill=150)
    gem.paste(shade_col + (255,), (0, 0), soften(jsh.filter(ImageFilter.GaussianBlur(S * 0.012))))
    d = ImageDraw.Draw(gem)
    for pts, col in [
        ([(cx, cy - jr), (cx + jr, cy), (cx, cy)], GOLD_HI),
        ([(cx, cy - jr), (cx - jr, cy), (cx, cy)], lerp(GOLD_HI, GOLD_MID, 0.45)),
        ([(cx - jr, cy), (cx, cy + jr), (cx, cy)], GOLD_MID),
        ([(cx + jr, cy), (cx, cy + jr), (cx, cy)], GOLD_LO),
    ]:
        d.polygon(pts, fill=col + (255,))
    # the table: a smaller diamond on top, brightest
    d.polygon(diamond(cx, cy, jr * 0.42), fill=lerp(GOLD_HI, (255, 255, 255), 0.35) + (255,))
    glint = Image.new('L', (S, S), 0)
    ImageDraw.Draw(glint).ellipse([cx - jr * 0.55, cy - jr * 0.62, cx - jr * 0.12, cy - jr * 0.3], fill=230)
    gem.paste((255, 255, 255, 255), (0, 0), glint.filter(ImageFilter.GaussianBlur(S * 0.004)))
    return ground, tiles, gem


def compose(size, night=False):
    ground, tiles, gem = compose_layers(size, night)
    im = ground.copy()
    for layer in tiles:
        im.alpha_composite(layer)
    im.alpha_composite(gem)
    return im.convert('RGB')


def write_mark_layers(root, px=512):
    """The app's own mark, from the icon's layers: a rounded tile (the
    in-app logo) and its separate layers for the launch animation."""
    out = os.path.join(root, 'src/assets/brand')
    os.makedirs(out, exist_ok=True)
    big = px * 2
    ground, tiles, gem = compose_layers(big)
    rounded = Image.new('L', (big, big), 0)
    ImageDraw.Draw(rounded).rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.225), fill=255)
    def done(im):
        return im.resize((px, px), Image.LANCZOS)
    g = ground.copy()
    g.putalpha(rounded)
    save(done(g), os.path.join(out, 'mark-ground.png'))
    for i, layer in enumerate(tiles):
        save(done(layer), os.path.join(out, f'mark-tile-{i}.png'))
    save(done(gem), os.path.join(out, 'mark-gem.png'))
    whole = ground.copy()
    for layer in tiles:
        whole.alpha_composite(layer)
    whole.alpha_composite(gem)
    whole.putalpha(rounded)
    save(done(whole), os.path.join(out, 'mark.png'))


def render(size, pal=None):
    """The icon at `size` px: drawn at twice that, then downsampled."""
    return compose(size * 2).resize((size, size), Image.LANCZOS)


def round_masked(size):
    im = render(size).convert('RGBA')
    mask = Image.new('L', (size * SS, size * SS), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size * SS, size * SS], fill=255)
    im.putalpha(mask.resize((size, size), Image.LANCZOS))
    return im


def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)
    print(path, im.size)


def main():
    root = os.environ.get('REPO', os.path.join(os.path.dirname(__file__), '..'))

    # iOS: opaque and full-bleed. The App Store rejects an icon with an
    # alpha channel, and the system rounds the corners itself.
    ios = os.path.join(root, 'ios/GravityInit/Images.xcassets/AppIcon.appiconset')
    for name, px in [
        ('icon-20x20@2x', 40), ('icon-20x20@3x', 60),
        ('icon-29x29@2x', 58), ('icon-29x29@3x', 87),
        ('icon-40x40@2x', 80), ('icon-40x40@3x', 120),
        ('icon-60x60@2x', 120), ('icon-60x60@3x', 180),
        ('icon-1024x1024@1x', 1024),
    ]:
        save(render(px), os.path.join(ios, name + '.png'))

    for suffix, px in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
        base = os.path.join(root, 'android/app/src/main/res/mipmap-' + suffix)
        save(render(px), os.path.join(base, 'ic_launcher.png'))
        save(round_masked(px), os.path.join(base, 'ic_launcher_round.png'))

    # Android adaptive: a 108dp canvas of which only the middle 72dp is
    # guaranteed visible. The corner stars and edge diamonds belong to the
    # tile's edges and cannot survive that crop, so the foreground carries
    # the centre star alone and the magenta moves to the background layer
    # (`ic_launcher_background` in res/values/colors.xml) - which is also
    # what lets a launcher parallax the two against each other.
    for suffix, px in [('mdpi', 108), ('hdpi', 162), ('xhdpi', 216), ('xxhdpi', 324), ('xxxhdpi', 432)]:
        # The tiles inside the 72dp a launcher always shows; the plum
        # ground is the background colour round them (colors.xml).
        big = px * 2
        canvas = Image.new('RGBA', (big, big), (0, 0, 0, 0))
        inner = int(big * 0.74)
        panel = compose(inner).convert('RGBA')
        # Only the tiles, star and gem: the panel's own ground is let go.
        ground = Image.new('RGBA', panel.size, GROUND_OUT + (255,))
        alpha = ImageChops.difference(panel.convert('RGB'), radial(inner, inner, GROUND_IN, GROUND_OUT, r=0.8)).convert('L').point(lambda v: 255 if v > 18 else 0).filter(ImageFilter.GaussianBlur(1))
        panel.putalpha(alpha)
        canvas.alpha_composite(panel, ((big - inner) // 2, (big - inner) // 2))
        save(canvas.resize((px, px), Image.LANCZOS),
             os.path.join(root, 'android/app/src/main/res/mipmap-' + suffix, 'ic_launcher_foreground.png'))

    write_mark_layers(root)

    out = os.environ.get('OUT')
    if out:
        sheet = Image.new('RGB', (1024 + 40, 1024 + 240), (250, 248, 244))
        sheet.paste(render(1024), (20, 20))
        x = 20
        for px in (180, 120, 87, 60, 40):
            sheet.paste(render(px), (x, 1064))
            x += px + 24
        sheet.save(os.path.join(out, 'icon-preview.png'))

        tile = render(240)
        wall = Image.new('RGB', (480, 480))
        for gx in (0, 240):
            for gy in (0, 240):
                wall.paste(tile, (gx, gy))
        wall.save(os.path.join(out, 'icon-wall.png'))
        print('previews written')


if __name__ == '__main__':
    main()


# --- iOS 18 appearance variants ----------------------------------------------
# Dark: the same tiles, dimmed a touch, so the icon sits quietly on a dark
# home screen. Tinted: the glyph alone in greys - iOS colours it itself.

def variants():
    root = os.environ.get('REPO', os.path.join(os.path.dirname(__file__), '..'))
    base = os.path.join(root, 'ios/GravityInit/Images.xcassets/AppIcon.appiconset')
    # Dark: the night ground, so the icon sits quietly on a dark screen.
    dark = compose(2048, night=True).resize((1024, 1024), Image.LANCZOS)
    save(dark, os.path.join(base, 'icon-1024-dark.png'))
    tinted = dark.convert('L').point(lambda v: int(min(255, v * 1.15))).convert('RGB')
    save(tinted, os.path.join(base, 'icon-1024-tinted.png'))


if __name__ == '__main__' and os.environ.get('ICON_VARIANTS'):
    variants()
