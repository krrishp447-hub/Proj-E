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

## Before launch

- `site.email` is the poster's placeholder (`hello@scout.io`) — replace with an owned address.
- Social links have no URLs yet (rendered as plain text until `href`s are set).
- No Open Graph image is set; add `src/app/opengraph-image.png` when artwork exists.
