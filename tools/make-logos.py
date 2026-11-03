"""Cut the logos for the "Trusted By" ticker down to what the strip needs.

Reads

  public/images/logos/src/<id>.<ext>   the logo as it arrived

and writes

  public/images/logos/<id>.png         trimmed to the mark, 108px tall

Logos arrive however a school or league happened to hand them over: a
transparent PNG cut to the mark, or a small JPEG with the mark floating in a
white square. Drawn at a fixed height, the white square counts toward that
height and the mark inside it comes out a fraction of the size of the rest, so
each one is trimmed to its mark first. A logo that came cut out is trimmed to
its opaque pixels; one that came on a background is trimmed to whatever differs
from that background, plus a couple of pixels so the anti-aliased edge isn't
clipped. The background itself is left on: the strip is white, and so is every
background these came on, so it disappears on the page without the risk of a
knock-out eating into white that belongs to the logo — the baseball in the
middle of the North Shore and MSBL marks, the lettering around the North Shore
ring.

A logo that came as a lockup — a mark with the name set out beside it — can be
cut down to the mark first (MARK_ONLY below). The strip prints the name next to
every logo anyway, and a wide lockup drawn at the strip's height leaves its mark
a fraction of the size of the crests around it.

The strip draws a logo no taller than 36px (see logoSize() in app/page.tsx),
so 108px covers a 3x screen. Nothing is scaled up: Berry's arrived at 220px
square with a mark 57px tall, and that stays its height — still about two
device pixels per CSS pixel at the size it's drawn.

Each file is saved as a 256-colour PNG. These are flat-colour marks, so the
palette is indistinguishable from full colour even at 3x, at about a third of
the bytes — the strip sits on the first screen, so every logo loads up front.

Needs pillow and numpy.

    python3 tools/make-logos.py            # from the repo root

It prints each logo's size for the CLIENTS list in app/page.tsx.
"""

import os

import numpy as np
from PIL import Image

SRC_DIR = 'public/images/logos/src'
OUT_DIR = 'public/images/logos'

# Three times the tallest the strip ever draws a logo.
OUT_H = 108

# How far a pixel has to sit from the background colour to count as the logo.
# JPEG ringing around a mark on white reaches about 10; the palest ink in these
# logos is a long way past 24.
INK = 24

# Margin kept around a mark trimmed off a background, for its soft edge.
PAD = 2

# id -> the file as it arrived. The ids are the file names the page asks for.
LOGOS = {
    'georgetown': 'georgetown.png',
    'north-shore-navigators': 'north-shore-navigators.jpg',
    'high-point': 'high-point.png',
    'socal-msbl': 'socal-msbl.png',
    'cal-state-bakersfield': 'cal-state-bakersfield.png',
    'berrys-athletic-supply': 'berrys-athletic-supply.jpg',
    'siena': 'siena.png',
    'highlands': 'highlands.jpg',
}

# Lockups the strip takes the mark from, as a box in the file's own pixels;
# trim() then tightens it to the mark. Highlands is the ram with "HIGHLANDS
# GOLDEN RAMS" set in two lines beside it, 4.5:1 overall. Whole, the ram would
# come out 21px tall and the gold lettering about 8px; the box ends halfway
# across the gap between the two.
MARK_ONLY = {
    'highlands': (0, 0, 157, 123),
}


def trim(im):
    """Crop to the mark, whether it came cut out or on a background."""
    a = np.asarray(im).astype(int)
    alpha = a[..., 3]
    if alpha.min() < 255:
        # Cut out already: the mark is whatever is opaque. A whisper of alpha
        # left at the canvas edge by an export isn't part of it.
        keep = alpha > 8
        pad = 0
    else:
        # On a background: take its colour off the border, then keep whatever
        # is far enough from it to be ink rather than compression noise.
        rim = np.concatenate([a[0, :, :3], a[-1, :, :3], a[:, 0, :3], a[:, -1, :3]])
        bg = np.median(rim, axis=0)
        keep = np.abs(a[..., :3] - bg).max(axis=2) > INK
        pad = PAD
    ys, xs = np.nonzero(keep)
    h, w = alpha.shape
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0),
           min(xs.max() + 1 + pad, w), min(ys.max() + 1 + pad, h))
    return im.crop(box), alpha.min() < 255


def main():
    for logo_id, src in LOGOS.items():
        im = Image.open(os.path.join(SRC_DIR, src)).convert('RGBA')
        if logo_id in MARK_ONLY:
            im = im.crop(MARK_ONLY[logo_id])
        mark, cut_out = trim(im)
        if mark.height > OUT_H:
            width = round(mark.width * OUT_H / mark.height)
            mark = mark.resize((width, OUT_H), Image.LANCZOS)
        # Only fast octree quantises with alpha; median cut is the better
        # palette where there's none to keep.
        if cut_out:
            mark = mark.quantize(256, Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        else:
            mark = mark.convert('RGB').quantize(256, Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        out = os.path.join(OUT_DIR, logo_id + '.png')
        mark.save(out, 'PNG', optimize=True)
        print(f"{out}  {mark.width}x{mark.height}  {os.path.getsize(out) // 1024}KB"
              f"   -> {{ logo: '{logo_id}', width: {mark.width}, height: {mark.height} }}")


if __name__ == '__main__':
    main()
