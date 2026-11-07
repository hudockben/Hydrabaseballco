# "Trusted By" logos

The logos in the ticker under the nav — the schools and organizations Hydra
has supplied. The strip runs them right to left with each one's name beside
it, and it's part of the fixed header, so it stays on screen the whole way down
the page; see `.ticker` in `public/styles.css`.

## Adding one

1. Drop the logo as it arrived into `src/`, named after the organization
   (`high-point.png`).
2. Add it to `LOGOS` in `tools/make-logos.py` and run the tool from the repo
   root:

   ```bash
   python3 tools/make-logos.py
   ```

   It trims every logo to its mark, writes `<id>.png` here, and prints each
   one's width and height. An SVG goes in as it came — the tool draws it out
   first, with cairosvg (`pip install cairosvg`). If the logo is a lockup — a
   mark with the name set out beside it — give its mark's box in `MARK_ONLY`
   too, and the strip shows the mark at full size rather than the whole lockup
   shrunk to fit.
3. Add a line to `CLIENTS` in `app/page.tsx`: the name the strip shows beside
   the logo, the id, and the width and height the tool printed. Its place in
   that list is its place in the ticker. The ticker's speed doesn't change as
   the list grows — the loop's run time scales with the count.

To take one off the strip, delete its line from `CLIENTS` and move its row
below to **Off the strip**. Leave its files and its `LOGOS` entry in the tool,
so putting it back is just its line again.

| | |
|---|---|
| **Format** | An SVG, a PNG or WebP with a transparent background, or anything on white — the strip is white, so a white box disappears into it. A one-colour logo reversed out of a dark field (white on black) goes in `REVERSED` in the tool, which redraws it dark on clear. One that came with a transparency checkerboard saved into it — grey and white squares where it should be clear — goes in `CHECKERED`, which turns the grey squares white. A logo on any other colour brings that colour along as a box. |
| **Size** | ~100px tall or more. The strip never draws a logo taller than 40px, and the tool writes 120px for sharp 3x screens; it won't scale a smaller file up. |
| **Shape** | Any. A wide wordmark is drawn shorter than a round crest so the two carry about the same weight — `logoSize()` in `app/page.tsx`. |

## What's here

| File | Name on the strip | As it arrived |
|------|-------------------|---------------|
| `georgetown.png` | Georgetown | The "G", transparent. |
| `socal-msbl.png` | SoCal MSBL | 185 × 144 PNG on white — the MSBL/MABL of Southern California mark. |
| `high-point.png` | High Point | Transparent, on its own white disc. |
| `nc-state.png` | NC State | SVG, as `NC_State_Wolfpack_logo.svg`: the wolf head in the red "NC STATE" cap, inside a black outline. The tool draws it out 960px tall, then trims and scales it like the rest. |
| `cal-state-bakersfield.png` | Cal State Bakersfield | Transparent, with a white keyline. |
| `berrys-athletic-supply.png` | Berry's Athletic Supply | 220px JPEG on white, the mark only 57px tall of it. Sharp enough at the size it's drawn; a bigger file would still be an upgrade. |
| `siena.png` | Siena | Transparent wordmark. |
| `pepperdine.png` | Pepperdine | 900 × 639 PNG: the "P", navy with an orange outline, on a transparency checkerboard saved into the file — 20px squares of white and light grey. The tool turns the grey squares white (`CHECKERED`); left in, they'd show on the strip as a faint checked box behind the "P". |
| `highlands.png` | Highlands HS | 560 × 123 JPEG on white: the ram, with "HIGHLANDS GOLDEN RAMS" in two lines beside it. The strip takes the ram alone (`MARK_ONLY`) — whole, it would come out 24px tall. |
| `lipscomb.png` | Lipscomb | 479 × 417 PNG on white: the bison over the "L". |
| `college-of-charleston.png` | College of Charleston | Transparent: the "C" with "Charleston" scripted across it. |
| `music-city-classic.png` | Music City Classic | 400px JPEG, white on black: the MCC monogram over "MUSIC CITY CLASSIC". The strip takes the monogram alone (`MARK_ONLY`), redrawn in near-black on clear (`REVERSED`) so it doesn't sit on the strip as a black square. |
| `rutgers.png` | Rutgers | 2000 × 853 WebP, transparent: the script wordmark. |

## Off the strip

Supplied, and still cut by the tool, but taken off the strip for now. Their
files stay here and in `src/` so either can go back on: paste its line into
`CLIENTS` in a slot that keeps the order the comment there describes, and
move its row back up.

| File | Name on the strip | As it arrived |
|------|-------------------|---------------|
| `north-shore-navigators.png` | North Shore Navigators | 400px JPEG on white. |
| `bristol-blues.png` | Bristol Blues | Transparent script wordmark. Arrived as `bristol blue.png`. |

```ts
{ name: 'North Shore Navigators', logo: 'north-shore-navigators', width: 121, height: 120 },
{ name: 'Bristol Blues', logo: 'bristol-blues', width: 223, height: 120 },
```
