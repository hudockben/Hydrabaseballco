# Front office photos

Headshots for the **Front Office** section on the landing page. The card's
`photo` points at a file here — the roster itself is the `TEAM` list at the top
of `app/page.tsx`, and that list is the only place it's edited.

## Adding someone

Drop the photo as it arrived into `src/`, named after the person
(`ben-hudock.png`), add them to `PEOPLE` in `tools/make-headshots.py` with the
4:5 crop you want taken from it, and run the tool from the repo root:

```bash
python3 tools/make-headshots.py
```

It writes `<person>.jpg` here at 800 × 1000 — the 4:5 the card frames, at twice
the width it ever renders. Everyone comes out on the same studio sweep,
whatever they were photographed against, which is the point: side by side on
the grid, three different backgrounds read before the three people do. Don't
hand-crop a headshot in here — a photo that skips the tool brings its own
background with it and breaks the row.

| | |
|---|---|
| **Shape** | portrait, **4:5**. Leave a little room above the head; aim to match the head size in the cards already there |
| **Format** | whatever came off the camera or phone goes in `src/`; the tool writes JPEG |
| **Size** | anything from ~1000px up. The card never renders larger than ~270px wide |

A person with no `photo` set at all shows their initials on the card's gradient
instead, so someone can go up the day they start and get their shot later. A
`photo` pointing at a file that isn't here yet falls back to that same
gradient rather than a broken frame.
