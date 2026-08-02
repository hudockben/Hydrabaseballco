# Hydra Baseball Co.

The Hydra Baseball Co. website **plus** an internal admin tool — **Hydra
Prospector** — for finding and managing sales leads (colleges, facilities,
leagues) to sell baseballs to.

Built with **Next.js** (App Router) and deployed on **Vercel**, backed by
**Neon Postgres**.

## What's here

- **Public landing page** (`/`) — the marketing site, "By Players For Players."
  Ordered so the product leads: hero → **the ball** (A1492 Pro Series lineup and
  specs) → **customize** (drop a team logo onto a real ball photo) → the Hydra
  difference → mission → team orders. Photos drop into `public/images/`
  (see `public/images/README.md`); on-brand gradient fallbacks render until then.
- **Admin area** (`/admin`, password-protected):
  - **Find Prospects** — search free/public data sources by type + location and
    save leads.
  - **CRM** — pipeline (New → Contacted → Qualified → Won → Lost), notes, CSV export.
  - **Customer List** — the recruiting sheet, run as a tiered reach-out queue.
    One search box (`state:pa`, `div:d3`, `has:email`, `missing:contact`,
    `tier:a`, `status:new`, `-word`, `"exact phrase"`) filters and ranks; every
    school is scored **Tier A → D** on how likely it is to buy (1st-degree
    connection, buying signals in the notes, contact info on file, division, and
    distance from your home state — hover a badge for the exact reasons).
    **Find missing contacts** crawls each school's roster link / athletics site
    for the head coach, email, and phone and fills the blanks in. Each card then
    has a ready-to-send email draft, a status (new → contacted → replied →
    interested → customer / passed), and inline editing; **Sheet** view keeps the
    full spreadsheet. CSV export carries the tier, score, and next action.
  - **Inventory** — stock on hand per item (SKU, category, reorder level, unit
    cost/price, supplier, location). Receive / ship adjustments update the count
    and write an auditable movement log; low-stock items are flagged. CSV export.
  - **Pricing** — products with per-unit cost (COGS) + shipping, volume price
    tiers, and a cost → price → margin calculator for setting price points.
  - **Revenue** — log sales from won deals; revenue, COGS, shipping, profit, and
    gross-margin roll-ups (totals, by product, by month).
  - **Dashboard** — prospect counts by status + headline financials.

## Data sources (free / public)

| Type | Source | Notes |
|------|--------|-------|
| Colleges | [College Scorecard API](https://collegescorecard.ed.gov/data/documentation/) | Strong coverage. Public `DEMO_KEY`, or set `SCORECARD_API_KEY`. |
| Facilities | [OpenStreetMap Overpass](https://overpass-api.de/) + Nominatim | Coverage of *named* cages/complexes varies by area. |
| Leagues | _coming next_ | Hardest on the free tier. |

> Connectors live in `lib/connectors.ts` and are isolated, so a paid source
> (Google Places, Hunter, etc.) can be added later without touching the UI.

## Environment variables

Copy `.env.example` and set these in **Vercel → Settings → Environment Variables**
(never commit real values):

| Var | What |
|-----|------|
| `DATABASE_URL` | Neon Postgres connection string (pooled). |
| `ADMIN_PASSWORD` | Password to reach `/admin`. |
| `SESSION_SECRET` | Long random string for signing login cookies (`openssl rand -hex 32`). |
| `SCORECARD_API_KEY` | _Optional_ — higher College Scorecard rate limits. |

## Database setup (Neon)

Run the schema once in the **Neon SQL editor**:

```bash
# contents of db/schema.sql
```

If your database predates the pricing/revenue tools, run the migration too:

```bash
# contents of db/migrations/2026-06-14-add-finance.sql
```

If it predates the Inventory tab, run:

```bash
# contents of db/migrations/2026-06-15-add-inventory.sql
```

The app also applies the schema itself on the first request (`ensureSchema` in
`lib/db.ts`), so the Customer List reach-out columns
(`db/migrations/2026-08-01-add-customer-outreach.sql`) land automatically —
running that one by hand is optional.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000  (admin at /admin)
```

## Deploy

This repo is the source for the `hydrabaseballcompany` Vercel project. Point that
project at this repo (Settings → Git), set the env vars above, and pushes to the
production branch deploy automatically.

## Roadmap

- Leagues connector (Little League / travel ball)
- Contact enrichment (scrape org sites for email/phone)
- Per-user logins & assignment
- Saved searches / scheduled pulls
