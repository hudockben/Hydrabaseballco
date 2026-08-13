"""Put the A1492+ on the field the A1492 was photographed on.

Reads

  public/images/ball-plus-src.jpg   the game ball, shot indoors over the boxes
  public/images/ball.jpg            the A1492 product shot, for its field

and writes

  public/images/ball-plus.jpg       the game ball, on that field

The two balls differ only by the "+" after the model number, and the only
photograph of a plus is a phone shot taken in a dim room over a stack of
shipping cartons. The ball in it is whole: the hand cups it from behind and
nothing crosses the limb, so the disc lifts out entire, with its printing and
its stitching, and needs no reconstruction. Dropping it onto the A1492's field
at that ball's own place and size brings the grass, the depth of field and the
contact shadow along with it, since none of those are inside the disc.

The limb is found rather than measured. Threshold for something bright and
neutral (the leather; skin and cardboard are warm), keep the largest blob, and
fit a circle to the top three quarters of its outline — the shaded underside
falls below the threshold, so the outline there is the threshold's edge and not
the ball's. The fit is then re-run a few times without whatever points sit far
off it.

Indoors the leather reads warm and dim. A per-channel gain, measured off the
plain leather in both photographs, carries it to daylight; the highlights are
rolled off with a tanh rather than clipped, which would flatten the top of the
sphere. The ball is laid in a few pixels large so its own limb covers the
softer, out-of-focus one it replaces instead of leaving a rim of it showing.

Run from the repo root:  python3 tools/make-ball-plus.py
"""
from PIL import Image, ImageOps
import numpy as np
from scipy import ndimage as ndi

HAND = 'public/images/ball-plus-src.jpg'
PLATE = 'public/images/ball.jpg'
OUT = 'public/images/ball-plus.jpg'

# The ball in the plate (the same fit make-ball-blank.py measures), and the
# black band along its top edge, cropped after compositing.
BALL_CX, BALL_CY, BALL_R = 545.5, 536.8, 394.5
TOP_CROP = 17

# The plate's ball is a touch soft at the limb, so the new one goes in this
# many pixels larger to cover it.
PAD = 5.0
# Leather against a warm, dim room: bright enough, neutral enough, not orange.
LIT = 85
NEUTRAL = 0.26
WARM = 48
# Highlights above this roll off instead of clipping, once the gain is on.
KNEE = 225.0


def silhouette(img):
    """Mask of the ball: the largest bright, neutral, un-warm blob."""
    lum = img.mean(2)
    mx, mn = img.max(2), img.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    m = (lum > LIT) & (sat < NEUTRAL) & ((img[..., 0] - img[..., 2]) < WARM)

    # Close over the printing and the seam holes, then drop everything the
    # room contributes that happens to be pale.
    m = ndi.binary_fill_holes(ndi.binary_closing(m, np.ones((25, 25))))
    for step in (np.ones((41, 41)), None):
        if step is not None:
            m = ndi.binary_opening(m, step)
        lab, n = ndi.label(m)
        if n == 0:
            raise SystemExit('no ball found in ' + HAND)
        m = lab == 1 + int(np.argmax(ndi.sum(m, lab, range(1, n + 1))))
    return m


def limb(mask):
    """Least-squares circle through the silhouette's true outline."""
    edge = mask & ~ndi.binary_erosion(mask, np.ones((3, 3)))
    ys, xs = np.nonzero(edge)
    # The underside is shaded past the threshold, so its outline is not a limb.
    keep = ys < ys.min() + 0.72 * (ys.max() - ys.min())
    xs, ys = xs[keep].astype(np.float64), ys[keep].astype(np.float64)

    for _ in range(4):
        basis = np.stack([xs, ys, np.ones_like(xs)], 1)
        sol, *_ = np.linalg.lstsq(basis, xs ** 2 + ys ** 2, rcond=None)
        cx, cy = sol[0] / 2, sol[1] / 2
        r = np.sqrt(sol[2] + cx * cx + cy * cy)
        off = np.abs(np.hypot(xs - cx, ys - cy) - r)
        near = off < max(3 * off.std(), 4)
        xs, ys = xs[near], ys[near]
    return cx, cy, r, len(xs)


def leather(img, rad, r):
    """Mean colour of the plain leather — bright, off the seams and the print."""
    core = rad < r * 0.85
    m = core & (img.mean(2) > np.percentile(img.mean(2)[core], 55))
    m &= (img[..., 0] - img[..., 1] < 30) & (np.abs(img[..., 1] - img[..., 2]) < 30)
    return np.array([img[..., c][m].mean() for c in range(3)])


def sample(img, sx, sy):
    """Bilinear read of `img` at the given coordinates."""
    i, j = sx.astype(int), sy.astype(int)
    tx, ty = (sx - i)[..., None], (sy - j)[..., None]
    return (img[j, i] * (1 - tx) * (1 - ty) + img[j, i + 1] * tx * (1 - ty) +
            img[j + 1, i] * (1 - tx) * ty + img[j + 1, i + 1] * tx * ty)


hand = np.asarray(ImageOps.exif_transpose(Image.open(HAND)).convert('RGB')).astype(np.float32)
plate = np.asarray(Image.open(PLATE).convert('RGB')).astype(np.float32)
hh, hw, _ = hand.shape
H, W, _ = plate.shape

cx, cy, r, n = limb(silhouette(hand))
print('limb  cx %.1f  cy %.1f  r %.1f  from %d outline points' % (cx, cy, r, n))

hyy, hxx = np.mgrid[0:hh, 0:hw]
src = leather(hand, np.hypot(hxx - cx, hyy - cy), r)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
rad = np.hypot(xx - BALL_CX, yy - BALL_CY)
dst = leather(plate, rad, BALL_R)
gain = dst / src
print('leather  indoors %s  ->  field %s   gain %s'
      % (np.round(src, 1), np.round(dst, 1), np.round(gain, 3)))

# Read the hand photo so its limb lands on the plate ball's, plus the pad.
out_r = BALL_R + PAD
k = r / out_r
ball = sample(hand,
              np.clip(cx + (xx - BALL_CX) * k, 0, hw - 1.001),
              np.clip(cy + (yy - BALL_CY) * k, 0, hh - 1.001)) * gain
ball = np.where(ball > KNEE, KNEE + (255 - KNEE) * np.tanh((ball - KNEE) / (255 - KNEE)), ball)

alpha = np.clip((out_r - 1.5 - rad) / 3.0, 0, 1)[..., None]
out = (plate * (1 - alpha) + ball * alpha)[TOP_CROP:]
print('ball %.0fpx across, %.1f%% of the frame' % (2 * out_r, 100 * alpha.mean()))

Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(OUT, quality=94, subsampling=0)
print('wrote %-34s %dx%d' % (OUT, out.shape[1], out.shape[0]))
