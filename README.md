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

## Deploy on Vercel (auto-deploy)

This repo is Vercel-ready (`vercel.json`, static — no build step). Connect it
once and every push deploys automatically.

1. Go to [vercel.com](https://vercel.com) and sign in **with GitHub**.
2. Click **Add New… → Project**.
3. **Import** the `hudockben/hydrabaseballco` repository.
   (If you don't see it, click *Adjust GitHub App Permissions* and grant access.)
4. Leave the defaults — **Framework Preset: Other**, no build command,
   root directory `./` — and click **Deploy**.

After that, Vercel deploys on every push:

- **Production** ← your **Production Branch** (default `main`).
- **Preview URL** ← every other branch and pull request.

> **Heads-up:** this landing page currently lives on the
> `claude/clever-keller-ddez9k` branch, so it will get a **preview** URL, not a
> production one. To make it your live production site, either merge it into
> `main`, or in **Vercel → Project Settings → Git → Production Branch** point
> production at this branch.

### Or deploy from the CLI

```bash
npm i -g vercel
vercel          # first run links/creates the project
vercel --prod   # promote to production
```

The CLI is great for one-off deploys, but the **GitHub import above is what
enables automatic deploys on push**.

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
