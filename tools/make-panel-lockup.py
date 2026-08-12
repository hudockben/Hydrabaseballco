"""Build the HYDRA / A1492 lockup the customizer prints on the panel.

When a team's mark takes the horseshoe, the panel carries the Hydra name with
the model under it instead of the A1492 / PRO SERIES mark the ball ships with.
This writes that lockup as flat artwork:

  public/images/panel-lockup.png   black on transparent, ready to print

Both halves come from artwork already in the repo rather than a font, so the
letterforms are the real ones:

  HYDRA   the wordmark out of public/logo.png
  A1492   the model mark off public/images/ball.jpg, lifted by the same black
          top-hat make-ball-blank.py uses and flattened back off the sphere

The photographed mark is italic, as it is printed on the ball. The wordmark's
second line is upright in public/logo.png -- an upright line under the slanted
wordmark is how the lockup is drawn -- so the slant is measured off the stem of
the 1 and sheared back out.

Run from the repo root:  python3 tools/make-panel-lockup.py
Then re-run make-ball-blank.py, which prints this onto the horseshoe blank.
"""
from PIL import Image
import numpy as np

LOGO = 'public/logo.png'
BALL = 'public/images/ball.jpg'
OUT = 'public/images/panel-lockup.png'

# The ball in the source photo, and the panel it is printed on (both measured
# in make-ball-blank.py, which is where these came from).
BALL_CX, BALL_CY, BALL_R = 545.5, 536.8, 394.5
PANEL_BOX = (380, 750, 515, 695)

# Bands in public/logo.png: the wordmark, and the rule line under it. Rows are
# the ink's own extents, so a redrawn logo only needs these re-measured.
WORDMARK = (43, 999, 348, 457)      # x0, x1, y0, y1 of HYDRA
RULE_L = (38, 227, 485, 530)        # the dash left of BASEBALL CO.
RULE_R = (819, 996, 485, 530)       # and the one right of it

# Layout, in multiples of the wordmark's height. The model line sits a little
# larger than BASEBALL CO. does, as the lockup draws it.
GAP = 0.25
MODEL_H = 0.62
RULE_GAP = 0.16
SCALE = 2.0                          # output is this many logo.png pixels


def coverage(rgba):
    """Ink coverage 0..1 of black artwork, whether it is matted or has alpha."""
    a = rgba[..., 3] / 255.0
    lum = rgba[..., :3].mean(2) / 255.0
    return np.clip(a * (1 - lum), 0, 1)


def morph(x, n, grow):
    """Grayscale dilation (grow=True) or erosion, n steps of a plus kernel."""
    for _ in range(n):
        p = np.pad(x, 1, mode='edge')
        stack = [p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:], x]
        x = np.maximum.reduce(stack) if grow else np.minimum.reduce(stack)
    return x


def trim(cov):
    """Crop to the ink, and hand back the box it came from."""
    rows = np.where((cov > 0.5).any(1))[0]
    cols = np.where((cov > 0.5).any(0))[0]
    return cov[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]


def resize(cov, w, h):
    im = Image.fromarray((np.clip(cov, 0, 1) * 255).astype(np.uint8), 'L')
    return np.asarray(im.resize((max(1, int(round(w))), max(1, int(round(h)))), Image.LANCZOS)).astype(np.float32) / 255.0


def unproject(cov, x0, y0):
    """A decal off the sphere. A screen point r radii from the centre sits
    asin(r) radians of arc away, so sampling the photo at sin(r) walks the
    artwork back to the flat it was printed from."""
    fx0, fx1, fy0, fy1, px = -0.45, 0.55, -0.10, 0.42, 1400.0
    w, h = int((fx1 - fx0) * px), int((fy1 - fy0) * px)
    fx = fx0 + (np.arange(w) + 0.5) / px
    fy = fy0 + (np.arange(h) + 0.5) / px
    FY, FX = np.meshgrid(fy, fx, indexing='ij')
    r = np.hypot(FX, FY)
    k = np.where(r < 1e-6, 1.0, np.sin(np.clip(r, None, np.pi / 2)) / np.maximum(r, 1e-6))
    sx = np.clip(BALL_CX + FX * k * BALL_R - x0, 0, cov.shape[1] - 1.001)
    sy = np.clip(BALL_CY + FY * k * BALL_R - y0, 0, cov.shape[0] - 1.001)
    i, j = sx.astype(int), sy.astype(int)
    tx, ty = sx - i, sy - j
    return (cov[j, i] * (1 - tx) * (1 - ty) + cov[j, i + 1] * tx * (1 - ty) +
            cov[j + 1, i] * (1 - tx) * ty + cov[j + 1, i + 1] * tx * ty)


def lines(cov):
    """Split a flattened panel into its rows of type, top down."""
    on = (cov > 0.5).any(1)
    out, start = [], None
    for y, v in enumerate(on):
        if v and start is None:
            start = y
        elif not v and start is not None:
            out.append(cov[start:y]); start = None
    if start is not None:
        out.append(cov[start:])
    return out


def deslant(cov):
    """Shear the italic out, by the lean of the narrowest glyph's stem."""
    runs, start = [], None
    on = (cov > 0.5).any(0)
    for x, v in enumerate(on):
        if v and start is None:
            start = x
        elif not v and start is not None:
            runs.append((start, x - 1)); start = None
    if start is not None:
        runs.append((start, len(on) - 1))
    x0, x1 = min(runs, key=lambda r: r[1] - r[0])
    stem = cov[int(cov.shape[0] * 0.45):, x0:x1 + 1]
    ys, cs = [], []
    for y in range(stem.shape[0]):
        m = np.flatnonzero(stem[y] > 0.5)
        if m.size > 3:
            ys.append(y + int(cov.shape[0] * 0.45)); cs.append(m.mean())
    slope = np.polyfit(np.array(ys, float), np.array(cs, float), 1)[0]
    print('  model mark leans %.1f deg — shearing it upright' % np.degrees(np.arctan(-slope)))

    h, w = cov.shape
    mid = h / 2.0
    pad = int(abs(slope) * h) + 2
    out = np.zeros((h, w + 2 * pad), np.float32)
    src = np.arange(w + 2 * pad, dtype=np.float32) - pad
    for y in range(h):
        u = src + slope * (y - mid)           # undo the lean row by row
        i = np.floor(u).astype(int)
        t = u - i
        ok = (i >= 0) & (i < w - 1)
        out[y, ok] = cov[y, i[ok]] * (1 - t[ok]) + cov[y, i[ok] + 1] * t[ok]
    return trim(out)


logo = np.asarray(Image.open(LOGO).convert('RGBA')).astype(np.float32)
lx0, lx1, ly0, ly1 = WORDMARK
hydra = trim(coverage(logo[ly0:ly1 + 1, lx0:lx1 + 1]))
rule_l = trim(coverage(logo[RULE_L[2]:RULE_L[3], RULE_L[0]:RULE_L[1] + 1]))
rule_r = trim(coverage(logo[RULE_R[2]:RULE_R[3], RULE_R[0]:RULE_R[1] + 1]))
print('wordmark %dx%d, rules %dx%d and %dx%d'
      % (hydra.shape[1], hydra.shape[0], rule_l.shape[1], rule_l.shape[0],
         rule_r.shape[1], rule_r.shape[0]))

photo = np.asarray(Image.open(BALL).convert('RGB')).astype(np.float32)
px0, px1, py0, py1 = PANEL_BOX
region = photo[py0:py1, px0:px1]
lum = 0.299 * region[..., 0] + 0.587 * region[..., 1] + 0.114 * region[..., 2]
closed = morph(morph(lum, 20, True), 20, False)
# Coverage, not the tool's hard mask: these glyphs are becoming artwork, so
# their edges have to keep the softness they were printed with.
depth = closed - lum
cov = np.clip(depth / np.maximum(closed * 0.95, 1), 0, 1) * np.clip((depth - 18) / 20.0, 0, 1)
cov[(region[..., 0] - region[..., 1]) > 22] = 0     # red seam thread is not ink
model = deslant(trim(lines(unproject(cov, px0, py0))[0]))
print('model mark %dx%d' % (model.shape[1], model.shape[0]))

# Lay it out: the wordmark, then the model between the rules on one line the
# width of the wordmark, the way public/logo.png sets its own second line.
hw = int(round(hydra.shape[1] * SCALE))
hh = int(round(hydra.shape[0] * SCALE))
mh = int(round(hh * MODEL_H))
mw = int(round(model.shape[1] * mh / model.shape[0]))
gap = int(round(hh * GAP))
rgap = int(round(hh * RULE_GAP))
rw = (hw - mw - 2 * rgap) // 2
rh_l = max(1, int(round(rule_l.shape[0] * rw / rule_l.shape[1])))
rh_r = max(1, int(round(rule_r.shape[0] * rw / rule_r.shape[1])))

sheet = np.zeros((hh + gap + mh, hw), np.float32)
sheet[:hh] = resize(hydra, hw, hh)
line = np.zeros((mh, hw), np.float32)
line[:, (hw - mw) // 2:(hw - mw) // 2 + mw] = resize(model, mw, mh)
for piece, h_r, x in ((rule_l, rh_l, 0), (rule_r, rh_r, hw - rw)):
    top = (mh - h_r) // 2
    line[top:top + h_r, x:x + rw] = np.maximum(line[top:top + h_r, x:x + rw], resize(piece, rw, h_r))
sheet[hh + gap:] = line

out = np.zeros(sheet.shape + (4,), np.uint8)
out[..., 3] = np.clip(sheet * 255, 0, 255)
Image.fromarray(out).save(OUT)
print('wrote %-34s %dx%d' % (OUT, out.shape[1], out.shape[0]))
