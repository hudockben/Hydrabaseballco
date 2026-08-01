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
| `ball.jpg` | "The Hydra Difference" panel | The A1492 Pro Series product photo, cropped square-ish (`cover`). |
| `ball-blank.jpg` | "Your Logo. Our Leather." customizer | The same photo with the printed A1492 / PRO SERIES panel retouched out and the black band cropped off the top, so an uploaded logo lands on bare leather. |
| `ball-blank-horseshoe.jpg` | Same, when the logo is placed on the horseshoe | As above **plus** the Hydra wordmark cleared, since that's the spot the mark is taking. Fetched only when someone picks that placement. |

Both blanks are generated from `ball.jpg` by `tools/make-ball-blank.py` (`python3
tools/make-ball-blank.py` from the repo root). Re-run it after replacing
`ball.jpg` — and if the new shot frames the ball differently, re-measure the
ball circle and the two print spots in `public/script.js`.
| `players.jpg` | _Currently unused_ | Was the quote band background; that section has been removed. |

If a file is missing, an on-brand gradient fallback renders in its place.
