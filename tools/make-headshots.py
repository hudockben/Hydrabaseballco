"""Cut the front-office headshots out of the photos people send and set them
all on one backdrop.

Reads

  public/images/team/src/<person>.<ext>   the photo as it arrived

and writes

  public/images/team/<person>.jpg         the card's 4:5 frame, 800x1000

The photos arrive from wherever the person happened to be photographed — a
grey studio wall, an office window with a field behind it, a circular crop on
black off someone's phone. Side by side on the card grid those backgrounds are
the first thing you see, ahead of the people, so each person is cut out of
their own and set on the same studio sweep: lighter behind the head, falling
off to the corners, in the blue-leaning greys the site is already built from.
The photographs themselves aren't retouched — only what's behind them.

The cut-out comes from u2net_human_seg through rembg, refined by alpha matting
so hair keeps its edge, then pulled in a pixel and softened by a hair's width:
without that the old background survives as a bright rim, which reads worse
than a soft edge. The frame each person is cropped to is recorded per person
below; it's chosen so the head sits at the same size in every card, and for
Ari — whose photo is a disc, with his head close to its rim — so the bottom
edge stays inside the disc, where the shirt was cut off.

Needs pillow, numpy, rembg, onnxruntime and pymatting; the model downloads
itself on the first run.

    python3 tools/make-headshots.py            # from the repo root
"""

import os

import numpy as np
from PIL import Image, ImageFilter, ImageOps
from rembg import new_session, remove

SRC_DIR = 'public/images/team/src'
OUT_DIR = 'public/images/team'

# The 4:5 the card frames, at twice the width it ever renders at.
CARD = (800, 1000)

# The sweep behind everyone: the tone right behind the head, and the tone the
# corners fall off to. Both sit in the site's ink range, blue-leaning, dark
# enough to hold a black polo without swallowing it.
BEHIND_HEAD = (76, 76, 84)
CORNERS = (31, 31, 38)

# Per person: the file that arrived, the crop taken from it, and whether the
# photo needs its phone-screenshot bands removed first. Crops are in the
# coordinates of the photo after that trim.
PEOPLE = [
    # Studio shot, head and shoulders already: the widest 4:5 the frame holds.
    {'id': 'brandon-miller', 'src': 'brandon-miller.jpeg', 'crop': (144, 0, 942, 998)},
    # Screenshot of a photo: bands off, then the widest 4:5 of what's left.
    {'id': 'ben-hudock', 'src': 'ben-hudock.png', 'crop': (117, 0, 1053, 1170), 'debanded': True},
    # A disc on black. The head nearly touches the rim, so the frame starts
    # above the disc — fine, since he's cut out of it either way — and stops
    # short of the bottom, where the disc cut his shirt off.
    {'id': 'ari-heinemann', 'src': 'ari-heinemann.png', 'crop': (217, 40, 985, 1000)},
    # Another screenshot. Shot from further back than the rest, so the frame
    # comes in tighter than the widest 4:5 to put her head at the same size.
    {'id': 'noel-miller', 'src': 'noel-miller.png', 'crop': (194, 8, 992, 1006), 'debanded': True},
    # Shot against a ballpark wall; the widest 4:5 the frame holds.
    {'id': 'paul-laudati', 'src': 'paul-laudati.jpeg', 'crop': (218, 0, 917, 874)},
]


def backdrop(size):
    """The studio sweep, at the size of the photo it goes behind."""
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    # Distance from a point a little above centre — where a head sits.
    d = np.hypot((xx - w * 0.5) / (w * 0.95), (yy - h * 0.34) / (h * 0.95))
    t = np.clip(d, 0, 1) ** 1.25
    near, far = np.array(BEHIND_HEAD, float), np.array(CORNERS, float)
    return Image.fromarray((near + (far - near) * t[..., None]).round().astype(np.uint8))


def matte(im, session):
    """Alpha for the person alone."""
    cut = remove(im, session=session, alpha_matting=True,
                 alpha_matting_foreground_threshold=248,
                 alpha_matting_background_threshold=12,
                 alpha_matting_erode_size=8)
    # A pixel in, so the background the person was shot against doesn't ride
    # along as a rim, then softened so the cut isn't a paper edge.
    return cut.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))


def deband(im):
    """Drop the black a phone screenshot pads the photo with."""
    a = np.asarray(im.convert('L')).astype(int)
    rows = np.where((a.max(axis=1) > 34) & (a.mean(axis=1) > 6))[0]
    cols = np.where((a.max(axis=0) > 34) & (a.mean(axis=0) > 6))[0]
    return im.crop((cols[0], rows[0], cols[-1] + 1, rows[-1] + 1))


def main():
    session = new_session('u2net_human_seg')
    for person in PEOPLE:
        im = ImageOps.exif_transpose(Image.open(os.path.join(SRC_DIR, person['src'])))
        im = im.convert('RGB')
        if person.get('debanded'):
            im = deband(im)
        set_on = backdrop(im.size)
        set_on.paste(im, (0, 0), matte(im, session))
        out = os.path.join(OUT_DIR, person['id'] + '.jpg')
        card = set_on.crop(person['crop']).resize(CARD, Image.LANCZOS)
        card.save(out, 'JPEG', quality=88, optimize=True, progressive=True)
        print(f'{out}  {card.size[0]}x{card.size[1]}  {os.path.getsize(out) // 1024}KB')


if __name__ == '__main__':
    main()
