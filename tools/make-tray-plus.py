"""Put the A1492+ into the tray of A1492s.

Reads

  public/images/hero-6.jpg          a tray of practice balls on the turf
  public/images/ball-plus-src.jpg   the game ball, via make-ball-plus.py

and writes

  public/images/tray-plus.jpg       the same tray, one ball in from the game run

The game ball and the practice ball are the same ball but for the plus, and
there is one photograph of each: a tray of A1492s, and a single A1492+ held in
a hand indoors. This sets the second into the first, so the run reads the way
it ships — the game ball among the practice balls, clean where they are scuffed.

It replaces a ball rather than adding one. The front-centre ball is whole and
nothing overlaps it (it is nearest the camera, so it is what does the
overlapping), which means the disc can simply be drawn over: every contact,
shadow and neighbour around it already belongs to a ball that size in that
spot, and none of them have to be invented.

The tray is lit hard from above with a deep vignette, nothing like the room the
game ball was shot in, so rather than correcting one to the other the light is
transferred. Blur both discs past the point where printing and grain survive
and what is left is the key light, the shading down the sphere and the vignette;
the ratio of the two carries the tray's light onto the new ball while its own
leather, seams and printing ride through untouched at the high frequencies.

hero-6.jpg came off a phone, so it is cropped to the photograph first — the
black bands above and below it are not part of the shot.

Run from the repo root:  python3 tools/make-tray-plus.py
"""
import importlib.util
import pathlib

from PIL import Image
import numpy as np
from scipy import ndimage as ndi

ROOT = pathlib.Path(__file__).resolve().parent.parent
TRAY = 'public/images/hero-6.jpg'
OUT = 'public/images/tray-plus.jpg'

# The ball being replaced: the front-centre one, measured on the cropped tray
# by the same limb fit make-ball-plus.py uses, then written down here.
TARGET = (501.3, 695.7, 100.6)
# It goes in a couple of pixels large, to cover the limb it replaces.
PAD = 2.5
# Blur radius for the light transfer, as a fraction of the ball's radius. Wide
# enough that no printing survives it, tight enough to hold the shading.
LIGHT = 0.26
# The tray is a phone screenshot; the photograph is the part that is not black.
BAND = 12


def load(name):
    """Import a sibling tool by filename (they are scripts, not modules)."""
    spec = importlib.util.spec_from_file_location(
        name.replace('-', '_'), ROOT / 'tools' / (name + '.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def photograph(img):
    """Drop the black bands a phone screenshot puts above and below the shot.

    The longest unbroken run of lit rows, not the first and last of them: the
    home indicator sits down in the lower band and is bright enough to count.
    """
    lit = np.concatenate(([False], img.mean((1, 2)) > BAND, [False]))
    starts = np.flatnonzero(~lit[:-1] & lit[1:])
    ends = np.flatnonzero(lit[:-1] & ~lit[1:])
    best = int(np.argmax(ends - starts))
    return img[starts[best]:ends[best]]


def masked_blur(img, mask, sigma):
    """Blur `img` using only what is under `mask`, so nothing bleeds in."""
    m = mask.astype(np.float32)
    num = ndi.gaussian_filter(img * m[..., None], (sigma, sigma, 0))
    den = np.maximum(ndi.gaussian_filter(m, sigma), 1e-6)[..., None]
    return num / den


plus = load('make-ball-plus')
hand, (hcx, hcy, hr) = plus.game_ball()
tray = photograph(np.asarray(Image.open(ROOT / TRAY).convert('RGB')).astype(np.float32))
H, W, _ = tray.shape
hh, hw, _ = hand.shape
print('tray %dx%d after cropping the bands' % (W, H))

tcx, tcy, tr = TARGET
out_r = tr + PAD
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
rad = np.hypot(xx - tcx, yy - tcy)

k = hr / out_r
ball = plus.sample(hand,
                   np.clip(hcx + (xx - tcx) * k, 0, hw - 1.001),
                   np.clip(hcy + (yy - tcy) * k, 0, hh - 1.001))

disc = rad < out_r
sigma = LIGHT * tr
low_tray = masked_blur(tray, disc, sigma)
low_ball = masked_blur(ball, disc, sigma)
ball = ball * np.clip(low_tray / np.maximum(low_ball, 1.0), 0.15, 3.0)
print('light transferred at sigma %.1fpx over a %.0fpx ball' % (sigma, 2 * out_r))

alpha = np.clip((out_r - 1.0 - rad) / 2.0, 0, 1)
R, G, B = tray[..., 0], tray[..., 1], tray[..., 2]
blades = (G > R + 10) & (G > B + 10)          # turf standing in front of it
alpha = np.where(blades, 0.0, alpha)
print('blades over the disc: %.2f%%' % (100 * blades[disc].mean()))

out = tray * (1 - alpha[..., None]) + ball * alpha[..., None]
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(ROOT / OUT, quality=94, subsampling=0)
print('wrote %-34s %dx%d' % (OUT, W, H))
