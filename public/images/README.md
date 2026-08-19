# Landing page media

These files are referenced by `public/styles.css`, `app/page.tsx`, and the hero
slideshow in `public/script.js`. Replace a file (keep the same name) to swap the
media — no code changes needed.

## Hero slideshow (right panel)

The hero cross-fades through these in order. `hero-2.jpg` paints immediately;
the rest are lazy-loaded and any that fail to load/play are skipped.

| File | Notes |
|------|-------|
| `hero-2.jpg` | Batter action shot — the first slide (paints instantly). |
| `hero.mp4` (`../videos/`) | Behind-the-scenes clip of a ball being stamped. H.264/AAC MP4, muted autoplay, `object-fit: cover`. Plays through, then the rotation continues. |
| `hero-3.jpg` | Pitcher action shot. |
| `hero-5.jpg` | Hydra baseballs on the grass (branded). |
| `hero-6.jpg` | Hydra A1492 Pro Series baseballs. |
| `hero-video-poster.jpg` | Poster frame shown before the video plays / if it can't. |

To swap the video, drop a web-friendly **H.264 MP4** at `public/videos/hero.mp4`
(re-encode `.mov`/HEVC phone clips first — those don't play in Chrome/Firefox).

## Other sections

| File | Where it shows | Notes |
|------|----------------|-------|
| `ball.jpg` | Source photo for everything below | The A1492 Pro Series product shot. No longer served to the browser itself — the tools measure and retouch it. |
| `ball-plus.jpg` | "The Ball" section, and the third shot in "The Hydra Difference" | The A1492+ game ball the section leads with, cut out of `ball-plus-src.jpg` and set on this photo's field. Built by `tools/make-ball-plus.py`. |
| `ball-plus-src.jpg` | Nowhere — an input to that tool | The phone shot of the game ball in hand, indoors. Kept at full size and orientation as it came off the phone; the tool applies the EXIF rotation itself. |
| `custom-indiana.jpg` | "The Hydra Difference" | A run stamped for Indiana Baseball, the team mark on the panel. Straight off the customizer, no retouching. |
| `custom-icml.jpg` | "The Hydra Difference" | A run stamped for the Indiana County Men's League. The league mark takes the horseshoe, so the Hydra name sits on the panel — the `ball-blank-horseshoe.jpg` path below. |
| `ball-blank.jpg` | "Your Logo. Our Leather." customizer | The same photo with the printed A1492 / PRO SERIES panel retouched out and the black band cropped off the top, so an uploaded logo lands on bare leather. The Hydra wordmark stays. |
| `ball-blank-horseshoe.jpg` | Same, when the logo is placed on the horseshoe | The Hydra wordmark cleared instead, since that's the spot the mark is taking — so the Hydra name moves down to the panel, where the `HYDRA / A1492` lockup is printed over the model mark. Fetched only when someone picks that placement. |
| `panel-lockup.png` | Printed into `ball-blank-horseshoe.jpg` | The `HYDRA / A1492` lockup as flat artwork, black on transparent. Not served to the browser — it's an input to the tool below. |
| `tray-plus.jpg` | _Currently unused_ | `hero-6.jpg` with the front-centre ball swapped for the A1492+, and the phone screenshot's black bands cropped off. Built by `tools/make-tray-plus.py`. Drop it in for `hero-6.jpg` in `.difference__media` to put the game ball in that panel. |
| `team/*.jpg` | "Front Office" | One headshot per person, 4:5 portrait, named after them (`ben-hudock.jpg`). Built from `team/src/` by `tools/make-headshots.py`, which cuts each person out of whatever they were photographed against and sets them all on one studio sweep. See `team/README.md`; the roster itself lives in the `TEAM` list in `app/page.tsx`. |
| `players.jpg` | _Currently unused_ | Was the quote band background; that section has been removed. |

Both blanks are generated from `ball.jpg` by `tools/make-ball-blank.py` (`python3
tools/make-ball-blank.py` from the repo root), and the lockup it prints comes
from `tools/make-panel-lockup.py` — run that first if the logo or the artwork
has changed, then re-run the blanks. `tools/make-ball-plus.py` is independent of
those two: it fits a circle to the ball in `ball-plus-src.jpg`, lifts the disc
whole — nothing occludes it, the hand is behind — corrects the indoor light to
daylight off the leather in both photos, and lays it into `ball.jpg` at that
ball's own place and size. `tools/make-tray-plus.py` imports that fit and drops
the same disc into `hero-6.jpg`, over the front-centre ball — nothing overlaps
that one, so the contacts and shadows around it already fit a ball that size.
It carries the tray's own light across rather than colour-correcting: blur both
discs past where printing survives, and their ratio is the key light, the
shading and the vignette. `make-panel-lockup.py` builds the lockup
out of artwork already in the repo rather than a font: the wordmark off
`public/logo.png`, the model mark lifted off `ball.jpg` itself and flattened
back off the sphere. Drop a real vector export in as `panel-lockup.png` instead
and `make-ball-blank.py` will print that.

Re-run both after replacing `ball.jpg` — and if the new shot frames the ball
differently, re-measure the ball circle, the two print spots and `PRINT_BOXES`
in `public/script.js`. That last one is where the customizer looks for the
printing already on the ball — the wordmark, the model mark or lockup, and the
specs line — so it can restamp it in the Pantone ink a team picks. A box that no
longer sits over its printing simply leaves that printing black.

If a file is missing, an on-brand gradient fallback renders in its place.
