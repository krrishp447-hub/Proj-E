// Illustrative campaign data for the Campaigns and Share of voice tabs. Brands and creators are fictional,
// and live separately from the real creator list, until brands run real campaigns on Scout.
import type { Campaign, Deliverable, VideoPost } from "./campaigns.ts";

/** Names of the fictional creators referenced by `creatorId` below. */
export const DEMO_CREATOR_NAMES: Record<number, string> = {
  0: "Tech With Arjun", 1: "GadgetGirl Priya", 2: "AudioPhile Akash", 3: "Rohit Reviews", 4: "Neha Unboxed",
  6: "EarbudExpert", 11: "Kiran Tech Tamil", 13: "TechSavvy Sam",
};

export const DEMO_TODAY = "2026-10-14";

/** Cumulative views per day since publish, ending at `views` today (fast early growth, then a long tail). */
function curve(views: number, publishedAt: string): number[] {
  const days = Math.max(1, Math.round((new Date(DEMO_TODAY).getTime() - new Date(publishedAt.slice(0, 10)).getTime()) / 86_400_000) + 1);
  const raw = Array.from({ length: days }, (_, k) => 1 - Math.exp(-(k + 1) / 2.5));
  return raw.map((r) => Math.round((r / raw[raw.length - 1]) * views));
}

type Seed = Omit<VideoPost, "daily" | "url">;
const seeds: Seed[] = [
  // Buds X campaign — contracted creators
  { id: "v1", creatorId: 0, platform: "YouTube", title: "Kestrel Buds X review — the ₹2,999 ANC king?", description: "Get it: kestrel.audio/budsx?ref=arjun #KestrelBudsX #ad", publishedAt: "2026-10-02T12:30:00Z", views: 186_000, likes: 9_100, comments: 1_400 },
  { id: "v2", creatorId: 1, platform: "YouTube", title: "I tested Buds X for 7 days", description: "Thanks @kestrelaudio for partnering on this one. #KestrelBudsX #sponsored", publishedAt: "2026-10-05T11:00:00Z", views: 98_000, likes: 6_200, comments: 900 },
  { id: "v3", creatorId: 2, platform: "YouTube", title: "Buds X: drivers, codecs & latency deep-dive", description: "Review unit from @kestrelaudio. Measurements in the pinned comment.", publishedAt: "2026-10-08T14:00:00Z", views: 39_000, likes: 2_900, comments: 610 },
  { id: "v4", creatorId: 6, platform: "YouTube", title: "Kestrel Buds X vs Ripple Air 3 — ANC shootout", description: "Buds X: kestrel.audio/budsx?ref=ee #KestrelBudsX #ad", publishedAt: "2026-10-09T10:00:00Z", views: 84_000, likes: 6_800, comments: 1_500 },
  { id: "v5", creatorId: 4, platform: "YouTube", title: "Unboxing the new Buds X ✨ #shorts", description: "#KestrelBudsX #ad", publishedAt: "2026-10-11T08:00:00Z", views: 132_000, likes: 11_800, comments: 420 },
  // Organic: uncontracted creator names the product
  { id: "v6", creatorId: 3, platform: "YouTube", title: "Top 5 earbuds under ₹3000 (Kestrel Buds X, Ripple Air 3…)", description: "Not sponsored. Prices as of today.", publishedAt: "2026-10-10T09:00:00Z", views: 210_000, likes: 8_400, comments: 1_900 },
  // Unrelated upload by a contracted creator — must not be filed
  { id: "v7", creatorId: 11, platform: "YouTube", title: "Best budget phone in Tamil — October", description: "Phones under ₹15,000", publishedAt: "2026-10-07T06:00:00Z", views: 61_000, likes: 4_900, comments: 700 },
  // Competitor coverage (share of voice)
  { id: "v8", creatorId: 13, platform: "YouTube", title: "Ripple Air 3 long-term review", description: "Three months with the Ripple Air 3.", publishedAt: "2026-10-03T16:00:00Z", views: 120_000, likes: 5_200, comments: 800 },
  { id: "v9", creatorId: 1, platform: "YouTube", title: "Tusker Pods Pro unboxing", description: "First look at Tusker's new pods", publishedAt: "2026-09-29T11:00:00Z", views: 64_000, likes: 3_900, comments: 500 },
  { id: "v10", creatorId: 0, platform: "YouTube", title: "Orbitron Bass 2 — skip it?", description: "Honest take on the Orbitron Bass 2", publishedAt: "2026-10-06T12:00:00Z", views: 51_000, likes: 2_400, comments: 610 },
  { id: "v11", creatorId: 4, platform: "YouTube", title: "Ripple Air 3 in 30 seconds #shorts", description: "@rippleacoustics #ad", publishedAt: "2026-10-04T08:00:00Z", views: 90_000, likes: 7_100, comments: 300 },
  { id: "v12", creatorId: 6, platform: "YouTube", title: "Best ANC under 5K: Kestrel vs Tusker vs Ripple", description: "Ranked after 40 hours of testing", publishedAt: "2026-09-28T10:00:00Z", views: 77_000, likes: 5_600, comments: 1_100 },
];
export const DEMO_VIDEOS: VideoPost[] = seeds.map((s) => ({
  ...s,
  url: s.platform === "YouTube" ? `https://youtube.com/watch?v=${s.id}` : `https://instagram.com/reel/${s.id}`,
  daily: curve(s.views, s.publishedAt),
}));

export const DEMO_CAMPAIGNS: Campaign[] = [
  {
    id: "budsx", brand: "Kestrel Audio", name: "Buds X launch", status: "Live", start: "2026-09-25", end: "2026-10-31",
    rules: { hashtags: ["#KestrelBudsX"], links: ["kestrel.audio/budsx"], mentions: ["@kestrelaudio"], keywords: ["Kestrel Buds X", "Buds X"] },
    creatorIds: [0, 1, 2, 6, 4, 11],
  },
  {
    id: "festive", brand: "Kestrel Audio", name: "Festive sale push", status: "Planned", start: "2026-10-20", end: "2026-11-10",
    rules: { hashtags: ["#KestrelFestive"], links: ["kestrel.audio/festive"], mentions: ["@kestrelaudio"], keywords: ["Kestrel festive"] },
    creatorIds: [0, 3],
  },
];

/** Competitor set for share of voice (terms matched in titles/descriptions). */
export const SOV_BRANDS: Record<string, string[]> = {
  "Kestrel Audio": ["kestrel", "buds x"],
  "Ripple Acoustics": ["ripple"],
  "Tusker Sound": ["tusker"],
  Orbitron: ["orbitron"],
};

const D = (p: Partial<Deliverable> & Pick<Deliverable, "id" | "dealId" | "creatorId" | "due" | "status" | "projectedViews" | "fee">): Deliverable => ({ kind: "YouTube video", campaignId: "budsx", ...p });
export const DEMO_DELIVERABLES: Deliverable[] = [
  D({ id: "d1", dealId: "deal-arjun", creatorId: 0, due: "2026-10-02", status: "Live", videoId: "v1", projectedViews: 150_000, fee: 85_000 }),
  D({ id: "d2", dealId: "deal-arjun", creatorId: 0, kind: "YouTube Short", due: "2026-10-12", status: "In production", projectedViews: 60_000, fee: 0 }),
  D({ id: "d3", dealId: "deal-priya", creatorId: 1, due: "2026-10-05", status: "Live", videoId: "v2", projectedViews: 90_000, fee: 60_000 }),
  D({ id: "d4", dealId: "deal-akash", creatorId: 2, due: "2026-10-06", status: "Live", videoId: "v3", projectedViews: 40_000, fee: 30_000 }),
  D({ id: "d5", dealId: "deal-ee", creatorId: 6, due: "2026-10-09", status: "Live", videoId: "v4", projectedViews: 70_000, fee: 55_000 }),
  D({ id: "d6", dealId: "deal-neha", creatorId: 4, kind: "YouTube Short", due: "2026-10-10", status: "Live", videoId: "v5", projectedViews: 110_000, fee: 65_000 }),
  D({ id: "d7", dealId: "deal-kiran", creatorId: 11, due: "2026-10-18", status: "In production", projectedViews: 55_000, fee: 40_000 }),
];

