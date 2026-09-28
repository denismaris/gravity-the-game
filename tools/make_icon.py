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

from PIL import Image, ImageDraw

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


def draw_tile(d, size):
    u = lambda v: v * size
    d.rectangle([0, 0, size, size], fill=MAGENTA)
    r = u(STAR_R)
    d.polygon(_star_points(u(0.5), u(0.5), r), fill=CHALK)
    # Quarter stars at the corners: the neighbouring tiles' share.
    for cx, cy in [(0, 0), (size, 0), (0, size), (size, size)]:
        d.polygon(_star_points(cx, cy, r), fill=CHALK)
    # Half diamonds at the edge midpoints, likewise.
    for cx, cy in [(u(0.5), 0), (u(0.5), size), (0, u(0.5)), (size, u(0.5))]:
        d.polygon(_diamond(cx, cy, u(EDGE_DIAMOND)), fill=OCHRE)
    d.polygon(_diamond(u(0.5), u(0.5), u(HEART)), fill=OCHRE)


def render(size):
    big = size * SS
    im = Image.new('RGB', (big, big), MAGENTA)
    draw_tile(ImageDraw.Draw(im), big)
    return im.resize((size, size), Image.LANCZOS)


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
        big = px * SS
        canvas = Image.new('RGBA', (big, big), (0, 0, 0, 0))
        d = ImageDraw.Draw(canvas)
        c = big / 2
        scale = 72 / 108
        d.polygon(_star_points(c, c, big * STAR_R * scale * 1.6), fill=CHALK)
        d.polygon(_diamond(c, c, big * HEART * scale * 1.6), fill=OCHRE)
        save(canvas.resize((px, px), Image.LANCZOS),
             os.path.join(root, 'android/app/src/main/res/mipmap-' + suffix, 'ic_launcher_foreground.png'))

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
