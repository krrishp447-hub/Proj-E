import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Creator } from "@/lib/scout/data";
import { sql } from "./db";

type Row = {
  channel_id: string; name: string; handle: string; country: string; niche: string; tags: string[];
  subs: number; avg_views: number; eng: number; growth: number; consistency: number; auth: number; suspicious: number;
  language: string; age_days: number; trend: number[] | null;
  aud_age: number[] | null; aud_male: number | null; aud_geo: [string, number][] | null; // only for creators who connected their channel
};

/** Down-sample a daily series to at most 12 points for the sparkline. */
const twelve = (xs: number[]) => (xs.length <= 12 ? xs : Array.from({ length: 12 }, (_, i) => xs[Math.round((i * (xs.length - 1)) / 11)]));

export type CreatorSource = { creators: Creator[]; source: "youtube" | "none"; updatedAt: string | null };

/**
 * Every view reads creators through here. Live YouTube data when DATABASE_URL is set and ingest has run;
 * otherwise an empty list (views show an empty state until the first ingest). Cached; the ingest cron revalidates the tag.
 */
export async function getCreators(): Promise<CreatorSource> {
  "use cache";
  cacheTag("creators");
  cacheLife("hours");
  if (!sql) return { creators: [], source: "none", updatedAt: null };

  const rows = (await sql`
    select c.*, extract(day from now() - c.fetched_at)::int as age_days,
      (select array_agg(s.subs order by s.taken_on) from snapshots s where s.channel_id = c.channel_id and s.taken_on > current_date - 365) as trend,
      cc.age as aud_age, cc.male as aud_male, cc.geo as aud_geo
    from creators c left join channel_connections cc using (channel_id)
    where not c.is_brand order by c.subs desc limit 2000`) as Row[];
  if (!rows.length) return { creators: [], source: "none", updatedAt: null };

  const creators: Creator[] = rows.map((r, id) => ({
    id, // array index — the UI looks creators up by position
    channelId: r.channel_id,
    name: r.name,
    handle: r.handle,
    platform: "YouTube",
    country: r.country,
    niche: r.niche,
    tags: r.tags,
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
    source: "youtube",
  }));
  return { creators, source: "youtube", updatedAt: new Date().toISOString() };
}
