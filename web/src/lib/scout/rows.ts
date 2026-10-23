// A creators-table row → the Creator the engine and UI use. Shared by the server loader and scripts (benchmark).
import type { Creator } from "./data.ts";

export type CreatorRow = {
  channel_id: string; name: string; handle: string; country: string; niche: string; niche2: string | null; niche_conf: number; tags: string[];
  subs: number; avg_views: number; eng: number; growth: number; consistency: number; auth: number; suspicious: number;
  language: string; topics: string[] | null; age_days: number; upload_days: number | null; sponsored_pct: number | null; safety: string[] | null; claimed: boolean; has_email: boolean; trend: number[] | null;
  aud_age: number[] | null; aud_male: number | null; aud_geo: [string, number][] | null; // only for creators who connected their channel
};

/** Down-sample a daily series to at most 12 points for the sparkline. */
const twelve = (xs: number[]) => (xs.length <= 12 ? xs : Array.from({ length: 12 }, (_, i) => xs[Math.round((i * (xs.length - 1)) / 11)]));

export function rowToCreator(r: CreatorRow, id: number): Creator {
  return {
    id, // list position within one result set; channelId is the stable identity
    channelId: r.channel_id,
    name: r.name,
    handle: r.handle,
    platform: "YouTube",
    country: r.country,
    niche: r.niche,
    secondaryNiche: r.niche2,
    nicheConfidence: r.niche_conf,
    tags: r.tags,
    topics: r.topics ?? [],
    subs: r.subs,
    views: r.avg_views,
    eng: r.eng,
    growth: r.growth,
    consistency: r.consistency,
    // Audience demographics are private to the creator: present only once they connect their channel.
    geo: r.aud_geo ?? [],
    age: r.aud_age ?? [],
    male: r.aud_male,
    trend: twelve((r.trend ?? [r.subs]).map((s) => Math.round(s / 1000))),
    collabs: 0,
    language: r.language,
    auth: r.auth,
    suspicious: r.suspicious,
    campaigns: 0, // outcome data accrues from campaigns run on Scout
    repeat: 0,
    delivery: 0,
    proven: false,
    verifiedDays: r.age_days,
    lastUploadDays: r.upload_days,
    sponsoredPct: r.sponsored_pct,
    safety: r.safety ?? [],
    claimed: r.claimed,
    hasEmail: r.has_email,
    source: "youtube",
  };
}
