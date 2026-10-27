import "server-only";
import { deriveMetrics, type Snapshot } from "@/lib/scout/metrics";
import { publicEmail } from "@/lib/scout/contact";
import { safetyFlags, sponsoredShare } from "@/lib/scout/signals";
import { fileCampaignPosts, saveVideos, type FilingResult } from "./campaigns";
import { sql } from "./db";
import { fetchChannels, fetchRecentVideos, isQuotaError } from "./youtube";

export type IngestResult = { seeds: number; updated: number; failed: { channelId: string; error: string }[]; quotaUnits: number; quotaExhausted?: boolean; filing?: FilingResult;
  frozen?: { refreshed: number; removed: number } }; // the 30-day rotation for channels outside the nightly refresh

/**
 * Refresh every seeded channel: pull public stats + recent uploads, derive ScoutBlack signals,
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
  if (channels.quotaExhausted) result.quotaExhausted = true;
  const history = (await db`
    select channel_id, taken_on::text as taken_on, subs from snapshots
    where channel_id = any(${ids}) and taken_on > current_date - 130`) as { channel_id: string; taken_on: string; subs: number }[];

  const one = async (ch: (typeof channels)[number]) => {
    if (result.quotaExhausted) return; // out of quota: leave the rest for the next run (stalest-first picks them up)
    try {
      const recent = await fetchRecentVideos(ch.contentDetails.relatedPlaylists.uploads);
      result.quotaUnits += 2;
      const snaps: Snapshot[] = history.filter((h) => h.channel_id === ch.id).map((h) => ({ takenOn: h.taken_on, subs: h.subs }));
      const m = deriveMetrics(ch, recent, snaps);
      // kept so categorisation can be re-run later from stored data, without spending API quota
      const uploads = recent.map((v) => ({ title: v.snippet.title, description: v.snippet.description, publishedAt: v.snippet.publishedAt }));
      const lastUpload = uploads.length ? uploads.map((u) => u.publishedAt).sort().at(-1)! : null;
      const about = [ch.snippet.description ?? "", ch.brandingSettings?.channel?.keywords ?? ""].join("\n").slice(0, 1500);
      await db`
        insert into creators (channel_id, name, handle, country, niche, niche2, niche_conf, tags, subs, avg_views, eng, growth, consistency, auth, suspicious, language, is_brand, topics, about, last_upload, sponsored_pct, safety, public_email, yt_topics, fetched_at)
        values (${m.channelId}, ${m.name}, ${m.handle}, ${m.country}, ${m.niche}, ${m.secondaryNiche}, ${m.nicheConfidence}, ${m.tags}, ${m.subs}, ${m.avgViews}, ${m.eng}, ${m.growth}, ${m.consistency}, ${m.auth}, ${m.suspicious}, ${m.language}, ${m.isBrand}, ${m.topics}, ${about}, ${lastUpload}, ${sponsoredShare(uploads)}, ${safetyFlags(uploads.map((u) => u.title))},
          (select case when exists (select 1 from contact_optouts o where o.channel_id = ${m.channelId}) then null else ${publicEmail([about, ...uploads.map((u) => u.description ?? "")])}::text end), ${ch.topicDetails?.topicCategories ?? []}, now())
        on conflict (channel_id) do update set
          name = excluded.name, handle = excluded.handle, country = excluded.country, niche = excluded.niche, niche2 = excluded.niche2, niche_conf = excluded.niche_conf, tags = excluded.tags,
          subs = excluded.subs, avg_views = excluded.avg_views, eng = excluded.eng, growth = excluded.growth,
          consistency = excluded.consistency, auth = excluded.auth, suspicious = excluded.suspicious,
          language = excluded.language, is_brand = excluded.is_brand, topics = excluded.topics, about = excluded.about,
          last_upload = excluded.last_upload, sponsored_pct = excluded.sponsored_pct, safety = excluded.safety, public_email = excluded.public_email, yt_topics = excluded.yt_topics, fetched_at = now()`;
      await db`
        insert into snapshots (channel_id, taken_on, subs) values (${m.channelId}, current_date, ${m.subs})
        on conflict (channel_id, taken_on) do update set subs = excluded.subs`;
      await saveVideos(db, ch.id, recent); // after the creator row exists (videos → creators FK)
      result.updated++;
    } catch (e) {
      if (isQuotaError(e)) { result.quotaExhausted = true; return; }
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
  if (!only && !result.quotaExhausted) {
    const frozen = await refreshFrozen(db);
    result.frozen = { refreshed: frozen.refreshed, removed: frozen.removed };
    result.quotaUnits += frozen.quotaUnits;
  }
  await trimStorage(db);
  result.filing = await fileCampaignPosts();
  return result;
}

// YouTube API policy: data fetched through the API is refreshed or deleted within 30 days. Active channels are refreshed
// nightly; frozen ones (pruned from the nightly refresh) get a channel-only refresh once they're 21 days old: 1 quota
// unit per 50 channels, ~330 a night (~7 units) keeps all ~7K under 30 days.
export const FRESH_DAYS = 30;
const FROZEN_REFRESH_AFTER_DAYS = 21;
const FROZEN_PER_RUN = 500; // ≤ 10 units a pass

/** Refresh the oldest frozen channels' public stats; delete the ones YouTube no longer returns (deleted, private, hidden subs). */
async function refreshFrozen(db: NonNullable<typeof sql>): Promise<{ refreshed: number; removed: number; quotaUnits: number }> {
  const ids = ((await db`
    select c.channel_id from creators c left join channel_seeds s using (channel_id)
    where not coalesce(s.active, false) and c.fetched_at < now() - make_interval(days => ${FROZEN_REFRESH_AFTER_DAYS})
    order by c.fetched_at limit ${FROZEN_PER_RUN}`) as { channel_id: string }[]).map((r) => r.channel_id);
  if (!ids.length) return { refreshed: 0, removed: 0, quotaUnits: 0 };
  const chs = await fetchChannels(ids);
  if (chs.length) {
    const col = <T,>(f: (c: (typeof chs)[number]) => T) => chs.map(f);
    await db`
      update creators c set name = z.name, subs = z.subs, about = z.about, yt_topics = string_to_array(z.topics, '|'), fetched_at = now()
      from unnest(${col((c) => c.id)}::text[], ${col((c) => c.snippet.title)}::text[], ${col((c) => Number(c.statistics.subscriberCount ?? 0))}::int[],
        ${col((c) => [c.snippet.description ?? "", c.brandingSettings?.channel?.keywords ?? ""].join("\n").slice(0, 1500))}::text[],
        ${col((c) => (c.topicDetails?.topicCategories ?? []).join("|"))}::text[]) as z(id, name, subs, about, topics)
      where c.channel_id = z.id`;
    // channels pruned for size that have since grown rejoin the nightly refresh (which re-prunes them if needed)
    await db`
      update channel_seeds s set active = true from creators c
      where c.channel_id = s.channel_id and s.channel_id = any(${chs.map((c) => c.id)}) and c.subs >= ${PRUNE_BELOW_SUBS} and c.consistency > 0`;
  }
  // Only when the whole lookup ran: a quota cut-off isn't "YouTube says it's gone". Claimed, campaign and deal channels stay.
  const gone = chs.quotaExhausted ? [] : ids.filter((id) => !chs.some((c) => c.id === id));
  const removed = gone.length ? ((await db`
    delete from creators c where c.channel_id = any(${gone})
      and not exists (select 1 from channel_connections x where x.channel_id = c.channel_id)
      and not exists (select 1 from campaign_creators cc where cc.channel_id = c.channel_id)
      and not exists (select 1 from deals d where d.channel_id = c.channel_id)
    returning c.channel_id`) as unknown[]).length : 0;
  return { refreshed: chs.length, removed, quotaUnits: Math.ceil(ids.length / 50) };
}

/**
 * Keep stored YouTube data under 30 days old (the API policy) and the database inside Neon's free 0.5 GB, in one rule:
 * a video row not re-fetched for 30 days is deleted. Active channels' latest uploads are re-fetched nightly, so only
 * older uploads and frozen channels' videos expire; campaign and deliverable videos (the brand's record) are kept.
 * Search doesn't need them: each creator's topics, niche and averages are stored on the creator row. Per-video daily
 * stats go after 30 days too, and frozen channels' descriptions are cleared (only mentions and filing use them).
 */
async function trimStorage(db: NonNullable<typeof sql>) {
  await db`
    delete from video_snapshots s where s.taken_on < current_date - ${FRESH_DAYS}::int
      and not exists (select 1 from campaign_posts p where p.video_id = s.video_id)
      and not exists (select 1 from deliverables d where d.video_id = s.video_id)`;
  await db`
    update videos v set description = '' from channel_seeds s
    where s.channel_id = v.channel_id and not s.active and v.description <> ''`;
  await db`
    delete from videos v where v.fetched_at < now() - make_interval(days => ${FRESH_DAYS})
      and not exists (select 1 from campaign_posts p where p.video_id = v.video_id)
      and not exists (select 1 from deliverables d where d.video_id = v.video_id)`;
}
