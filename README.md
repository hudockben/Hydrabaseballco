# Hydra Baseball Co.

The Hydra Baseball Co. website **plus** an internal admin tool — **Hydra
Prospector** — for finding and managing sales leads (colleges, facilities,
leagues) to sell baseballs to.

Built with **Next.js** (App Router) and deployed on **Vercel**, backed by
**Neon Postgres**.

## What's here

- **Public landing page** (`/`) — the marketing site, "Built for Competition."
- **Admin area** (`/admin`, password-protected):
  - **Find Prospects** — search free/public data sources by type + location and
    save leads.
  - **CRM** — pipeline (New → Contacted → Qualified → Won → Lost), notes, CSV export.
  - **Dashboard** — counts by status.

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
