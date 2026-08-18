# Crew photos

Headshots for the **Our Crew** section on the landing page. Drop a file in
here and point the person's `photo` at it in the `TEAM` list at the top of
`app/page.tsx` — that list is the only place the roster is edited.

| | |
|---|---|
| **Name it** | after the person, lowercase and hyphenated: `ben-hudock.jpg` |
| **Shape** | portrait, **4:5** (e.g. 800 × 1000). The card crops to 4:5 and anchors near the top of the frame, so leave a little room above the head |
| **Format** | `.jpg` for photos (a `.png` works, it's just heavier) |
| **Size** | ~800px wide is plenty — the card never renders larger than ~250px |

A person with no `photo` set shows their initials on the on-brand gradient
instead, so someone can go up on the site the day they start and get their
shot later. A `photo` that points at a file which isn't here yet falls back to
that same gradient rather than a broken frame.
