"""Build the A1492+ product shot from the A1492 one.

Reads public/images/ball.jpg (the A1492 Pro Series shot) and writes

  public/images/ball-plus.jpg   the same ball, stamped A1492+

The game ball carries a "+" after the model number; the practice ball does
not. Both are otherwise the same ball, photographed on the same field, so the
plus is printed onto the photo the site already ships rather than shot again.

The mark is not redrawn from a font. It is lifted off the photograph the way
make-panel-lockup.py lifts it -- black top-hat for the ink, then flattened off
the sphere -- so the letterforms stay the ones that were printed. Only the plus
is new: an upright cross built to the numerals' own stroke width and cap
height, then sheared to the lean measured off their stems.

Adding a glyph makes the mark wider, so the model line slides left by half the
plus's advance and A1492+ sits centred in the panel the way A1492 did. The
PRO SERIES line underneath is untouched. Then the panel is cleared and the
whole thing printed back, both by make-ball-blank.py's own routines, so the
ink lands at the density the printing it replaced was measured at.

Run from the repo root:  python3 tools/make-ball-plus.py
"""
import importlib.util
import pathlib

from PIL import Image
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = 'public/images/ball.jpg'
OUT = 'public/images/ball-plus.jpg'

# The A1492 mark does not fill the leather between the seams, so the plus goes
# on beside it rather than the line being shrunk to make room. Both the box the
# printing is cleared from and stamped back into, and the flat frame the panel
# is read onto, are widened past make-ball-blank.py's PANEL_BOX to hold it.
PLUS_BOX = (355, 790, 515, 695)
# fx across, fy down, in radii, at PX pixels per radius — the frame of
# make-panel-lockup.py's unproject(), opened up to cover PLUS_BOX.
FX0, FX1, FY0, FY1, PX = -0.55, 0.72, -0.12, 0.47, 1400.0

# The plus, in multiples of the model line's cap height and stroke. Sized off
# the photo of the real ball: a raised cross about half the digits' height, cut
# a little finer than their stems.
PLUS_H = 0.47
PLUS_STROKE = 0.72
PLUS_GAP = 0.10                       # space between the 2 and the plus
PLUS_MID = 0.51                       # its centre, above the digits' baseline


def load(name):
    """Import a sibling tool by filename (they are scripts, not modules)."""
    spec = importlib.util.spec_from_file_location(
        name.replace('-', '_'), ROOT / 'tools' / (name + '.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def bands(mask):
    """Row ranges of the rows of type in a flattened panel, top down."""
    on = (mask > 0.5).any(1)
    out, start = [], None
    for y, v in enumerate(on):
        if v and start is None:
            start = y
        elif not v and start is not None:
            out.append((start, y)); start = None
    if start is not None:
        out.append((start, len(on)))
    return out


def stroke_width(band):
    """Median horizontal ink run — the stroke the glyphs are drawn with."""
    runs = []
    for row in band > 0.5:
        edges = np.diff(np.concatenate(([0], row.view(np.int8), [0])))
        runs.extend(np.flatnonzero(edges < 0) - np.flatnonzero(edges > 0))
    return float(np.median(runs))


def lean(band):
    """The italic's slope, measured off the stem of the narrowest glyph.

    Same measurement deslant() makes in make-panel-lockup.py, but the slope is
    what is wanted here rather than the sheared artwork.
    """
    on = (band > 0.5).any(0)
    runs, start = [], None
    for x, v in enumerate(on):
        if v and start is None:
            start = x
        elif not v and start is not None:
            runs.append((start, x - 1)); start = None
    if start is not None:
        runs.append((start, len(on) - 1))
    x0, x1 = min(runs, key=lambda r: r[1] - r[0])

    top = int(band.shape[0] * 0.45)
    ys, cs = [], []
    for y in range(top, band.shape[0]):
        m = np.flatnonzero(band[y, x0:x1 + 1] > 0.5)
        if m.size > 3:
            ys.append(y); cs.append(m.mean() + x0)
    return float(np.polyfit(np.array(ys, float), np.array(cs, float), 1)[0])


def shear(art, slope):
    """Lean upright artwork by `slope`, the inverse of deslant()'s shear."""
    h, w = art.shape
    mid = h / 2.0
    pad = int(abs(slope) * h) + 2
    out = np.zeros((h, w + 2 * pad), np.float32)
    src = np.arange(w + 2 * pad, dtype=np.float32) - pad
    for y in range(h):
        u = src - slope * (y - mid)
        i = np.floor(u).astype(int)
        t = u - i
        ok = (i >= 0) & (i < w - 1)
        out[y, ok] = art[y, i[ok]] * (1 - t[ok]) + art[y, i[ok] + 1] * t[ok]
    return out


def paste(sheet, art, y, x):
    """Lay `art` into `sheet` at (y, x), keeping whichever ink is heavier."""
    h, w = art.shape
    y0, x0 = max(y, 0), max(x, 0)
    y1, x1 = min(y + h, sheet.shape[0]), min(x + w, sheet.shape[1])
    if y0 >= y1 or x0 >= x1:
        raise SystemExit('artwork falls outside the frame — widen FX0..FY1')
    if (y1 - y0, x1 - x0) != (h, w):
        raise SystemExit('artwork is clipped by the frame — widen FX0..FY1')
    target = sheet[y0:y1, x0:x1]
    np.maximum(target, art, out=target)


def cross(size, stroke):
    """An upright plus, `size` square, drawn with `stroke`-wide arms.

    Antialiased by coverage rather than a hard mask, so it takes the same soft
    edge the photographed glyphs around it carry.
    """
    n = int(round(size))
    x = np.arange(n) + 0.5 - n / 2.0
    dx, dy = np.abs(x)[None, :], np.abs(x)[:, None]
    half = stroke / 2.0
    # Distance outside each arm, softened over a pixel: the union of a
    # horizontal bar and a vertical one.
    bar_h = np.clip(half + 0.5 - dy, 0, 1) * np.clip(size / 2 + 0.5 - dx, 0, 1)
    bar_v = np.clip(half + 0.5 - dx, 0, 1) * np.clip(size / 2 + 0.5 - dy, 0, 1)
    return np.maximum(bar_h, bar_v).astype(np.float32)


blank = load('make-ball-blank')

photo = np.asarray(Image.open(ROOT / SRC).convert('RGB')).astype(np.float32)
px0, px1, py0, py1 = PLUS_BOX
region = photo[py0:py1, px0:px1]

# Ink coverage of the panel, soft-edged, exactly as make-panel-lockup.py reads
# it: these glyphs are becoming artwork again, so they keep their printed edge.
lum = 0.299 * region[..., 0] + 0.587 * region[..., 1] + 0.114 * region[..., 2]
closed = blank.morph(blank.morph(lum, 20, True), 20, False)
depth = closed - lum
cov = np.clip(depth / np.maximum(closed * 0.95, 1), 0, 1) * np.clip((depth - 18) / 20.0, 0, 1)
cov[(region[..., 0] - region[..., 1]) > 22] = 0      # red seam thread is not ink

# Flatten the panel off the sphere onto the artwork frame.
w = int((FX1 - FX0) * PX)
h = int((FY1 - FY0) * PX)
fx = FX0 + (np.arange(w) + 0.5) / PX
fy = FY0 + (np.arange(h) + 0.5) / PX
FY, FX = np.meshgrid(fy, fx, indexing='ij')
r = np.hypot(FX, FY)
k = np.where(r < 1e-6, 1.0, np.sin(np.clip(r, None, np.pi / 2)) / np.maximum(r, 1e-6))
sx = np.clip(blank.BALL_CX + FX * k * blank.BALL_R - px0, 0, cov.shape[1] - 1.001)
sy = np.clip(blank.BALL_CY + FY * k * blank.BALL_R - py0, 0, cov.shape[0] - 1.001)
i, j = sx.astype(int), sy.astype(int)
tx, ty = sx - i, sy - j
flat = (cov[j, i] * (1 - tx) * (1 - ty) + cov[j, i + 1] * tx * (1 - ty) +
        cov[j + 1, i] * (1 - tx) * ty + cov[j + 1, i + 1] * tx * ty).astype(np.float32)

# The model line is the first row of type; PRO SERIES is the second.
rows = bands(flat)
r0, r1 = rows[0]
band = flat[r0:r1]
cols = np.flatnonzero((band > 0.5).any(0))
c0, c1 = int(cols[0]), int(cols[-1]) + 1
cap = r1 - r0
print('model line %dx%d at rows %d-%d, cols %d-%d' % (c1 - c0, cap, r0, r1, c0, c1))

stroke = stroke_width(band)
slope = lean(band)
print('  stroke %.1fpx, leaning %.1f deg' % (stroke, np.degrees(np.arctan(-slope))))

# Build the plus, cut a little finer than the numerals and leaned to match.
plus = shear(cross(PLUS_H * cap, PLUS_STROKE * stroke), slope)
pcols = np.flatnonzero((plus > 0.01).any(0))
plus = plus[:, pcols[0]:pcols[-1] + 1]
gap = int(round(PLUS_GAP * cap))
advance = plus.shape[1] + gap
shift = advance // 2
print('  plus %dx%d, advance %dpx — model line slides %dpx left'
      % (plus.shape[1], plus.shape[0], advance, shift))

# Slide the model line left by half the advance so A1492+ sits centred where
# A1492 did, then set the plus after the 2. PRO SERIES underneath stays put.
art = flat.copy()
art[r0:r1] = 0
paste(art, band[:, c0:c1], r0, c0 - shift)
paste(art, plus, int(round(r1 - PLUS_MID * cap - plus.shape[0] / 2.0)), c1 - shift + gap)

# Clear the panel and print the new mark back, at the density of the old one.
centre = ((FX0 + FX1) / 2.0, (FY0 + FY1) / 2.0)
out = blank.stamp(blank.clear(photo, PLUS_BOX, 'panel'),
                  PLUS_BOX, art, centre, FX1 - FX0, 'A1492+')
blank.save(out, str(ROOT / OUT))
