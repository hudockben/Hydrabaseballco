"""Build the retouched ball photos the custom-logo preview prints onto.

Reads public/images/ball.jpg (the A1492 product shot) and writes two versions:

  ball-blank.jpg            the A1492 / PRO SERIES panel cleared
  ball-blank-horseshoe.jpg  the Hydra wordmark cleared instead

The preview shows the first by default and swaps to the second when a team puts
its mark in the horseshoe, where the Hydra wordmark normally sits. Only the spot
being printed on is cleared, so the ball keeps one mark of its own either way.

Ink is found by a morphological black top-hat: a closing fills anything darker
and thinner than its kernel, so closing - image is the printing and nothing
else. The leather underneath is rebuilt from a cubic surface fitted to the
panel's own shading - unlike diffusion it cannot leave a bright ghost inside a
thick stroke - and the real grain is tiled back over it. Everything the mask
does not touch is the photograph, untouched.

Run from the repo root:  python3 tools/make-ball-blank.py
"""
from PIL import Image
import numpy as np

SRC = 'public/images/ball.jpg'
OUT_PANEL = 'public/images/ball-blank.jpg'
OUT_HORSESHOE = 'public/images/ball-blank-horseshoe.jpg'

# The ball in the source photo (least-squares fit of its limb).
BALL_CX, BALL_CY, BALL_R = 545.5, 536.8, 394.5
# The original carries a 17px black band along the top - it came off a phone
# screenshot - which is cropped after retouching.
TOP_CROP = 17

# Printed areas, measured off the photo.
PANEL_BOX = (380, 750, 515, 695)      # A1492 / PRO SERIES, between the seams
WORDMARK_BOX = (385, 765, 158, 330)   # H / HYDRA / BASEBALL CO. on the horseshoe
# Clean leather to lift grain from. It is high-pass only, so the same patch
# works anywhere on the ball.
GRAIN_BOX = (185, 345, 520, 690)


def blur3(x):
    """One box-ish blur pass over an HxWx3 image."""
    p = np.pad(x, ((1, 1), (1, 1), (0, 0)), mode='edge')
    return (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] + 4 * x) / 8.0


def blur3g(x):
    """One blur pass over an HxW mask."""
    p = np.pad(x, 1, mode='edge')
    return (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] + 4 * x) / 8.0


def morph(x, n, grow):
    """Grayscale dilation (grow=True) or erosion, n steps of a plus kernel."""
    for _ in range(n):
        p = np.pad(x, 1, mode='edge')
        stack = [p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:], x]
        x = np.maximum.reduce(stack) if grow else np.minimum.reduce(stack)
    return x


def find_ink(region, x0, y0):
    """Mask of the printing in `region`, whose top-left is (x0, y0) in the photo."""
    lum = 0.299 * region[..., 0] + 0.587 * region[..., 1] + 0.114 * region[..., 2]
    closed = morph(morph(lum, 20, True), 20, False)
    ink = (closed - lum) > 30

    # Red seam thread is dark too, and so is the blurred background past the
    # limb. Neither is printing.
    ink &= (region[..., 0] - region[..., 1]) <= 22
    h, w = lum.shape
    yy, xx = np.mgrid[y0:y0 + h, x0:x0 + w]
    ink &= np.hypot(xx - BALL_CX, yy - BALL_CY) < BALL_R * 0.97

    return morph(ink.astype(np.float32), 3, True) > 0.5  # take the soft edges too


def clear(photo, box, label):
    """Return `photo` with the printing inside `box` replaced by bare leather."""
    x0, x1, y0, y1 = box
    region = photo[y0:y1, x0:x1]
    ink = find_ink(region, x0, y0)
    print('%-9s ink covers %.1f%% of its box' % (label, 100 * ink.mean()))

    # The panel's shading is smooth, so a cubic surface fitted to the leather
    # that *is* visible reproduces what the ink is hiding.
    h, w = ink.shape
    yy, xx = np.mgrid[0:h, 0:w]
    u, v = (xx / w) - 0.5, (yy / h) - 0.5
    terms = [np.ones_like(u), u, v, u * u, u * v, v * v,
             u ** 3, u * u * v, u * v * v, v ** 3]
    basis = np.stack([t.ravel() for t in terms], axis=1)
    known = (~ink).ravel()

    filled = region.copy()
    for ch in range(3):
        target = region[..., ch].ravel()
        keep = known.copy()
        for _ in range(3):  # refit without whatever dark pixels the mask missed
            coef, *_ = np.linalg.lstsq(basis[keep], target[keep], rcond=None)
            res = target - basis @ coef
            keep = known & (np.abs(res) < 2.5 * res[keep].std())
        filled[..., ch] = (basis @ coef).reshape(h, w)

    # Put the grain back: the fitted surface is glassy smooth on its own.
    gx0, gx1, gy0, gy1 = GRAIN_BOX
    grain = photo[gy0:gy1, gx0:gx1]
    smooth = grain.copy()
    for _ in range(6):
        smooth = blur3(smooth)
    hi = grain - smooth
    th, tw, _ = hi.shape
    filled = filled + hi[np.ix_(np.arange(h) % th, np.arange(w) % tw)]

    # Feather. The alpha is the ink mask itself, so only the glyphs are touched
    # and no rectangle appears around the panel.
    alpha = ink.astype(np.float32)
    for _ in range(4):
        alpha = blur3g(alpha)
    alpha = np.clip(alpha * 1.6, 0, 1)[..., None]

    out = photo.copy()
    out[y0:y1, x0:x1] = region * (1 - alpha) + filled * alpha
    return out


def save(photo, path):
    cropped = photo[TOP_CROP:, :, :]
    Image.fromarray(np.clip(cropped, 0, 255).astype(np.uint8)).save(path, quality=92, subsampling=0)
    print('wrote %-42s %dx%d' % (path, cropped.shape[1], cropped.shape[0]))


photo = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)

# Each version clears only the spot being printed on, so the ball always keeps
# one mark of its own: the Hydra wordmark when a logo goes on the panel, the
# A1492 model when a logo goes on the horseshoe.
save(clear(photo, PANEL_BOX, 'panel'), OUT_PANEL)
save(clear(photo, WORDMARK_BOX, 'wordmark'), OUT_HORSESHOE)
