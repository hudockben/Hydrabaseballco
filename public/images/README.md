# Landing page photos

Drop real photos here to replace the gradient placeholders on the home page.
The CSS in `public/styles.css` already references these paths — just add the
files with these exact names and they'll appear automatically:

| File | Where it shows | Recommended |
|------|----------------|-------------|
| `hero.jpg` | Hero background (pitcher) | ~2000×1200, subject on the right (text sits on the left) |
| `ball.jpg` | "The Hydra Difference" panel (ball in grass) | ~1000×1000+ |
| `players.jpg` | Quote band ("We play the game the right way.") | ~1200×900 |

To use a photo, open `public/styles.css` and add the image to the relevant
`background-image` rule, e.g. for the hero:

```css
.hero {
  background-image:
    radial-gradient(900px 520px at 78% 18%, rgba(200,32,47,0.18), transparent 60%),
    url('/images/hero.jpg');
}
```

Until then, the page renders complete with on-brand gradient fallbacks.
