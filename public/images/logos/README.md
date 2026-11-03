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
   one's width and height. If the logo is a lockup — a mark with the name set
   out beside it — give its mark's box in `MARK_ONLY` too, and the strip shows
   the mark at full size rather than the whole lockup shrunk to fit.
3. Add a line to `CLIENTS` in `app/page.tsx`: the name the strip shows beside
   the logo, the id, and the width and height the tool printed. Its place in
   that list is its place in the ticker. The ticker's speed doesn't change as
   the list grows — the loop's run time scales with the count.

To take one off the strip, delete its line from `CLIENTS`.

| | |
|---|---|
| **Format** | A PNG with a transparent background, or anything on white — the strip is white, so a white box disappears into it. A one-colour logo reversed out of a dark field (white on black) goes in `REVERSED` in the tool, which redraws it dark on clear. A logo on any other colour brings that colour along as a box. |
| **Size** | ~100px tall or more. The strip never draws a logo taller than 40px, and the tool writes 120px for sharp 3x screens; it won't scale a smaller file up. |
| **Shape** | Any. A wide wordmark is drawn shorter than a round crest so the two carry about the same weight — `logoSize()` in `app/page.tsx`. |

## What's here

| File | Name on the strip | As it arrived |
|------|-------------------|---------------|
| `georgetown.png` | Georgetown | The "G", transparent. |
| `north-shore-navigators.png` | North Shore Navigators | 400px JPEG on white. |
| `high-point.png` | High Point | Transparent, on its own white disc. |
| `socal-msbl.png` | SoCal MSBL | 185 × 144 PNG on white — the MSBL/MABL of Southern California mark. |
| `cal-state-bakersfield.png` | Cal State Bakersfield | Transparent, with a white keyline. |
| `berrys-athletic-supply.png` | Berry's Athletic Supply | 220px JPEG on white, the mark only 57px tall of it. Sharp enough at the size it's drawn; a bigger file would still be an upgrade. |
| `siena.png` | Siena | Transparent wordmark. |
| `highlands.png` | Highlands HS | 560 × 123 JPEG on white: the ram, with "HIGHLANDS GOLDEN RAMS" in two lines beside it. The strip takes the ram alone (`MARK_ONLY`) — whole, it would come out 24px tall. |
| `lipscomb.png` | Lipscomb | 479 × 417 PNG on white: the bison over the "L". |
| `music-city-classic.png` | Music City Classic | 400px JPEG, white on black: the MCC monogram over "MUSIC CITY CLASSIC". The strip takes the monogram alone (`MARK_ONLY`), redrawn in near-black on clear (`REVERSED`) so it doesn't sit on the strip as a black square. |
| `college-of-charleston.png` | College of Charleston | Transparent: the "C" with "Charleston" scripted across it. |
| `bristol-blues.png` | Bristol Blues | Transparent script wordmark. Arrived as `bristol blue.png`. |
