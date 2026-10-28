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


# --- The lifted tile (2026-10-28) -----------------------------------------
# Four glazed tiles meet in the great star, as azulejos do on a wall, and
# one of them is lifted out of its socket: its thickness shows along its
# inner edges and the empty socket shows dark behind it. A tessera about
# to be set - the picture almost complete, the move about to be made. It
# replaced the single flat star-and-cross tile, which was handsome but
# said nothing about play. Depth by geometry only: every tile carries a
# glazed rim (lit top and left, shaded bottom and right), no gradients.
#
# Tried and rejected on the way: the lifted tile tilted a few degrees
# (cut by the icon's edge, it read as a glitch at small sizes); the lift
# without the rims (the tiles read as flat colour, the story too faint).

GROUT = (0x5C, 0x1A, 0x4B)
SOCKET = (0x46, 0x12, 0x39)
SIDE = (0x66, 0x1E, 0x55)
UNDERSIDE = (0x55, 0x18, 0x47)
RIM_LIGHT = (0xA8, 0x4A, 0x90)
RIM_DARK = (0x6E, 0x22, 0x5C)

PALETTE = {
    'ground': MAGENTA, 'star': CHALK, 'accent': OCHRE, 'grout': GROUT, 'socket': SOCKET,
    'side': SIDE, 'underside': UNDERSIDE, 'light': RIM_LIGHT, 'dark': RIM_DARK,
}


def _wall(size, pal):
    """The four tiles' pattern before grout: one great star at the centre,
    quarters of the neighbours' at the corners, halves of the cross."""
    im = Image.new('RGB', (int(size), int(size)), pal['ground'])
    d = ImageDraw.Draw(im)
    u = lambda v: v * size
    d.polygon(_star_points(u(0.5), u(0.5), u(0.34)), fill=pal['star'])
    for cx, cy in [(0, 0), (size, 0), (0, size), (size, size)]:
        d.polygon(_star_points(cx, cy, u(0.2)), fill=pal['star'])
    for cx, cy in [(u(0.5), 0), (u(0.5), size), (0, u(0.5)), (size, u(0.5))]:
        d.polygon(_diamond(cx, cy, u(0.085)), fill=pal['accent'])
    d.polygon(_diamond(u(0.5), u(0.5), u(0.095)), fill=pal['accent'])
    return im


def _rim(d, x0, y0, x1, y1, w, pal):
    d.polygon([(x0, y0), (x1, y0), (x1 - w, y0 + w), (x0 + w, y0 + w)], fill=pal['light'])
    d.polygon([(x0, y0), (x0 + w, y0 + w), (x0 + w, y1 - w), (x0, y1)], fill=pal['light'])
    d.polygon([(x0, y1), (x0 + w, y1 - w), (x1 - w, y1 - w), (x1, y1)], fill=pal['dark'])
    d.polygon([(x1, y0), (x1, y1), (x1 - w, y1 - w), (x1 - w, y0 + w)], fill=pal['dark'])


def compose(big, pal=PALETTE):
    """The icon at `big` pixels square (draw large, then downsample)."""
    g = big * 0.024
    h = big / 2
    rim = big * 0.012
    base = _wall(big, pal)
    im = base.copy()
    d = ImageDraw.Draw(im)
    for x0, y0, x1, y1 in [(0, 0, h - g / 2, h - g / 2), (0, h + g / 2, h - g / 2, big), (h + g / 2, h + g / 2, big, big)]:
        _rim(d, x0, y0, x1, y1, rim, pal)
    d.rectangle([h - g / 2, 0, h + g / 2, big], fill=pal['grout'])
    d.rectangle([0, h - g / 2, big, h + g / 2], fill=pal['grout'])
    # The lifted tile, out along the diagonal from the star's heart.
    x0, y0, x1, y1 = h + g / 2, 0, big, h - g / 2
    tile = base.crop((int(x0), int(y0), int(x1), int(y1)))
    d.rectangle([x0, y0, x1, y1], fill=pal['socket'])
    off = big * 0.05
    thick = big * 0.042
    nx, ny = x0 + off, y0 - off
    tw, th = tile.size
    d.polygon([(nx, ny), (nx - thick, ny + thick), (nx - thick, ny + th + thick), (nx, ny + th)], fill=pal['side'])
    d.polygon([(nx, ny + th), (nx - thick, ny + th + thick), (nx + tw - thick, ny + th + thick), (nx + tw, ny + th)], fill=pal['underside'])
    im.paste(tile, (int(nx), int(ny)))
    _rim(d, nx, ny, nx + tw, ny + th, rim, pal)
    return im


def render(size, pal=PALETTE):
    return compose(size * SS, pal).resize((size, size), Image.LANCZOS)


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
        # The whole wall, edge to edge: a launcher shows the middle 72dp
        # through its mask, and the icon's story - the star's heart and the
        # lifted tile's corner - is all in that middle.
        big = px * SS
        canvas = compose(big).convert('RGBA')
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


# --- iOS 18 appearance variants (2026-09-30) -------------------------------
# Dark: the same tilework on the app's night ground, so the icon sits with
# a dark home screen instead of glowing magenta on it. Tinted: the glyphs
# alone in greys on black - iOS colours them itself from the luminance.



def render_variant(size, pal):
    return render(size, pal)


NIGHT_PALETTE = {
    'ground': (0x5A, 0x1D, 0x4B), 'star': (0xE8, 0xDF, 0xCC), 'accent': OCHRE, 'grout': (0x24, 0x0B, 0x1F),
    'socket': (0x15, 0x10, 0x1B), 'side': (0x3A, 0x11, 0x31), 'underside': (0x2E, 0x0D, 0x27),
    'light': (0x74, 0x30, 0x63), 'dark': (0x40, 0x14, 0x36),
}
TINT_PALETTE = {
    'ground': (0x3A, 0x3A, 0x3A), 'star': (0xF2, 0xF2, 0xF2), 'accent': (0x9A, 0x9A, 0x9A), 'grout': (0, 0, 0),
    'socket': (0, 0, 0), 'side': (0x22, 0x22, 0x22), 'underside': (0x18, 0x18, 0x18),
    'light': (0x55, 0x55, 0x55), 'dark': (0x26, 0x26, 0x26),
}


def variants():
    root = os.environ.get('REPO', os.path.join(os.path.dirname(__file__), '..'))
    base = os.path.join(root, 'ios/GravityInit/Images.xcassets/AppIcon.appiconset')
    save(render_variant(1024, NIGHT_PALETTE), os.path.join(base, 'icon-1024-dark.png'))
    save(render_variant(1024, TINT_PALETTE), os.path.join(base, 'icon-1024-tinted.png'))


if __name__ == '__main__' and os.environ.get('ICON_VARIANTS'):
    variants()
