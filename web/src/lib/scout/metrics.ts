// Pure transforms: YouTube Data API v3 payloads → Scout signals. No I/O, so it is unit-tested directly.
import { NICHES } from "./data.ts";
import { KEYWORDS, SYNONYMS } from "./engine.ts";

/** The subset of a `channels.list` item we request (part=snippet,statistics,contentDetails,brandingSettings). */
export type YtChannel = {
  id: string;
  snippet: { title: string; description?: string; customUrl?: string; country?: string };
  statistics: { subscriberCount?: string; videoCount?: string; viewCount?: string; hiddenSubscriberCount?: boolean };
  contentDetails: { relatedPlaylists: { uploads: string } };
  brandingSettings?: { channel?: { keywords?: string } };
};

/** The subset of a `videos.list` item we request (part=snippet,statistics). */
export type YtVideo = {
  snippet: { title: string; description?: string; tags?: string[]; publishedAt: string };
  statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
};

export type Snapshot = { takenOn: string; subs: number }; // ISO date

export type ChannelMetrics = {
  channelId: string;
  name: string;
  handle: string;
  country: string;
  niche: string;
  tags: string[];
  subs: number;
  avgViews: number;
  eng: number; // %
  growth: number; // % over ~90 days, 0 until history exists
  consistency: number; // 0–100
  auth: number; // estimated
  suspicious: number; // estimated %
};

const COUNTRY: Record<string, string> = { IN: "India", US: "US", GB: "UK", AE: "UAE" };
const n = (s?: string) => Number(s ?? 0) || 0;
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Niche + sub-niche tags from what the channel actually publishes (titles, descriptions, tags, channel keywords). */
export function classify(text: string): { niche: string; tags: string[] } {
  const t = text.toLowerCase();
  const hits = (words: string[]) => words.reduce((k, w) => k + (t.match(new RegExp(`\\b${w}`, "g"))?.length ?? 0), 0);
  let best = { niche: "Other", score: 0 };
  for (const nn of NICHES) {
    const score = hits([nn.toLowerCase(), ...(SYNONYMS[nn] ?? [])]);
    if (score > best.score) best = { niche: nn, score };
  }
  return { niche: best.niche, tags: KEYWORDS.filter((k) => new RegExp(`\\b${k}`).test(t)) };
}

/** 90-day growth from stored daily snapshots; 0 until ~30 days of history exist (no history → no claim). */
export function growthFrom(snaps: Snapshot[], subsNow: number, today: Date): number {
  const DAY = 86_400_000;
  const old = snaps
    .map((s) => ({ ...s, age: (today.getTime() - new Date(s.takenOn).getTime()) / DAY }))
    .filter((s) => s.age >= 30 && s.age <= 120 && s.subs > 0)
    .sort((a, b) => Math.abs(a.age - 90) - Math.abs(b.age - 90))[0];
  return old ? Math.round(((subsNow - old.subs) / old.subs) * 1000) / 10 : 0;
}

/**
 * Authenticity is an estimate from public signals: healthy engagement and a plausible views-to-subscribers
 * ratio score high; near-zero engagement or views far below the subscriber base suggest bought followers.
 */
export function estimateAuthenticity(eng: number, avgViews: number, subs: number): number {
  let a = 72;
  if (eng >= 2 && eng <= 15) a += 12;
  else if (eng < 0.8) a -= 18;
  else if (eng > 25) a -= 10;
  const ratio = subs ? avgViews / subs : 0;
  if (ratio >= 0.05 && ratio <= 0.8) a += 8;
  else if (ratio < 0.01) a -= 15;
  return clamp(Math.round(a), 40, 95);
}

export function deriveMetrics(ch: YtChannel, recent: YtVideo[], snaps: Snapshot[], today = new Date()): ChannelMetrics {
  const subs = n(ch.statistics.subscriberCount);
  const views = recent.map((v) => n(v.statistics.viewCount)).filter((v) => v > 0);
  const avgViews = Math.round(median(views));
  const engs = recent
    .filter((v) => n(v.statistics.viewCount) > 0)
    .map((v) => ((n(v.statistics.likeCount) + n(v.statistics.commentCount)) / n(v.statistics.viewCount)) * 100);
  const eng = Math.round(median(engs) * 10) / 10;

  // posting consistency: uploads in the last 90 days vs. a weekly cadence (≈13 uploads = 100)
  const recent90 = recent.filter((v) => today.getTime() - new Date(v.snippet.publishedAt).getTime() <= 90 * 86_400_000).length;
  const consistency = clamp(Math.round((recent90 / 13) * 100), 0, 100);

  const corpus = [
    ch.snippet.title,
    ch.snippet.description,
    ch.brandingSettings?.channel?.keywords,
    ...recent.flatMap((v) => [v.snippet.title, v.snippet.description?.slice(0, 300), ...(v.snippet.tags ?? [])]),
  ].join(" ");
  const { niche, tags } = classify(corpus);
  const auth = estimateAuthenticity(eng, avgViews, subs);

  return {
    channelId: ch.id,
    name: ch.snippet.title,
    handle: ch.snippet.customUrl ?? ch.id,
    country: COUNTRY[ch.snippet.country ?? ""] ?? ch.snippet.country ?? "Unknown",
    niche,
    tags,
    subs,
    avgViews,
    eng,
    growth: growthFrom(snaps, subs, today),
    consistency,
    auth,
    suspicious: Math.max(1, Math.round((100 - auth) * 0.4)),
  };
}
