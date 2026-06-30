# Landing page photos

The home page CSS (`public/styles.css`) already points at the files below.
Add an image with the matching name and it appears automatically — no code
changes needed. Until a file exists, an on-brand gradient fallback renders.

| File | Where it shows | Notes |
|------|----------------|-------|
| `hero.jpg` | Hero background — standing player, anchored to the right (the headline sits on the left). Its dark studio backdrop blends into the hero. | Portrait works well; ~1000px+ tall |
| `players.jpg` | Quote band ("We play the game the right way.") — action photo on the left | Landscape works well; ~1200×900 |
| `ball.jpg` | _Optional._ "The Hydra Difference" panel currently uses the Hydra ball graphic; not wired to a file. | — |

To swap positioning, edit the `background-position` / `background-size` values
in the `.hero` and `.quote__media` rules in `public/styles.css`.
