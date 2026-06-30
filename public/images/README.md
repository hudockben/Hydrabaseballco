# Landing page photos

These photos are referenced by `public/styles.css` and `app/page.tsx`.
Replace a file (keep the same name) to swap the image — no code changes needed.

| File | Where it shows | Notes |
|------|----------------|-------|
| `hero.jpg` | Hero background — player anchored right, headline on the left | Portrait; dark studio backdrop blends into the hero. Sized with `background-size: auto 90%` so the full figure fits. |
| `ball.jpg` | "The Hydra Difference" panel | The A1492 Pro Series product photo, cropped square-ish (`cover`). |
| `players.jpg` | Quote band ("We play the game the right way.") | Landscape action shot (`cover`, slight darkening overlay). |

To re-position, edit the `background-position` / `background-size` values in
the `.hero`, `.difference__media`, and `.quote__media` rules in
`public/styles.css`. If a file is missing, an on-brand gradient fallback renders.
