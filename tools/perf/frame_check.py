#!/usr/bin/env python3
"""
Frame-drop check for a screen recording.

Reads a simulator or device recording (.mov/.mp4), samples it at 60 fps and
reports every stall: a run of identical frames in the middle of motion.
A single repeated frame is normal for simulator recordings (they are
variable-rate). A hitch is motion that freezes for three or more frames
and then jumps to catch up: the frame after the freeze changes more than
the frames before it did. A board simply at rest between two moves also
shows identical frames, but nothing catches up after it, so it is not
counted; neither is any pause longer than a third of a second.

  python3 tools/perf/frame_check.py recording.mov [--min-run 3] [--fps 60]

Exit code 1 when any stall is found, so it can gate a release check.
"""
import argparse
import glob
import os
import shutil
import subprocess
import sys
import tempfile

try:
    import numpy as np
    from PIL import Image
except ImportError:
    sys.exit('needs numpy and Pillow: pip3 install numpy pillow')

MOTION = 0.12   # mean pixel change that counts as "moving"
STILL = 0.004   # at or below this, two frames are the same
MAX_RUN = 20     # longer than this is a pause, not a hitch


def frames(path: str, fps: int):
    tmp = tempfile.mkdtemp(prefix='framecheck')
    try:
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-vf', f'fps={fps},scale=240:-1', f'{tmp}/f_%05d.png'], check=True)
        files = sorted(glob.glob(f'{tmp}/f_*.png'))
        return [np.asarray(Image.open(f).convert('L')).astype(np.float32) for f in files]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def stalls(images, min_run: int):
    diffs = [float(abs(images[i + 1] - images[i]).mean()) for i in range(len(images) - 1)]
    found = []
    i = 0
    while i < len(diffs):
        if diffs[i] <= STILL:
            j = i
            while j < len(diffs) and diffs[j] <= STILL:
                j += 1
            lead = diffs[max(0, i - 3):i]
            before = sum(lead) / len(lead) if lead else 0
            after = diffs[j] if j < len(diffs) else 0
            run = j - i
            caught_up = after > MOTION and after >= 1.5 * before
            if min_run <= run <= MAX_RUN and before > MOTION and caught_up:
                found.append((i, run))
            i = j
        else:
            i += 1
    return diffs, found


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('recording')
    ap.add_argument('--min-run', type=int, default=3)
    ap.add_argument('--fps', type=int, default=60)
    args = ap.parse_args()
    images = frames(args.recording, args.fps)
    diffs, found = stalls(images, args.min_run)
    moving = sum(1 for d in diffs if d > MOTION)
    name = os.path.basename(args.recording)
    if not found:
        print(f'{name}: smooth ({len(images)} frames, {moving} moving)')
        return
    for start, run in found:
        print(f'{name}: stall of {run} frames ({run * 1000 // args.fps} ms) at {start / args.fps:.2f}s')
    sys.exit(1)


if __name__ == '__main__':
    main()
