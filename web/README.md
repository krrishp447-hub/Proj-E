# Scout — marketing site

Next.js (App Router, TypeScript strict, Tailwind v4) port of the original `scout-poster.html`, with GSAP + ScrollTrigger driving scroll motion.

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_SITE_URL to the deployed origin
npm run dev                  # http://localhost:3000
npm run build && npm start   # production
npm test                     # node:test unit checks
npm run lint && npm run typecheck
```

## Routes

| Path | Source |
|---|---|
| `/` | Poster site — `src/app/page.tsx` + `src/components/sections/*` |
| `/demo` | Product demo (React): `src/app/demo` + `src/components/demo`, engine in `src/lib/scout` |
| `/film` | Original product film, served as-is from `public/demo-video.html` |

## How it fits together

- Sections are Server Components. Interactivity lives in small client islands:
  `ScrollEffects` (scroll motion + Lenis), `SiteNav` (menu dialog), `SignalField` (hero dots), `BriefTry`, `FeatureCarousel`, `Showreel`.
- Motion opts in via data attributes (`data-io`, `data-scrub`, `data-par`, `data-count`, `data-type`) — see
  `src/components/animations/ScrollEffects.tsx`. Hidden start states only apply under `html.js`, so content
  renders without JavaScript, and everything respects `prefers-reduced-motion`.
- Site-wide copy/links live in `src/config/site.ts`.

## Go live

### 1 · Deploy (Vercel)
1. vercel.com → Add New → Project → import the GitHub repo → **Root Directory: `web`** → Deploy.
2. Project → Settings → Environment Variables: `NEXT_PUBLIC_SITE_URL` = your live URL. Redeploy.
3. Project → Domains: add your domain, set the DNS records Vercel shows.

Without the variables below the site runs on the illustrative demo dataset (labelled as such in the app).

### 2 · Live creator data (YouTube)
1. **Database:** Vercel project → Storage → add **Neon** (Postgres). It injects `DATABASE_URL`.
2. **YouTube key:** Google Cloud console → new project → enable *YouTube Data API v3* → Credentials → API key
   (restrict it to that API). Add it as `YOUTUBE_API_KEY` in Vercel.
3. **Cron secret:** add `CRON_SECRET` (any long random string) in Vercel. `vercel.json` schedules `/api/cron/ingest`
   daily at 03:00 IST; Vercel sends the secret automatically.
4. Locally: `vercel env pull .env.local`, then
   ```bash
   npm run db:migrate                     # create tables (db/schema.sql)
   npm run discover                       # seed channels via YouTube search (100 quota units/query)
   curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/ingest   # first ingest now
   ```
   The app switches to "Live · YouTube public data" as soon as rows exist; growth fills in after ~30 days of daily
   snapshots. Quota: ingest costs ≈2 units per channel per day (10,000/day free).

**What live data does and doesn't include:** public stats (subs, views, engagement, cadence, growth, niche/sub-niche
from titles and tags, estimated authenticity). Audience demographics need creators to connect their channel (YouTube
Analytics / Instagram insights OAuth — not built yet); outcome metrics (campaigns, repeat, delivered) accrue from
campaigns run on Scout.

### Before announcing
- Replace `site.email` (`hello@scout.io` placeholder) in `src/config/site.ts`; add social URLs.
- Have `/privacy` and `/terms` (drafts) reviewed by counsel.
- Swap the placeholder music in the launch film / showreel.
