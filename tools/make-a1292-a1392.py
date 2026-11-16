"""Clean up the A1292 / A1392 artwork for "The Ball" section.

Reads

  public/images/a1292-a1392-src.webp   the artwork, as a phone screenshot

and writes

  public/images/a1292-a1392.png        the two balls, clean, on a 16:9 white card

The only copy of the A1292 Classic Series and A1392 Select Series artwork is a
phone screenshot of an image viewer: a white strip across the middle of a black
screen, the viewer's toolbar along the strip's top-left edge, and the
supplier's "Buyball Sports" watermark — a ring logo and the name, tiled behind
the balls, with faint diagonal rules between the tiles. The balls themselves
are flat artwork in two inks, black and the stitch red, on white.

Since every pixel of the artwork is one of those inks laid over white, each is
split back into how much black and how much red it carries, and only ink that
belongs to the artwork is kept:

  - ink inside a ball (its outline included), and
  - within 2px of solid ink — a quarter of the way to full black or red — which
    keeps the anti-aliased edge of every line and letter.

The watermark and the rules never come within a quarter of full black (the
darkest reads about a tenth), so everything of theirs that isn't touching the
artwork drops out, and what touches it is too faint to see. So does the
toolbar, which sits above the left ball, and the screenshot's compression
noise.

The balls are found rather than measured: a circle fitted to the outermost dark
pixels on each side of the strip, re-run without whatever points sit far off
it. The fit puts the A1392 6px lower than the A1292, so each ball is set onto
the card by its own whole-pixel shift, which levels them without resampling.
The card is 16:9, as the section's photo cards are, with the same margin on all
four sides of the pair.

The screenshot carries the balls at 434px across, about what the card is drawn
at on a 2x screen, and soft at that. So the card is written at twice that,
upscaled from the ink amounts rather than from the colours, and those
sharpened — an unsharp mask clipped to the 0-1 an ink amount can take, which
steepens every edge without leaving a halo. Then the black and the red are put
back over white.

The result is saved as a 256-colour PNG: every colour in it is a mix of the
same two inks and white, which a palette covers to within 9 levels in 255, at
under a third of the bytes.

Needs pillow and numpy.

    python3 tools/make-a1292-a1392.py            # from the repo root
"""

import os

import numpy as np
from PIL import Image

SRC = 'public/images/a1292-a1392-src.webp'
OUT = 'public/images/a1292-a1392.png'

# The two inks and the ground, as the screenshot has them: black off the solid
# lettering, red off the middles of the stitches.
WHITE = np.array([255.0, 255.0, 255.0])
BLACK = np.array([1.0, 1.0, 1.0])
RED = np.array([221.0, 5.0, 21.0])

# The viewer's toolbar runs along the top of the strip, over its left end.
TOOLBAR = 16

# How much of an ink makes solid artwork, and how far from it an edge reaches.
# The watermark's darkest is about 0.09.
SOLID = 0.25
EDGE = 2

# The outline is a line about 2px wide, centred about a pixel inside where the
# fit lands; this keeps all of it.
RIM = 2.5

SCALE = 2
# Unsharp mask on the upscaled ink amounts.
SHARPEN = 1.5
SIGMA = 1.5
# Ink fainter than this, after sharpening, is left as bare white.
FLOOR = 0.02


def strip(img):
    """The white strip across the screenshot, as floats.

    Rows that are mostly white; the row at each end is a blend of the strip and
    the black screen, and is left off.
    """
    a = np.asarray(img.convert('RGB')).astype(float)
    rows = np.nonzero(np.median(a.mean(-1), axis=1) > 200)[0]
    return a[rows[0]:rows[-1] + 1]


def inks(a):
    """How much black and how much red each pixel carries over white."""
    m = np.stack([BLACK - WHITE, RED - WHITE], 1)
    amt = np.clip((a - WHITE) @ np.linalg.pinv(m).T, 0, 1)
    return amt / np.maximum(amt.sum(-1, keepdims=True), 1)


def compose(amt):
    m = np.stack([BLACK - WHITE, RED - WHITE], 1)
    return np.clip(WHITE + amt @ m.T, 0, 255).round().astype(np.uint8)


def dilate(mask, n):
    for _ in range(n):
        grown = mask.copy()
        grown[1:] |= mask[:-1]
        grown[:-1] |= mask[1:]
        grown[:, 1:] |= mask[:, :-1]
        grown[:, :-1] |= mask[:, 1:]
        mask = grown
    return mask


def fit_circle(pts):
    """Least-squares circle through pts, re-fit without the stragglers."""
    x, y = pts[:, 0], pts[:, 1]
    for _ in range(6):
        a = np.c_[2 * x, 2 * y, np.ones(len(x))]
        (cx, cy, c), *_ = np.linalg.lstsq(a, x * x + y * y, rcond=None)
        r = np.sqrt(c + cx * cx + cy * cy)
        off = np.abs(np.hypot(x - cx, y - cy) - r)
        keep = off < max(1.5, 2.5 * np.median(off))
        x, y = x[keep], y[keep]
    return cx, cy, r, len(x)


def balls(amt):
    """The circle of each ball, left then right."""
    dark = amt[..., 0] > 0.3
    dark[:TOOLBAR] = False
    h, w = dark.shape
    found = []
    for x0, x1 in ((0, w // 2), (w // 2, w)):
        side = dark[:, x0:x1]
        pts = []
        for y in range(h):
            xs = np.nonzero(side[y])[0]
            if len(xs):
                pts += [(x0 + xs[0], y), (x0 + xs[-1], y)]
        for x in range(x1 - x0):
            ys = np.nonzero(side[:, x])[0]
            if len(ys):
                pts += [(x0 + x, ys[0]), (x0 + x, ys[-1])]
        found.append(fit_circle(np.array(pts, float)))
    return found


def resize(ch, w, h):
    return np.asarray(Image.fromarray(ch.astype(np.float32), 'F').resize((w, h), Image.LANCZOS))


def blur(ch, sigma):
    rad = int(3 * sigma + 0.5)
    k = np.exp(-0.5 * (np.arange(-rad, rad + 1) / sigma) ** 2)
    k /= k.sum()
    h, w = ch.shape
    p = np.pad(ch, ((rad, rad), (0, 0)), mode='edge')
    ch = sum(k[i] * p[i:i + h] for i in range(2 * rad + 1))
    p = np.pad(ch, ((0, 0), (rad, rad)), mode='edge')
    return sum(k[i] * p[:, i:i + w] for i in range(2 * rad + 1))


def main():
    amt = inks(strip(Image.open(SRC)))
    found = balls(amt)
    for name, (cx, cy, r, n) in zip(('A1292', 'A1392'), found):
        print('%s  cx %.1f  cy %.1f  r %.1f  from %d outline points' % (name, cx, cy, r, n))

    art = amt * dilate((amt > SOLID).any(-1), EDGE)[..., None]

    # The card: the pair as it stands side by side, the same margin all round.
    r = max(f[2] for f in found)
    pair_w = found[1][0] - found[0][0] + 2 * r
    pair_h = 2 * r
    margin = (9 * pair_w - 16 * pair_h) / 14
    card_h = int(round(pair_h + 2 * margin))
    card_w = int(round(card_h * 16 / 9))
    card = np.zeros((card_h, card_w, 2))
    # Both balls move across by the same amount, keeping the artwork's spacing,
    # and each moves down by its own, which levels them.
    dx = int(round((card_w - pair_w) / 2 + r - found[0][0]))
    h, w = art.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    for cx, cy, br, _ in found:
        dy = int(round(card_h / 2 - cy))
        ys, xs = np.nonzero(np.hypot(xx - cx, yy - cy) <= br + RIM)
        card[ys + dy, xs + dx] = art[ys, xs]
        print('  moved %+d, %+d' % (dx, dy))

    big = np.stack([resize(card[..., i], card_w * SCALE, card_h * SCALE) for i in range(2)], -1)
    big = big + SHARPEN * (big - np.stack([blur(big[..., i], SIGMA) for i in range(2)], -1))
    big = np.clip(big, 0, 1)
    big /= np.maximum(big.sum(-1, keepdims=True), 1)
    big[big < FLOOR] = 0

    out = Image.fromarray(compose(big)).quantize(
        colors=256, method=Image.Quantize.MAXCOVERAGE, dither=Image.Dither.NONE)
    out.save(OUT, optimize=True)
    print('wrote %s  %dx%d  %dKB' % (OUT, out.width, out.height, os.path.getsize(OUT) // 1024))


if __name__ == '__main__':
    main()
