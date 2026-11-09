"""Build the A1592 photos the custom-logo preview prints onto.

The A1592 counterpart of make-ball-blank.py, run on public/images/a1592.jpg
(the Competition Series shot in the grass) instead of the A1492's ball.jpg:

  panel-lockup-1592.png          HYDRA / A1592, black on transparent
  ball-1592-blank.jpg            the A1592 / COMPETITION SERIES panel cleared
  ball-1592-blank-horseshoe.jpg  the Hydra wordmark cleared, and the panel
                                 restamped with the HYDRA / A1592 lockup

Same arrangement as the A1492: a logo on the panel keeps the Hydra wordmark
up in the horseshoe; a logo in the horseshoe moves the Hydra name down onto
the panel, over the model mark. The clearing, the stamping and the lockup are
the A1492 tools' own code, loaded from them and pointed at this photo's
measurements below - only the numbers differ.

a1592.jpg is a 16:9 crop of a phone screenshot, so it is the best copy there
is. The stage is square, so this keeps the full height and crops a square
around the ball, which leaves the A1592 larger in the frame than the A1492 -
there is no more photo above or below it to show. The square is scaled up to
the stage's 900px.

The numbers public/script.js needs to place a logo on these photos (the
ball's centre and radius, the two spots, the boxes the printing sits in) are
printed at the end, in stage pixels and decal units, ready to copy into its
MODELS table.

Run from the repo root:  python3 tools/make-ball-1592.py
"""
import importlib.util
import pathlib

from PIL import Image
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent

SRC = 'public/images/a1592.jpg'
OUT_LOCKUP = 'public/images/panel-lockup-1592.png'
OUT_PANEL = 'public/images/ball-1592-blank.jpg'
OUT_HORSESHOE = 'public/images/ball-1592-blank-horseshoe.jpg'

# The ball in the source photo: a least-squares fit of its limb, the top
# three-quarters of it - grass crosses the bottom.
BALL_CX, BALL_CY, BALL_R = 585.3, 332.1, 309.0

# Printed areas, measured off the photo (x0, x1, y0, y1).
PANEL_BOX = (410, 790, 374, 494)      # A1592 / - COMPETITION SERIES -
WORDMARK_BOX = (444, 748, 38, 170)    # H / HYDRA / BASEBALL CO. and its swooshes
# Clean leather to lift grain from: left of centre, between the seams.
GRAIN_BOX = (300, 400, 290, 380)
# The stretch of the flattened ball, in decal units, that holds the panel.
WINDOW = (-0.72, 0.76, 0.08, 0.64)

# The lockup takes the model mark's place: centred where it was printed and
# as wide as its top line, A1592, is drawn across - the second line here,
# COMPETITION SERIES, runs much wider than the A1492's PRO SERIES does.
LOCKUP_W = 0.98
# The printing on this ball is navy, and reflects about 12% of its leather.
INK_REFLECT = 0.12

# The square that goes on the stage, and the stage's size.
CROP = (256, 914, 0, 658)
STAGE = 900


def load(name):
    """Import a sibling tool by filename (they are scripts, not modules)."""
    spec = importlib.util.spec_from_file_location(
        name.replace('-', '_'), ROOT / 'tools' / (name + '.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def to_flat(x, y):
    """Photo pixels to decal units, the inverse of the wrap: a point r radii
    out on screen sits asin(r) radians of arc from the centre."""
    u, v = (x - BALL_CX) / BALL_R, (y - BALL_CY) / BALL_R
    r = np.hypot(u, v)
    k = np.where(r < 1e-6, 1.0, np.arcsin(np.clip(r, 0, 1)) / np.maximum(r, 1e-6))
    return u * k, v * k


def flat_box(ink, box):
    """The decal-unit extent of an ink mask that sits at `box` in the photo."""
    ys, xs = np.nonzero(ink)
    fx, fy = to_flat(xs + box[0] + 0.5, ys + box[2] + 0.5)
    return fx.min(), fx.max(), fy.min(), fy.max()


def stage_box(box):
    """A photo box in stage pixels, the way the browser measures it."""
    s = STAGE / (CROP[1] - CROP[0])
    return [int(round((box[0] - CROP[0]) * s)), int(round((box[1] - CROP[0]) * s)),
            int(round((box[2] - CROP[2]) * s)), int(round((box[3] - CROP[2]) * s))]


def save(photo, path):
    x0, x1, y0, y1 = CROP
    square = Image.fromarray(np.clip(photo[y0:y1, x0:x1], 0, 255).astype(np.uint8))
    square.resize((STAGE, STAGE), Image.LANCZOS).save(ROOT / path, quality=92, subsampling=0)
    print('wrote %-42s %dx%d' % (path, STAGE, STAGE))


def main():
    blank = load('make-ball-blank')
    lock = load('make-panel-lockup')
    for tool in (blank, lock):
        tool.BALL_CX, tool.BALL_CY, tool.BALL_R = BALL_CX, BALL_CY, BALL_R
    blank.GRAIN_BOX = GRAIN_BOX
    blank.INK_REFLECT = INK_REFLECT

    # The lockup: the wordmark out of public/logo.png over A1592, lifted off
    # this photo's panel, between the rules - exactly as the A1492's is built.
    lock.build(ball=str(ROOT / SRC), panel_box=PANEL_BOX, window=WINDOW, dest=str(ROOT / OUT_LOCKUP))

    photo = np.asarray(Image.open(ROOT / SRC).convert('RGB')).astype(np.float32)
    art = np.asarray(Image.open(ROOT / OUT_LOCKUP).convert('RGBA')).astype(np.float32)[..., 3] / 255.0

    # Where the model mark was printed, in decal units, to centre the lockup.
    x0, x1, y0, y1 = PANEL_BOX
    panel_ink = blank.find_ink(photo[y0:y1, x0:x1], x0, y0)
    pfx0, pfx1, pfy0, pfy1 = flat_box(panel_ink, PANEL_BOX)
    rows = np.flatnonzero(panel_ink.any(1))
    top_line = panel_ink[:rows[0] + int(0.62 * (rows[-1] - rows[0]))]
    tfx0, tfx1, _, _ = flat_box(top_line, PANEL_BOX)
    at = ((pfx0 + pfx1) / 2, (pfy0 + pfy1) / 2)
    print('panel print spans x %.3f..%.3f, y %.3f..%.3f (top line %.3f..%.3f) - lockup at (%.3f, %.3f), %.2f wide'
          % (pfx0, pfx1, pfy0, pfy1, tfx0, tfx1, at[0], at[1], LOCKUP_W))

    save(blank.clear(photo, PANEL_BOX, 'panel'), OUT_PANEL)

    horseshoe = blank.clear(blank.clear(photo, WORDMARK_BOX, 'wordmark'), PANEL_BOX, 'panel')
    save(blank.stamp(horseshoe, PANEL_BOX, art, at, LOCKUP_W, 'lockup'), OUT_HORSESHOE)

    # What public/script.js needs, in its own units.
    x0, x1, y0, y1 = WORDMARK_BOX
    wfx0, wfx1, wfy0, wfy1 = flat_box(blank.find_ink(photo[y0:y1, x0:x1], x0, y0), WORDMARK_BOX)
    s = STAGE / (CROP[1] - CROP[0])
    print('\nFor public/script.js (stage pixels, decal units):')
    print('  cx %.1f, cy %.1f, r %.1f' % ((BALL_CX - CROP[0]) * s, (BALL_CY - CROP[2]) * s, BALL_R * s))
    print('  panel print     x %.3f..%.3f  y %.3f..%.3f  -> centre (%.3f, %.3f)'
          % (pfx0, pfx1, pfy0, pfy1, (pfx0 + pfx1) / 2, (pfy0 + pfy1) / 2))
    print('  wordmark print  x %.3f..%.3f  y %.3f..%.3f  -> centre (%.3f, %.3f)'
          % (wfx0, wfx1, wfy0, wfy1, (wfx0 + wfx1) / 2, (wfy0 + wfy1) / 2))
    print('  print boxes     wordmark %s  panel %s' % (stage_box(WORDMARK_BOX), stage_box(PANEL_BOX)))


if __name__ == '__main__':
    main()
