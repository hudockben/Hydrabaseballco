# Hydra Baseball Co. — Built for Competition

Landing page for **Hydra Baseball Co.**, a baseball company that sells
competition-grade ball products — full grain leather covers, cork &amp; rubber
cores, built for every pitch, every inning, every game.

## Brand

- **Tagline:** Built for Competition.
- **Flagship product:** Hydra Prime — Collegiate · Cork + Rubber Core · Full Grain Leather
- **Heritage:** Inspired by the legacy of Rawlings, Wilson, and Baden.
- **Color scheme:**
  - Ink / near-black `#15151a`
  - Bronze / tan accent `#c8966a`
  - Cream / off-white `#f3efe7`

## Files

```
.
├── index.html   # The landing page
├── styles.css   # Brand styling (colors, layout, responsive)
└── script.js    # Nav, mobile menu, scroll reveal
```

It's a static site — no build step or dependencies.

## View it locally

Just open `index.html` in a browser, or serve the folder:

```bash
# Python
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy with GitHub Pages

1. Push to GitHub (this repo: `hudockben/hydrabaseballco`).
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
4. Choose the branch and the `/ (root)` folder, then **Save**.
5. Your site goes live at `https://hudockben.github.io/hydrabaseballco/`.

## Customizing

- Product names, specs, and copy live in `index.html`.
- Colors and spacing are CSS variables at the top of `styles.css` (`:root`).
- Swap the CSS/SVG baseball illustrations for real product photos when ready.

---

&copy; Hydra Baseball Co.™ — All rights reserved.
