"""Erase the A1492 / PRO SERIES print from the product photo.

Leaves one clean leather panel for a team's own mark. Everything else on the
ball - the Hydra wordmark, the seams, the fine print - stays exactly as shot.
The ink is found by local contrast (a glyph is far darker than the leather
around it), then filled by diffusing the neighbouring leather inward, so the
panel keeps its shading gradient instead of going flat.
"""
from PIL import Image
import numpy as np

SRC = 'public/images/ball.jpg'
DST = 'public/images/ball-blank.jpg'

# The printed panel, measured off the photo: below the upper seam, above the lower.
X0, X1, Y0, Y1 = 380, 750, 515, 695
# Clean leather to steal grain from (same panel, left of the print).
GX0, GX1, GY0, GY1 = 185, 345, 520, 690

im = Image.open(SRC).convert('RGB')
a = np.asarray(im).astype(np.float32)

def blur3(x):
    p = np.pad(x, ((1, 1), (1, 1), (0, 0)), mode='edge')
    return (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] + 4 * x) / 8.0

def blur3g(x):
    p = np.pad(x, 1, mode='edge')
    return (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] + 4 * x) / 8.0

def morph(x, n, grow):
    """Grayscale dilation (grow) or erosion, n steps of a plus-shaped kernel."""
    for _ in range(n):
        p = np.pad(x, 1, mode='edge')
        stack = [p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:], x]
        x = np.maximum.reduce(stack) if grow else np.minimum.reduce(stack)
    return x

region = a[Y0:Y1, X0:X1].copy()
lum = 0.299 * region[..., 0] + 0.587 * region[..., 1] + 0.114 * region[..., 2]

# Black top-hat: a morphological closing fills anything darker and thinner
# than the kernel, so closing - image is exactly the printing and nothing else.
closed = morph(morph(lum, 20, True), 20, False)
ink = (closed - lum) > 30
ink = morph(ink.astype(np.float32), 3, True) > 0.5
print('ink pixels: %d of %d (%.1f%%)' % (ink.sum(), ink.size, 100 * ink.mean()))

# Rebuild the leather under the print. The panel's shading is smooth, so a
# cubic surface fitted to the leather that *is* visible reproduces it exactly -
# and unlike diffusion it can't leave a bright ghost in the middle of a stroke.
h, w = ink.shape
yy, xx = np.mgrid[0:h, 0:w]
u = (xx / w) - 0.5
v = (yy / h) - 0.5
terms = [np.ones_like(u), u, v, u * u, u * v, v * v,
         u ** 3, u * u * v, u * v * v, v ** 3]
basis = np.stack([t.ravel() for t in terms], axis=1)
known = (~ink).ravel()

mask3 = np.repeat(ink[:, :, None], 3, axis=2)
filled = region.copy()
for ch in range(3):
    target = region[..., ch].ravel()
    keep = known.copy()
    for _ in range(3):  # drop stray dark pixels the mask missed, then refit
        coef, *_ = np.linalg.lstsq(basis[keep], target[keep], rcond=None)
        res = target - basis @ coef
        keep = known & (np.abs(res) < 2.5 * res[keep].std())
    filled[..., ch] = (basis @ coef).reshape(h, w)

# Put the leather grain back: the diffusion leaves it glassy smooth.
grain = a[GY0:GY1, GX0:GX1]
gs = grain.copy()
for _ in range(6):
    gs = blur3(gs)
hi = grain - gs
th, tw, _ = hi.shape
tile = hi[np.ix_(np.arange(Y1 - Y0) % th, np.arange(X1 - X0) % tw)]
filled = np.where(mask3, filled + tile, filled)

# Feather the patch in. The alpha comes from the ink mask itself, so there is
# no rectangle around the panel - only the glyphs are touched.
alpha = ink.astype(np.float32)
for _ in range(4):
    alpha = blur3g(alpha)
alpha = np.clip(alpha * 1.6, 0, 1)
out = a.copy()
out[Y0:Y1, X0:X1] = region * (1 - alpha[..., None]) + filled * alpha[..., None]

# The original carries a 17px black band along the top (it came off a phone
# screenshot); crop it so the mockup canvas is all photograph.
out = out[17:, :, :]
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(DST, quality=94, subsampling=0)
print('wrote %s  %dx%d' % (DST, out.shape[1], out.shape[0]))
