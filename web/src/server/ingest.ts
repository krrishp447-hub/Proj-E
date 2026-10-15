import "server-only";
import { deriveMetrics, type Snapshot } from "@/lib/scout/metrics";
import { fileCampaignPosts, saveVideos, type FilingResult } from "./campaigns";
import { sql } from "./db";
import { fetchChannels, fetchRecentVideos } from "./youtube";

export type IngestResult = { seeds: number; updated: number; failed: { channelId: string; error: string }[]; quotaUnits: number; filing?: FilingResult };

/**
 * Refresh every seeded channel: pull public stats + recent uploads, derive Scout signals,
 * upsert the creator row and record today's subscriber snapshot, store recent uploads with today's stats,
 * then file new posts into live campaigns.
 * ~2 quota units per channel + 1 per 50 channels, so 1,000 channels ≈ 2,020 of the 10,000 daily units.
 */
const PRUNE_BELOW_SUBS = 5_000; // half the search floor (MIN_AUDIENCE), so channels near it still get tracked

export async function runIngest(limit = 1000, only?: string[]): Promise<IngestResult> {
  if (!sql) throw new Error("DATABASE_URL is not set");
  const db = sql; // keeps the non-null narrowing inside the parallel workers below
  // `only`: refresh exactly these channels now (a creator just connected). Otherwise stalest first, skipping
  // channels refreshed in the last 20h: re-runs only spend quota on new seeds, and consecutive runs rotate through them.
  const seeds = only ? only.map((channel_id) => ({ channel_id })) : (await db`
    select s.channel_id from channel_seeds s left join creators c using (channel_id)
    where s.active and (c.fetched_at is null or c.fetched_at < now() - interval '20 hours')
    order by c.fetched_at nulls first, s.added_at limit ${limit}`) as { channel_id: string }[];
  const ids = seeds.map((s) => s.channel_id);
  const result: IngestResult = { seeds: ids.length, updated: 0, failed: [], quotaUnits: Math.ceil(ids.length / 50) };
  if (!ids.length) return result;

  const channels = await fetchChannels(ids);
  const history = (await db`
    select channel_id, taken_on::text as taken_on, subs from snapshots
    where channel_id = any(${ids}) and taken_on > current_date - 130`) as { channel_id: string; taken_on: string; subs: number }[];

  const one = async (ch: (typeof channels)[number]) => {
    try {
      const recent = await fetchRecentVideos(ch.contentDetails.relatedPlaylists.uploads);
      result.quotaUnits += 2;
      const snaps: Snapshot[] = history.filter((h) => h.channel_id === ch.id).map((h) => ({ takenOn: h.taken_on, subs: h.subs }));
      const m = deriveMetrics(ch, recent, snaps);
      await db`
        insert into creators (channel_id, name, handle, country, niche, tags, subs, avg_views, eng, growth, consistency, auth, suspicious, language, is_brand, fetched_at)
        values (${m.channelId}, ${m.name}, ${m.handle}, ${m.country}, ${m.niche}, ${m.tags}, ${m.subs}, ${m.avgViews}, ${m.eng}, ${m.growth}, ${m.consistency}, ${m.auth}, ${m.suspicious}, ${m.language}, ${m.isBrand}, now())
        on conflict (channel_id) do update set
          name = excluded.name, handle = excluded.handle, country = excluded.country, niche = excluded.niche, tags = excluded.tags,
          subs = excluded.subs, avg_views = excluded.avg_views, eng = excluded.eng, growth = excluded.growth,
          consistency = excluded.consistency, auth = excluded.auth, suspicious = excluded.suspicious,
          language = excluded.language, is_brand = excluded.is_brand, fetched_at = now()`;
      await db`
        insert into snapshots (channel_id, taken_on, subs) values (${m.channelId}, current_date, ${m.subs})
        on conflict (channel_id, taken_on) do update set subs = excluded.subs`;
      await saveVideos(db, ch.id, recent); // after the creator row exists (videos → creators FK)
      result.updated++;
    } catch (e) {
      result.failed.push({ channelId: ch.id, error: e instanceof Error ? e.message : String(e) });
    }
  };
  // ponytail: fixed pool of 8; raise it (or move to a queue) if channel counts outgrow one 300s cron run
  for (let i = 0; i < channels.length; i += 8) await Promise.all(channels.slice(i, i + 8).map(one));
  // Prune: tiny channels and ones with no upload in 90 days stop being refreshed (their row stays, frozen).
  // Creators who claimed their channel, or are in a campaign or deal, are always kept.
  await db`
    update channel_seeds s set active = false from creators c
    where c.channel_id = s.channel_id and s.channel_id = any(${ids}) and (c.subs < ${PRUNE_BELOW_SUBS} or c.consistency = 0)
      and not exists (select 1 from channel_connections x where x.channel_id = c.channel_id)
      and not exists (select 1 from campaign_creators cc where cc.channel_id = c.channel_id)
      and not exists (select 1 from deals d where d.channel_id = c.channel_id)`;
  result.filing = await fileCampaignPosts();
  return result;
}
