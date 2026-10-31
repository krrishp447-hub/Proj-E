<div align="center">

# ⚡ Scout

**Creator Discovery, Auditable Intelligence & Deal Execution Engine**

*Find the right creators, not more creators.*

[![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/Neon%20Postgres-Serverless-00E599?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Unit%20Tests-75%20Passing-brightgreen?style=for-the-badge&logo=node.js&logoColor=white)](web/tests)
[![Precision](https://img.shields.io/badge/Search%20Precision-98%25%20%4010-blueviolet?style=for-the-badge)](web/scripts/benchmark.ts)
[![License](https://img.shields.io/badge/License-MIT-amber?style=for-the-badge)](LICENSE)

[Live Demo](http://localhost:3000/demo) · [Product Decisions & Build Log](docs/DECISIONS.md) · [Technical Audit & GTM Strategy](docs/SCOUT_AUDIT_AND_GTM.md)

</div>

---

## 📌 Overview

**Scout** is a specialized creator discovery and campaign execution platform built for performance marketing agencies, consumer brands, and creator managers.

Traditional influencer platforms index millions of scraped social profiles, charging high enterprise retainers while dumping unwieldy 500-row filter tables. Marketers spend hours manually filtering vanity follower numbers, guessing authenticity, and checking whether a creator has ever actually talked about their product category.

Scout solves this by shifting the paradigm from **follower search** to **natural language contextual matching** and **verified campaign outcome data**:

1. **Natural Language Brief Parsing**: Drop plain-English requirements (e.g., *"Indian YouTube tech creators who review earbuds, 50K–500K subs, strong engagement"*) or multilingual regional queries (Hindi, Tamil, Telugu, Hinglish) and get instant, structured criteria.
2. **Auditable 8-Signal Ranking**: Ranks creators on an explainable 0–100 scale using content-word Inverse Document Frequency (IDF), niche-median engagement baselines, upload momentum, and repeat sponsor retention—never raw follower counts.
3. **Verified First-Party Moat**: Creators link their YouTube account via OAuth, unlocking **✓ Verified** retention curves, real audience demographics (age, gender, geography), and private analytics that scrapers cannot access.
4. **End-to-End Campaign Lifecycle**: Seamless transition from discovery to shortlist, built-in deal terms negotiation board with algorithmic fair-market pricing guides, and automatic video upload proofing.
5. **Real-Time Share of Voice (SOV)**: Automated regex scanning of 5,000+ creator uploads over rolling 90-day windows to map brand mentions, competitor share, and earned vs. paid reach.

---

## 🚀 Key Features

### 1. Multilingual Brief Understanding
* **Zero Complex Query Syntax**: Parses size constraints (`50k to 500k`), niche boundaries (`tech`, `skincare`, `finance`), language filters (`Hindi`, `Tamil`), and negative criteria (`gaming but not bgmi`).
* **Regional Script & Slang Support**: Handles Hindi Devanagari (e.g., *टेक रिव्यू हिंदी*), Telugu, Tamil, and everyday Hinglish idioms (*paisa kaise bachaye*, *gaane sunao*).
* **Typo Tolerance & Lemmatization**: Automatic phonetic and distance correction (e.g., `ernbuds` → `earbuds`, `fitnes` → `fitness`).

### 2. The 8-Signal Scoring Engine
Every candidate creator is evaluated across eight distinct, transparent ranking dimensions:

| Signal | Evaluation Methodology | Why It Matters |
| :--- | :--- | :--- |
| **Topic Relevance (IDF)** | Compares video title keywords against corpus term frequencies | Distinguishes dedicated reviewers from channels that mentioned a term once |
| **Platform Alignment** | Confirms primary channel presence on target platform | Eliminates dead syndications or mismatched platform audiences |
| **Audience Geography** | First-party retention & geographic concentration | Ensures budget targets regions where the brand can actually ship products |
| **Dynamic Engagement** | Benchmarked against specific niche medians (not a flat 3%) | Recognizes that a 4% engagement in Tech is stellar, while Gaming demands more |
| **Growth Momentum** | 90-day subscriber derivative calculation | Detects emerging breakout talent before their sponsorship fees surge |
| **Reach Distribution** | Median log-scaled view count per video | Immunizes campaigns against single viral anomalies that distort averages |
| **Upload Cadence** | Frequency and posting consistency over 90 days | Flags dormant or retired creators who no longer command active audiences |
| **Authenticity & Track Record** | Bought-follower anomaly penalty + repeat brand sponsor rate | Protects marketing budgets from bot farms and unvetted creators |

### 3. Transparent Deal Management & Fair Pricing
* **Algorithmic Fair-Rate Guide (`fairRate`)**: Calculates market-accurate pricing bands (e.g. ₹15,000–₹25,000) based on median view counts and engagement tiers, empowering brands and creators to negotiate fairly.
* **Built-in Offer Board**: State machine tracking stages: `Inbound` → `Negotiation` → `Accepted` → `Delivered` → `Paid`.
* **Turn-Based Counter Offers**: Structured deliverables, usage rights, and milestone timelines eliminate messy email chains.

### 4. Competitive Share of Voice (SOV)
* Live tracking across key consumer sectors (e.g., TWS Earbuds: boAt, Noise, OnePlus, realme, Boult, JBL).
* Real-time calculation of creator view share, video count share, and paid sponsorship disclosures vs. organic mentions.

---

## 🏗️ Architecture & Technology Stack

```mermaid
graph TD
    User([Marketer / Brand / Agency]) <-->|HTTPS| Cloudflare[Edge CDN / Next.js Web App]
    
    subgraph Frontend [Next.js 16 Web Tier]
        AppRouter[App Router / Server Components]
        SearchUI[Interactive Discovery Demo /demo]
        DealBoard[Deal Management Board /dashboard]
        GSAP[GSAP + ScrollTrigger + Lenis Motion System]
    end

    subgraph CoreEngine [Scout Intelligence Core]
        Parser[NLP Brief Parser & Synonyms]
        Scorer[8-Signal Ranking Engine]
        SOVEngine[Share of Voice Aggregator]
        FairPricer[Algorithmic Rate Calculator]
    end

    subgraph DataTier [Storage & Background Pipelines]
        Neon[(Neon Serverless PostgreSQL)]
        VercelCron[Vercel Cron Workers]
        DiscoverWorker[Channel Discovery Worker]
        IngestWorker[Nightly Metric Ingest Worker]
    end

    subgraph ExternalAPIs [External APIs]
        YTData[YouTube Data API v3]
        YTAnalytics[YouTube Analytics API v2]
        GoogleAuth[Google Cloud OAuth 2.0]
    end

    Cloudflare <--> AppRouter
    AppRouter --> CoreEngine
    AppRouter <--> Neon
    VercelCron --> DiscoverWorker & IngestWorker
    DiscoverWorker & IngestWorker <--> YTData
    GoogleAuth <--> YTAnalytics
    YTAnalytics --> Neon
    CoreEngine <--> Neon
```

### Stack Details
* **Framework**: Next.js 16.4.2 (Turbopack, Partial Prerendering, Server Actions, React 19).
* **Language**: TypeScript 5 (Strict mode enabled across all server and client files).
* **Database**: Neon Serverless PostgreSQL (`@neondatabase/serverless` connection pooler over HTTP).
* **Styling**: Tailwind CSS v4, custom CSS token system with full dark/light glassmorphism.
* **Animations**: GSAP 3.15, `@gsap/react`, Lenis smooth scroll.
* **APIs**: YouTube Data API v3, YouTube Analytics API v2, Google OAuth 2.0.

---

## 📊 Live Database & Benchmark Performance

Scout runs against a live production Neon PostgreSQL database populated with **10,112+ curated YouTube channels** and tens of thousands of video uploads.

### Search Precision Benchmark (`scripts/benchmark.ts`)
Run against 39 real-world marketing briefs spanning tech, gaming, beauty, regional languages, and specific brand targets:

```
Search benchmark · 9,969 indexed creators
 100%  tech                                           503 fit
 100%  tech creators                                  503 fit
 100%  Hindi tech reviewers                           119 fit
 100%  Indian YouTube tech creators who review earbuds 135 fit
 100%  gaming creators but not bgmi                   414 fit
 100%  South Indian food bloggers                     114 fit
 100%  skincare routine creators                      286 fit
 100%  creators like Technical Guruji                 502 fit
 100%  cheap earphones                                503 fit
 100%  ernbuds review (typo tolerance)                503 fit
 100%  fitnes creators (typo tolerance)               249 fit
 100%  टेक रिव्यू हिंदी                               119 fit
 100%  குழந்தை பாடல்கள்                               135 fit
 100%  paisa kaise bachaye                            309 fit

Core precision@10: 98% over 39 briefs · 38 briefs at ≥80%
```

### Automated Unit Test Suite (`npm test`)
75 comprehensive unit tests covering all system mechanics:
* `tests/engine.test.ts`: Brief parsing, relevance thresholds, regional scripts, brand safety filters.
* `tests/metrics.test.ts`: Authenticity scoring, view medians, 90-day growth, language detection.
* `tests/mentions.test.ts`: Sponsorship disclosure recognition, brand term boundary matching.
* `tests/signals.test.ts`: Recency penalization, sponsorship density, topic separation.
* `tests/sov.test.ts`: Share of voice aggregation, date filtering, paid vs. earned segmentation.
* `tests/pricing.test.ts`: Tier calculations, currency rounding, zero-fee creator stance.

---

## 📁 Repository Structure

```
Proj.E/
├── LICENSE                        # MIT License
├── README.md                      # Project documentation (this file)
├── docs/                          # DECISIONS.md (build log), SCOUT_AUDIT_AND_GTM.* (audit & GTM)
├── concepts/                      # Parked features and backup-plan strategy docs
├── brand/                         # Logo source, build script, generated brand assets
├── videos/                        # Remotion projects: explainer/ (88 s film), launch/ (24 s)
├── legacy/                        # Original HTML prototypes (gitignored)
│
└── web/                           # Next.js Application Root
    ├── package.json               # Dependencies and build scripts
    ├── next.config.ts             # Turbopack & Next.js cache configurations
    ├── tsconfig.json              # Strict TypeScript compiler options
    │
    ├── src/
    │   ├── app/                   # App Router pages and API routes
    │   │   ├── page.tsx           # High-craft landing page & interactive widgets
    │   │   ├── demo/              # Interactive creator discovery engine demo
    │   │   ├── pricing/           # Transparent pricing tiers & ROI calculator
    │   │   ├── login/             # Dual-sided authentication (Brand & Creator)
    │   │   ├── onboarding/        # Role selection & profile completion flow
    │   │   ├── dashboard/         # Protected creator/brand command center
    │   │   │   ├── deals/         # Deal pipeline and offer negotiation board
    │   │   │   └── offers/        # Inbound and outbound offer creator
    │   │   ├── account/           # Account settings, connected channel management
    │   │   ├── privacy/           # YouTube API compliance & privacy policy
    │   │   ├── terms/             # Terms of service
    │   │   ├── contact-removal/   # Creator self-serve data removal page
    │   │   └── api/
    │   │       ├── auth/          # OAuth callbacks, signout, disconnect, account deletion
    │   │       ├── search/        # Server-side creator ranking & retrieval API
    │   │       ├── sov/           # Share of voice data endpoint
    │   │       ├── contact/       # Creator outreach request handler
    │   │       └── cron/          # Vercel cron endpoints for discover & nightly ingest
    │   │
    │   ├── lib/scout/             # Pure algorithmic modules & business logic
    │   │   ├── search.ts          # Search ranking orchestration & score compilation
    │   │   ├── brief.ts           # Natural language query tokenization & extraction
    │   │   ├── score.ts           # 8-signal scoring mathematics & weightings
    │   │   ├── topics.ts          # Title keyword extraction & IDF relevance
    │   │   ├── metrics.ts         # View distributions, growth derivatives, authenticity
    │   │   ├── sov.ts             # Regex-based brand share of voice processor
    │   │   ├── campaigns.ts       # Fair rate estimation formulas & ROI metrics
    │   │   └── deals.ts           # Turn-based offer state machine rules
    │   │
    │   └── server/                # Server-only database operations & API clients
    │       ├── db.ts              # Neon PostgreSQL serverless client
    │       ├── auth.ts            # Stateless signed cookie session manager
    │       ├── creators.ts        # Cached creator database queries
    │       ├── deals.ts           # Deal lifecycle mutations & queries
    │       ├── offers.ts          # Target creator search & brand profile cards
    │       ├── sov.ts             # Database query for 90-day video brand matches
    │       ├── ingest.ts          # YouTube API channel and video sync worker
    │       ├── discover.ts        # Autonomous search-based creator discovery
    │       └── google.ts          # OAuth exchange and YouTube Analytics API client
    │
    ├── tests/                     # Node.js native test runner test suite
    │   ├── engine.test.ts         # Query engine & brief parser test cases
    │   ├── metrics.test.ts        # Metrics derivation & authenticity verification
    │   ├── mentions.test.ts       # Brand mention & sponsorship parsing tests
    │   ├── signals.test.ts        # Behavioral & upload signal tests
    │   ├── sov.test.ts            # Share of voice aggregation tests
    │   └── pricing.test.ts        # Subscription and savings calculation tests
    │
    └── scripts/                   # Developer CLI tools & verification scripts
        ├── doctor.ts              # System health check (Database, YouTube API, Cron, Env)
        ├── benchmark.ts           # 39-brief precision & recall test runner
        ├── quality.ts             # Data consistency & batch anomaly detection
        ├── db-migrate.ts          # PostgreSQL table schemas and index creation
        └── discover.ts            # Manual discovery script for new niches
```

---

## 🛠️ Getting Started

### Prerequisites
* **Node.js**: v20.0.0 or higher
* **npm**: v10.0.0 or higher
* **PostgreSQL Database**: Neon serverless database or standard Postgres instance
* **Google Cloud Project**: With YouTube Data API v3 enabled (optional for mock testing, required for live ingest)

### 1. Clone & Install
```bash
git clone https://github.com/krrishp447-hub/Proj-E.git
cd Proj-E/web
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file inside the `web/` directory:

```env
# Public site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Neon / PostgreSQL connection string
DATABASE_URL=postgresql://user:password@host/neondb?sslmode=require

# Google Cloud YouTube Data API v3 Key
YOUTUBE_API_KEY=your_api_key_here

# Secret for securing cron endpoints
CRON_SECRET=your_random_43_char_string_here

# Auth session encryption secret
AUTH_SECRET=your_random_session_secret_here

# Google OAuth Credentials (for creator channel connection)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 3. Verify System Health (`doctor`)
Run the built-in diagnostic tool to test your database connectivity, table schema, YouTube quota, and environment keys:

```bash
npm run doctor
```

Output:
```text
Site
  ✓ NEXT_PUBLIC_SITE_URL = http://localhost:3000

Database
  ✓ connected to Neon serverless pooler
  ✓ all 12 tables present
  ✓ 10,112 creators ingested — the app shows live data

YouTube Data API
  ✓ key valid and YouTube Data API v3 enabled (1 quota unit used)

Cron
  ✓ CRON_SECRET configured

All set.
```

### 4. Run Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the homepage or [http://localhost:3000/demo](http://localhost:3000/demo) to test the live discovery engine.

---

## 🧪 Testing & Quality Assurance

```bash
# Run all 75 unit tests
npm test

# Run strict TypeScript verification
npm run typecheck

# Run Next.js and ESLint code checks
npm run lint

# Run precision search benchmark (39 real queries)
npm run benchmark

# Run data quality & anomaly detection checks
npm run quality
```

---

## 🌐 API Reference

### 1. Natural Language Creator Search
```http
GET /api/search?q={query}&ids={pinnedIds}
```
* **Parameters**:
  * `q` (string, max 300 chars): Plain-English or regional brief.
  * `ids` (comma-separated strings): Channel IDs to evaluate and pin against this brief.
* **Response**:
  ```json
  {
    "query": "earbuds",
    "understood": ["Tech", "earbud"],
    "total": 9969,
    "fitCount": 100,
    "medianScore": 64,
    "fits": [
      {
        "creator": {
          "channelId": "UC...",
          "name": "Mike O'Brien",
          "handle": "@mikeobrienn",
          "niche": "Tech",
          "language": "English",
          "subs": 663000,
          "views": 84586,
          "eng": 0.042
        },
        "score": 68,
        "signals": {
          "relevance": 92,
          "engagement": 85,
          "authenticity": 94
        }
      }
    ]
  }
  ```

### 2. Share of Voice (SOV)
```http
GET /api/sov
```
Returns live aggregated performance, video mention counts, and estimated views for monitored brand clusters over a 90-day window.

---

## 🥊 Competitor Matrix

| Capability | Scout | Modash | HypeAuditor | Qoruz / SARAL |
| :--- | :---: | :---: | :---: | :---: |
| **Search Mechanism** | **Natural Language Briefs** | Complex Filter Forms | Multi-step Dropdowns | Keyword Directory |
| **Regional Language NLP** | **Native (Hindi, Tamil, etc.)** | English Only | English Only | Basic Tagging |
| **Ranking Methodology** | **8-Signal Auditable IDF** | Follower Count / Filters | Vanity Metrics | Follower Sort |
| **First-Party Data** | **Direct YouTube OAuth** | Scraped Estimates | Scraped Estimates | Basic Connections |
| **Integrated Deal Board** | **Yes (Turn-based)** | No (Export to Sheets) | Enterprise Add-on | Basic CRM |
| **Transparent Pricing** | **Fixed, Zero-Commission** | Usage Tiers ($$$) | Enterprise Retainers | Annual Contracts |
| **Creator Protection** | **100% Free for Creators** | Hidden Behind Paywalls | Scraped without Consent | Scraped |

---

## 🔒 Security, Compliance & Privacy

* **YouTube API Compliance**: Scout fully complies with the [YouTube API Services Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service) and [Google Privacy Policy](https://policies.google.com/privacy).
* **Creator Rights & Data Removal**: Creators can disconnect their channel or request permanent removal of their contact data at any time via `/contact-removal` or through account settings.
* **Confidentiality**: Brand campaign briefs and budgets are strictly compartmentalized and never exposed to unauthorized parties.
* **No Selling of Personal Data**: Scout does not sell, broker, or syndicate creator personal information.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
