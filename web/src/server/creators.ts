import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { NICHES, type Creator } from "@/lib/scout/data";
import { rowToCreator, type CreatorRow } from "@/lib/scout/rows";
import { sql } from "./db";

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
    select c.*, extract(day from now() - c.fetched_at)::int as age_days, extract(day from now() - c.last_upload)::int as upload_days,
      cc.channel_id is not null as claimed, c.public_email is not null as has_email,
      (select array_agg(s.subs order by s.taken_on) from snapshots s where s.channel_id = c.channel_id and s.taken_on > current_date - 365) as trend,
      cc.age as aud_age, cc.male as aud_male, cc.geo as aud_geo
    from creators c left join channel_connections cc using (channel_id)
    where not c.is_brand order by c.subs desc`) as CreatorRow[]; // every creator: search runs on the server now
  if (!rows.length) return { creators: [], source: "none", updatedAt: null };

  const creators: Creator[] = rows.map(rowToCreator);
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
