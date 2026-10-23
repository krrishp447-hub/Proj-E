import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { NICHES, type Creator } from "@/lib/scout/data";
import { sql } from "./db";

type Row = {
  channel_id: string; name: string; handle: string; country: string; niche: string; niche2: string | null; niche_conf: number; tags: string[];
  subs: number; avg_views: number; eng: number; growth: number; consistency: number; auth: number; suspicious: number;
  language: string; topics: string[] | null; age_days: number; trend: number[] | null;
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
    where not c.is_brand order by c.subs desc limit 5000`) as Row[]; // discovery stops at ~4,000 active channels
  if (!rows.length) return { creators: [], source: "none", updatedAt: null };

  const creators: Creator[] = rows.map((r, id) => ({
    id, // array index — the UI looks creators up by position
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
    source: "youtube",
  }));
  return { creators, source: "youtube", updatedAt: new Date().toISOString() };
}

/**
 * The homepage's interactive widgets get a small representative sample, not every creator: serialising ~5,000
 * creators into each of three client widgets made the homepage 3.4 MB. The strongest creators per niche (≥50K subs),
 * plus extra 50K–500K Tech creators for the funnel's sample brief. Ids are re-indexed (the UI looks up by position).
 */
export async function getHomeCreators(): Promise<CreatorSource & { total: number }> {
  const all = await getCreators();
  const quality = (c: Creator) => c.eng * Math.log10(c.views + 10);
  const pool = all.creators.filter((c) => c.subs >= 50_000 && c.views > 0).sort((a, b) => quality(b) - quality(a));
  const picked = new Map<string, Creator>();
  for (const n of NICHES) pool.filter((c) => c.niche === n).slice(0, 6).forEach((c) => picked.set(c.channelId, c));
  pool.filter((c) => c.niche === "Tech" && c.subs <= 500_000).slice(0, 30).forEach((c) => picked.set(c.channelId, c));
  const creators = [...picked.values()].map((c, id) => ({ ...c, id }));
  return { ...all, creators, total: all.creators.length };
}
