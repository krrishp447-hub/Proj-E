import "server-only";
import { matchVideo, type Campaign, type TrackingRules, type VideoPost } from "@/lib/scout/campaigns";
import type { YtVideo } from "@/lib/scout/metrics";
import { sql } from "./db";

type Db = NonNullable<typeof sql>;
const n = (s?: string) => Number(s ?? 0) || 0;

/** Store a channel's recent uploads and today's per-video stats (called by the ingest for every tracked channel). */
// Batched: one statement per table per channel (unnest of parallel arrays) instead of 2 round trips per video.
export async function saveVideos(db: Db, channelId: string, videos: YtVideo[]) {
  if (!videos.length) return;
  const col = <T,>(f: (v: YtVideo) => T) => videos.map(f);
  const ids = col((v) => v.id);
  const views = col((v) => n(v.statistics.viewCount)), comments = col((v) => n(v.statistics.commentCount));
  const likes = col((v) => (v.statistics.likeCount === undefined ? null : n(v.statistics.likeCount))); // null = hidden by the creator, not 0
  await db`
    insert into videos (video_id, channel_id, title, description, published_at, url, views, likes, comments, fetched_at)
    select id, ${channelId}, title, descr, published::timestamptz, 'https://www.youtube.com/watch?v=' || id, vw, lk, cm, now()
    from unnest(${ids}::text[], ${col((v) => v.snippet.title)}::text[], ${col((v) => v.snippet.description ?? "")}::text[],
                ${col((v) => v.snippet.publishedAt)}::text[], ${views}::int[], ${likes}::int[], ${comments}::int[])
         as t(id, title, descr, published, vw, lk, cm)
    on conflict (video_id) do update set title = excluded.title, description = excluded.description,
      views = excluded.views, likes = excluded.likes, comments = excluded.comments, fetched_at = now()`;
  // Daily per-video history only for uploads from the last 45 days (the campaign window); older videos keep
  // their latest totals on the videos row. Keeps storage linear in channels, not channels × days × 15 videos.
  await db`
    insert into video_snapshots (video_id, taken_on, views, likes, comments)
    select id, current_date, vw, lk, cm from unnest(${ids}::text[], ${views}::int[], ${likes}::int[], ${comments}::int[], ${col((v) => v.snippet.publishedAt)}::text[]) as t(id, vw, lk, cm, published)
    where published::timestamptz > now() - interval '45 days'
    on conflict (video_id, taken_on) do update set views = excluded.views, likes = excluded.likes, comments = excluded.comments`;
}

type CampaignRow = { id: string; start_date: string; end_date: string; rules: TrackingRules; creators: string[] | null };
type VideoRow = { video_id: string; channel_id: string; title: string; description: string; published_at: string; url: string; paid_flag: boolean | null; views: number; likes: number | null; comments: number };

export type FilingResult = { campaigns: number; checked: number; filed: number; review: number; organic: number; deliverablesLinked: number };

/**
 * The campaign folder, automatically: match every stored upload in each live campaign's window against its
 * tracking rules. Human decisions (decided_by) are never overwritten. Filed posts from contracted creators
 * mark their earliest open deliverable Live.
 */
export async function fileCampaignPosts(): Promise<FilingResult> {
  const db = sql;
  const out: FilingResult = { campaigns: 0, checked: 0, filed: 0, review: 0, organic: 0, deliverablesLinked: 0 };
  if (!db) return out;

  const campaigns = (await db`
    select c.id, c.start_date::text as start_date, c.end_date::text as end_date, c.rules,
      (select array_agg(cc.channel_id) from campaign_creators cc where cc.campaign_id = c.id) as creators
    from campaigns c
    where c.status = 'Live' and current_date between c.start_date and c.end_date + 7`) as CampaignRow[];
  out.campaigns = campaigns.length;

  for (const row of campaigns) {
    const campaign: Campaign<string> = {
      id: row.id, brand: "", name: "", status: "Live", start: row.start_date, end: row.end_date, rules: row.rules, creatorIds: row.creators ?? [],
    };
    const videos = (await db`
      select video_id, channel_id, title, description, published_at::text as published_at, url, paid_flag, views, likes, comments
      from videos where published_at >= ${row.start_date}::date and published_at < ${row.end_date}::date + 2`) as VideoRow[];

    for (const v of videos) {
      out.checked++;
      const post: VideoPost<string> = {
        id: v.video_id, creatorId: v.channel_id, platform: "YouTube", title: v.title, description: v.description,
        publishedAt: v.published_at, url: v.url, paidFlag: v.paid_flag ?? undefined, views: v.views, likes: v.likes ?? 0, comments: v.comments, daily: [],
      };
      const m = matchVideo(post, campaign);
      if (m.status === "none") continue;
      out[m.status]++;
      await db`
        insert into campaign_posts (campaign_id, video_id, confidence, reasons, status, disclosed)
        values (${row.id}, ${v.video_id}, ${m.confidence}, ${m.reasons}, ${m.status}, ${m.disclosed})
        on conflict (campaign_id, video_id) do update set confidence = excluded.confidence, reasons = excluded.reasons,
          disclosed = excluded.disclosed, matched_at = now(),
          status = case when campaign_posts.decided_by is null then excluded.status else campaign_posts.status end`;

      if (m.status === "filed") {
        const linked = await db`
          update deliverables set video_id = ${v.video_id}, status = 'Live'
          where id = (
            select id from deliverables
            where campaign_id = ${row.id} and channel_id = ${v.channel_id} and video_id is null and status <> 'Live'
            order by due limit 1
          )
          and not exists (select 1 from deliverables where video_id = ${v.video_id})
          returning id`;
        out.deliverablesLinked += linked.length;
      }
    }
  }
  return out;
}
