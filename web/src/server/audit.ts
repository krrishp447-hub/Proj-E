// Runs the data-quality audit (lib/scout/audit.ts) on every 100 newly added creators and records the result.
// Takes the database client as a parameter (no "server-only" import) so `npm run quality` can run it too.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { GOLDEN, auditBatch, type AuditRow, type Check } from "../lib/scout/audit.ts";
import { LATEST_UPLOADS } from "../lib/scout/metrics.ts"; // relative: also run by scripts/quality.ts outside Next

type Db = NeonQueryFunction<false, false>;
export type AuditResult = { from: number; to: number; passed: boolean; checks: Check[] };
const BATCH = 100;

async function loadBatch(db: Db, offset: number, limit: number): Promise<AuditRow[]> {
  const creators = (await db`
    select channel_id, name, about, niche, niche2, niche_conf, language, subs, avg_views, eng, auth, suspicious, consistency, fetched_at, yt_topics
    from creators order by created_at, channel_id offset ${offset} limit ${limit}`) as {
    channel_id: string; name: string; about: string; niche: string; niche2: string | null; niche_conf: number; language: string;
    subs: number; avg_views: number; eng: number; auth: number; suspicious: number; consistency: number; fetched_at: string; yt_topics: string[];
  }[];
  const ids = creators.map((c) => c.channel_id);
  // exactly the uploads the creator's last ingest used: saved in the same run, right after the creator row
  const vids = (await db`
    select v.channel_id, v.title, v.views, v.likes, v.comments, v.category_id,
      extract(epoch from c.fetched_at - v.published_at) / 86400 as age_days from videos v join creators c using (channel_id)
    where v.channel_id = any(${ids}) and v.fetched_at between c.fetched_at - interval '5 minutes' and c.fetched_at + interval '30 minutes'
    order by v.channel_id, v.published_at desc`) as { channel_id: string; title: string; views: number; likes: number | null; comments: number; category_id: string | null; age_days: number }[];
  return creators.map((c) => {
    // the latest 20, as the ingest's metrics use (more may be stored for share of voice: UPLOAD_HISTORY_DAYS)
    const mine = vids.filter((v) => v.channel_id === c.channel_id).slice(0, LATEST_UPLOADS);
    return {
      channelId: c.channel_id, name: c.name, about: c.about, niche: c.niche, niche2: c.niche2, nicheConf: c.niche_conf, language: c.language,
      subs: c.subs, avgViews: c.avg_views, eng: c.eng, auth: c.auth, suspicious: c.suspicious, consistency: c.consistency,
      titles: mine.map((v) => v.title), categories: mine.map((v) => v.category_id), topics: c.yt_topics, videos: mine.map((v) => ({ views: v.views, likes: v.likes, comments: v.comments, ageDays: Number(v.age_days) })),
    };
  });
}

/**
 * Audit every complete batch of 100 creators added since the last audit. The first ever run starts a baseline at the
 * current count, so only creators added from then on are audited (older ones predate segment.ts and stored
 * descriptions). `latest` audits the most recent 100 now, whatever the count, without moving the sequence.
 */
export async function runAudits(db: Db, opts: { latest?: boolean } = {}): Promise<AuditResult[]> {
  const [{ n }] = (await db`select count(*)::int as n from creators`) as { n: number }[];
  const golden = (await db`select name, niche from creators where name = any(${Object.keys(GOLDEN)})`) as { name: string; niche: string }[];
  const audit = async (from: number, to: number) => {
    const checks = auditBatch(await loadBatch(db, from, to - from), golden);
    return { from, to, passed: checks.every((c) => c.passed), checks };
  };
  if (opts.latest) return [await audit(Math.max(0, n - BATCH), n)];

  const [last] = (await db`select to_n from quality_audits order by to_n desc limit 1`) as { to_n: number }[];
  if (!last) {
    await db`insert into quality_audits (from_n, to_n, passed, checks) values (${n}, ${n}, true, ${JSON.stringify([{ name: "Baseline", passed: true, summary: `Audits start after creator #${n}`, failures: [] }])}::jsonb)`;
    return [];
  }
  const out: AuditResult[] = [];
  for (let from = last.to_n; from + BATCH <= n; from += BATCH) {
    const r = await audit(from, from + BATCH);
    await db`insert into quality_audits (from_n, to_n, passed, checks) values (${r.from}, ${r.to}, ${r.passed}, ${JSON.stringify(r.checks)}::jsonb)`;
    out.push(r);
  }
  return out;
}

/** YouTube API policy: nothing fetched through the API is kept more than 30 days without a refresh (campaign records aside). */
export async function freshnessCheck(db: Db): Promise<Check> {
  const [r] = (await db`
    select (select count(*)::int from creators where fetched_at < now() - interval '30 days') as creators,
      (select count(*)::int from videos v where v.fetched_at < now() - interval '30 days'
        and not exists (select 1 from campaign_posts p where p.video_id = v.video_id)
        and not exists (select 1 from deliverables d where d.video_id = v.video_id)) as videos,
      (select coalesce(max(extract(day from now() - fetched_at)), 0)::int from creators) as oldest`) as { creators: number; videos: number; oldest: number }[];
  return {
    name: "YouTube data is under 30 days old", passed: !r.creators && !r.videos,
    summary: `oldest creator data ${r.oldest} days · ${r.creators} creators and ${r.videos} videos past 30 days`,
    failures: r.creators || r.videos ? ["The nightly ingest refreshes or deletes these; if this persists, check that the cron ran (quota, errors)."] : [],
  };
}
