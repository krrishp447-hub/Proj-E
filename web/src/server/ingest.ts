import "server-only";
import { deriveMetrics, type Snapshot } from "@/lib/scout/metrics";
import { sql } from "./db";
import { fetchChannels, fetchRecentVideos } from "./youtube";

export type IngestResult = { seeds: number; updated: number; failed: { channelId: string; error: string }[]; quotaUnits: number };

/**
 * Refresh every seeded channel: pull public stats + recent uploads, derive Scout signals,
 * upsert the creator row and record today's subscriber snapshot.
 * ~2 quota units per channel + 1 per 50 channels, so 1,000 channels ≈ 2,020 of the 10,000 daily units.
 */
export async function runIngest(limit = 1000): Promise<IngestResult> {
  if (!sql) throw new Error("DATABASE_URL is not set");
  const seeds = (await sql`select channel_id from channel_seeds order by added_at limit ${limit}`) as { channel_id: string }[];
  const ids = seeds.map((s) => s.channel_id);
  const result: IngestResult = { seeds: ids.length, updated: 0, failed: [], quotaUnits: Math.ceil(ids.length / 50) };
  if (!ids.length) return result;

  const channels = await fetchChannels(ids);
  const history = (await sql`
    select channel_id, taken_on::text as taken_on, subs from snapshots
    where channel_id = any(${ids}) and taken_on > current_date - 130`) as { channel_id: string; taken_on: string; subs: number }[];

  for (const ch of channels) {
    try {
      const recent = await fetchRecentVideos(ch.contentDetails.relatedPlaylists.uploads);
      result.quotaUnits += 2;
      const snaps: Snapshot[] = history.filter((h) => h.channel_id === ch.id).map((h) => ({ takenOn: h.taken_on, subs: h.subs }));
      const m = deriveMetrics(ch, recent, snaps);
      await sql`
        insert into creators (channel_id, name, handle, country, niche, tags, subs, avg_views, eng, growth, consistency, auth, suspicious, fetched_at)
        values (${m.channelId}, ${m.name}, ${m.handle}, ${m.country}, ${m.niche}, ${m.tags}, ${m.subs}, ${m.avgViews}, ${m.eng}, ${m.growth}, ${m.consistency}, ${m.auth}, ${m.suspicious}, now())
        on conflict (channel_id) do update set
          name = excluded.name, handle = excluded.handle, country = excluded.country, niche = excluded.niche, tags = excluded.tags,
          subs = excluded.subs, avg_views = excluded.avg_views, eng = excluded.eng, growth = excluded.growth,
          consistency = excluded.consistency, auth = excluded.auth, suspicious = excluded.suspicious, fetched_at = now()`;
      await sql`
        insert into snapshots (channel_id, taken_on, subs) values (${m.channelId}, current_date, ${m.subs})
        on conflict (channel_id, taken_on) do update set subs = excluded.subs`;
      result.updated++;
    } catch (e) {
      result.failed.push({ channelId: ch.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}
