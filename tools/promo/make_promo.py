"""Tessera promo: a ~22s vertical (1080x1920) video for TikTok, Reels and
Facebook, cut from real simulator footage of the app playing itself.

Layers are drawn with PIL (ffmpeg here has no text filter) and composed per
scene with ffmpeg, then joined with crossfades and scored with the app's own
music and chimes.
"""
import os
import subprocess
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work')
REPO = '/Users/marisdenis/DEV/gravity-the-game'
OUT = os.path.join(HERE, 'out')
LAYERS = os.path.join(HERE, 'layers')
os.makedirs(OUT, exist_ok=True)
os.makedirs(LAYERS, exist_ok=True)

W, H, FPS = 1080, 1920, 30
INK = (21, 16, 27)
CREAM = (239, 227, 204)
TERRACOTTA = (240, 162, 122)
PLUM = (44, 32, 58)
GEORGIA_BOLD = '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
MONO = '/System/Library/Fonts/SFNSMono.ttf'
SANS = '/System/Library/Fonts/SFNS.ttf'

# The phone: the recorded screen, scaled into a rounded frame.
SRC_W, SRC_H = 1206, 2622
PHONE_W = 860
PHONE_H = round(PHONE_W * SRC_H / SRC_W)
PHONE_X = (W - PHONE_W) // 2
PHONE_Y = 300
RADIUS = 80
XFADE = 0.35


def run(args):
    subprocess.run(args, check=True)


def font(path, size):
    return ImageFont.truetype(path, size)


def tracked(draw, xy, text, fnt, fill, tracking):
    """Text with letter-spacing, left-aligned at xy; returns its width."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking
    return x - xy[0] - tracking


def tracked_width(draw, text, fnt, tracking):
    return sum(draw.textlength(ch, font=fnt) for ch in text) + tracking * (len(text) - 1)


# --- Static layers ------------------------------------------------------

def background():
    """Ink, with a soft plum glow behind where the phone stands."""
    img = Image.new('RGB', (W, H), INK)
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W * 0.08, H * 0.28, W * 0.92, H * 0.86], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    img.paste(Image.new('RGB', (W, H), PLUM), (0, 0), glow.point(lambda v: int(v * 0.75)))
    img.save(os.path.join(LAYERS, 'bg.png'))


def phone_layers():
    mask = Image.new('L', (PHONE_W, PHONE_H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, PHONE_W - 1, PHONE_H - 1], RADIUS, fill=255)
    mask.save(os.path.join(LAYERS, 'mask.png'))
    pad = 120
    shadow = Image.new('RGBA', (PHONE_W + pad * 2, PHONE_H + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([pad, pad + 30, pad + PHONE_W, pad + PHONE_H + 30], RADIUS, fill=(0, 0, 0, 170))
    shadow.filter(ImageFilter.GaussianBlur(42)).save(os.path.join(LAYERS, 'shadow.png'))
    rim = Image.new('RGBA', (PHONE_W + 8, PHONE_H + 8), (0, 0, 0, 0))
    ImageDraw.Draw(rim).rounded_rectangle([1, 1, PHONE_W + 6, PHONE_H + 6], RADIUS + 4, outline=(78, 64, 96, 255), width=4)
    rim.save(os.path.join(LAYERS, 'rim.png'))


def headline(name, kicker, title, y=96):
    """A kicker in tracked mono, terracotta, over a serif headline."""
    img = Image.new('RGBA', (W, 230), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = font(MONO, 34)
    kw = tracked_width(d, kicker, k, 8)
    tracked(d, ((W - kw) / 2, 0), kicker, k, TERRACOTTA, 8)
    # Fitted, with a margin either side: long lines shrink, never touch.
    size = 84
    t = font(GEORGIA_BOLD, size)
    while d.textlength(title, font=t) > W - 150 and size > 56:
        size -= 2
        t = font(GEORGIA_BOLD, size)
    tw = d.textlength(title, font=t)
    d.text(((W - tw) / 2, 52 + (84 - size) * 0.6), title, font=t, fill=CREAM)
    img.save(os.path.join(LAYERS, f'head_{name}.png'))
    return y


def caption_bottom(name, text):
    img = Image.new('RGBA', (W, 200), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    t = font(GEORGIA_BOLD, 80)
    tw = d.textlength(text, font=t)
    d.text(((W - tw) / 2, 40), text, font=t, fill=CREAM)
    img.save(os.path.join(LAYERS, f'cap_{name}.png'))


def end_layers():
    icon = Image.open(f'{REPO}/ios/GravityInit/Images.xcassets/AppIcon.appiconset/icon-1024x1024@1x.png').convert('RGBA').resize((300, 300), Image.LANCZOS)
    m = Image.new('L', icon.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, 299, 299], 68, fill=255)
    icon.putalpha(m)
    sh = Image.new('RGBA', (500, 500), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([100, 120, 400, 420], 68, fill=(0, 0, 0, 160))
    sh = sh.filter(ImageFilter.GaussianBlur(34))
    sh.alpha_composite(icon, (100, 100))
    sh.save(os.path.join(LAYERS, 'end_icon.png'))

    word = Image.new('RGBA', (W, 140), (0, 0, 0, 0))
    d = ImageDraw.Draw(word)
    f = font(GEORGIA_BOLD, 104)
    ww = tracked_width(d, 'TESSERA', f, 14)
    tracked(d, ((W - ww) / 2, 10), 'TESSERA', f, CREAM, 14)
    word.save(os.path.join(LAYERS, 'end_word.png'))

    tag = Image.new('RGBA', (W, 90), (0, 0, 0, 0))
    d = ImageDraw.Draw(tag)
    f = font(SANS, 44)
    line = 'Calm puzzles, every day.'
    d.text(((W - d.textlength(line, font=f)) / 2, 10), line, font=f, fill=(196, 182, 206))
    tag.save(os.path.join(LAYERS, 'end_tag.png'))

    pill = Image.new('RGBA', (W, 130), (0, 0, 0, 0))
    d = ImageDraw.Draw(pill)
    f = font(SANS, 38)
    text = 'Coming soon on iPhone & Android'
    tw = d.textlength(text, font=f)
    pw = tw + 96
    x0 = (W - pw) / 2
    d.rounded_rectangle([x0, 20, x0 + pw, 110], 45, fill=CREAM)
    d.text((x0 + 48, 41), text, font=f, fill=INK)
    pill.save(os.path.join(LAYERS, 'end_pill.png'))


# --- Scenes -------------------------------------------------------------

def ease_in(expr_t, start, dur):
    """1 -> 0 over [start, start+dur], eased (for slide offsets)."""
    return f"pow(max(0,1-max(0,({expr_t}-{start}))/{dur}),3)"


def phone_scene(name, clip, start, end, duration, kicker, title):
    """The recorded screen in its frame, gliding up as it arrives, with the
    headline rising in just after. `start`/`end` cut the source, and it is
    retimed to fill `duration`."""
    headline(name, kicker, title)
    speed = (end - start) / duration
    slide = ease_in('t', 0, 0.55)
    text_slide = ease_in('t', 0.18, 0.5)
    graph = (
        f"[1:v]trim={start}:{end},setpts=(PTS-STARTPTS)/{speed:.4f},tpad=stop_mode=clone:stop_duration={duration},fps={FPS},scale={PHONE_W}:{PHONE_H},format=rgba[c];"
        f"[2:v]format=gray,scale={PHONE_W}:{PHONE_H}[m];[c][m]alphamerge[cm];"
        f"[0:v][3:v]overlay=x={PHONE_X - 120}:y='{PHONE_Y - 120}+60*{slide}':format=auto[a];"
        f"[a][cm]overlay=x={PHONE_X}:y='{PHONE_Y}+60*{slide}'[b];"
        f"[b][4:v]overlay=x={PHONE_X - 4}:y='{PHONE_Y - 4}+60*{slide}'[c2];"
        f"[5:v]format=rgba,fade=in:st=0.18:d=0.45:alpha=1[h];"
        f"[c2][h]overlay=x=0:y='96+26*{text_slide}'[v]"
    )
    run([
        'ffmpeg', '-v', 'error', '-y',
        '-loop', '1', '-framerate', str(FPS), '-t', str(duration), '-i', os.path.join(LAYERS, 'bg.png'),
        '-i', os.path.join(HERE, 'cfr', f'{clip}.mp4'),
        '-loop', '1', '-framerate', str(FPS), '-t', str(duration), '-i', os.path.join(LAYERS, 'mask.png'),
        '-loop', '1', '-framerate', str(FPS), '-t', str(duration), '-i', os.path.join(LAYERS, 'shadow.png'),
        '-loop', '1', '-framerate', str(FPS), '-t', str(duration), '-i', os.path.join(LAYERS, 'rim.png'),
        '-loop', '1', '-framerate', str(FPS), '-t', str(duration), '-i', os.path.join(LAYERS, f'head_{name}.png'),
        '-filter_complex', graph, '-map', '[v]', '-t', str(duration), '-r', str(FPS),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', os.path.join(OUT, f'{name}.mp4'),
    ])


def open_scene(duration):
    """The app's own opening, full screen, with the first line under it."""
    caption_bottom('open', 'Twelve calm puzzles.')
    graph = (
        f"[0:v]trim=2.25:{2.25 + duration},setpts=PTS-STARTPTS,fps={FPS},scale={W}:-2,crop={W}:{H}:0:(ih-{H})/2[base];"
        f"[1:v]format=rgba,fade=in:st=0.7:d=0.5:alpha=1[cap];"
        f"[base][cap]overlay=x=0:y='{H - 430}+24*{ease_in('t', 0.7, 0.5)}'[v]"
    )
    run([
        'ffmpeg', '-v', 'error', '-y',
        '-i', os.path.join(HERE, 'cfr', 'launch.mp4'),
        '-loop', '1', '-framerate', str(FPS), '-t', str(duration), '-i', os.path.join(LAYERS, 'cap_open.png'),
        '-filter_complex', graph, '-map', '[v]', '-t', str(duration), '-r', str(FPS),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', os.path.join(OUT, 'open.mp4'),
    ])


def end_scene(duration):
    """Icon, wordmark, line, and the call to action, arriving in turn."""
    def layer(i, at):
        return f"[{i}:v]format=rgba,fade=in:st={at}:d=0.5:alpha=1[l{i}];"
    graph = (
        layer(1, 0.1) + layer(2, 0.45) + layer(3, 0.75) + layer(4, 1.05)
        + f"[0:v][l1]overlay=x=(W-w)/2:y='520+50*{ease_in('t', 0.1, 0.6)}'[a];"
        + f"[a][l2]overlay=x=0:y='1010+30*{ease_in('t', 0.45, 0.5)}'[b];"
        + f"[b][l3]overlay=x=0:y='1160+24*{ease_in('t', 0.75, 0.5)}'[c];"
        + f"[c][l4]overlay=x=0:y='1300+24*{ease_in('t', 1.05, 0.5)}'[v]"
    )
    args = ['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', str(FPS), '-t', str(duration), '-i', os.path.join(LAYERS, 'bg.png')]
    for f in ['end_icon.png', 'end_word.png', 'end_tag.png', 'end_pill.png']:
        args += ['-loop', '1', '-framerate', str(FPS), '-t', str(duration), '-i', os.path.join(LAYERS, f)]
    args += ['-filter_complex', graph, '-map', '[v]', '-t', str(duration), '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', os.path.join(OUT, 'end.mp4')]
    run(args)


# --- Assembly -----------------------------------------------------------

SCENES = [
    # name, clip, source start, source end, on-screen seconds, kicker, title
    ('mirror', 'mirror', 2.6, 7.9, 3.2, 'MIRROR MAZE', 'Bend the light.'),
    ('mosaic', 'mosaic', 2.6, 10.4, 3.1, 'MOSAIC', 'Piece it together.'),
    ('gravity', 'gravity', 2.6, 9.4, 3.0, 'GRAVITY', 'Let it fall.'),
    ('bloom', 'bloom', 2.6, 9.9, 3.0, 'BLOOM', 'Make it bloom.'),
    ('lights', 'lights', 2.3, 6.8, 3.0, 'LIGHTS OUT', 'Earn every star.'),
    ('home', 'home', 2.6, 8.6, 3.1, 'EVERY DAY', 'A new puzzle, every day.'),
    ('board', 'board', 2.95, 3.06, 2.4, 'LEADERBOARDS', 'Race the world.'),
]
OPEN_SECONDS = 2.0
END_SECONDS = 3.2


def main():
    background()
    phone_layers()
    end_layers()
    open_scene(OPEN_SECONDS)
    for scene in SCENES:
        phone_scene(*scene)
    end_scene(END_SECONDS)

    order = ['open'] + [s[0] for s in SCENES] + ['end']
    durations = [OPEN_SECONDS] + [s[4] for s in SCENES] + [END_SECONDS]
    inputs = []
    for n in order:
        inputs += ['-i', os.path.join(OUT, f'{n}.mp4')]
    chain = ''
    offset = 0.0
    last = '[0:v]'
    for i in range(1, len(order)):
        offset += durations[i - 1] - XFADE
        tag = f'[x{i}]'
        chain += f"{last}[{i}:v]xfade=transition=fade:duration={XFADE}:offset={offset:.3f}{tag};"
        last = tag
    total = sum(durations) - XFADE * (len(order) - 1)

    # When things happen on the joined timeline, for the sound.
    starts = []
    t = 0.0
    for i, d in enumerate(durations):
        starts.append(t)
        t += d - XFADE
    mirror_card = starts[1] + (6.4 - 2.6) / ((7.9 - 2.6) / 3.2)
    end_at = starts[-1]

    music = f'{REPO}/ios/GravityInit/Sounds/music_almanac.m4a'
    solve = f'{REPO}/ios/GravityInit/Sounds/sfx_mirror_solve.wav'
    chime = f'{REPO}/ios/GravityInit/Sounds/sfx_chime_harp.wav'
    audio = (
        f"[{len(order)}:a]atrim=0:{total:.3f},asetpts=PTS-STARTPTS,volume=1.5,afade=t=in:st=0:d=0.4,afade=t=out:st={total - 1.6:.3f}:d=1.6[mus];"
        f"[{len(order) + 1}:a]adelay={int(mirror_card * 1000)}|{int(mirror_card * 1000)},volume=0.9[s1];"
        f"[{len(order) + 2}:a]adelay={int((end_at + 0.15) * 1000)}|{int((end_at + 0.15) * 1000)},volume=1.1[s2];"
        f"[mus][s1][s2]amix=inputs=3:normalize=0,atrim=0:{total:.3f}[aout]"
    )
    final = os.path.join(OUT, 'tessera_promo_9x16.mp4')
    run(['ffmpeg', '-v', 'error', '-y', *inputs, '-i', music, '-i', solve, '-i', chime,
         '-filter_complex', chain + audio, '-map', last, '-map', '[aout]',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', str(FPS),
         '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final])
    print(f'{final}  {total:.1f}s')


if __name__ == '__main__':
    main()
