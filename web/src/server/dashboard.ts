import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { mentionPattern, summarizeMentions } from "@/lib/scout/mentions";
import { sql } from "./db";

function db() {
  if (!sql) throw new Error("DATABASE_URL is not set");
  return sql;
}

/**
 * Every tracked upload from the last `days` that names one of the brand's terms (prefiltered in Postgres), from
 * creators in the brand's category when it has one: "boat" in a travel vlog isn't an audio-brand mention.
 */
export async function brandMentions(terms: string[], category: string | null, days = 90) {
  // Cached per (terms, category): scanning ~15K long descriptions takes ~1.6 s, and mentions only change when the
  // nightly ingest brings new videos (it revalidates the "creators" tag).
  "use cache";
  cacheTag("creators");
  cacheLife("hours");
  const pattern = mentionPattern(terms);
  if (!pattern) return null;
  const rows = (await db()`
    select v.video_id as "videoId", v.title, v.description, v.url, v.views, v.published_at::text as "publishedAt",
      c.name as creator, c.handle
    from videos v join creators c using (channel_id)
    where v.published_at > now() - make_interval(days => ${days}) and (${category}::text is null or c.niche = ${category}) and (v.title ~* ${pattern} or v.description ~* ${pattern})
    order by v.views desc limit 500`) as Parameters<typeof summarizeMentions>[0];
  return summarizeMentions(rows, terms);
}

/** A creator's own channel history: daily subscribers (last 180 days) and recent uploads. */
export async function channelActivity(channelId: string) {
  const [trend, uploads] = await Promise.all([
    db()`select taken_on::text as day, subs as views from snapshots
      where channel_id = ${channelId} and taken_on > current_date - 180 order by taken_on`,
    db()`select video_id, title, url, views, coalesce(likes, 0) as likes, comments, published_at::text as published from videos
      where channel_id = ${channelId} order by published_at desc limit 10`,
  ]);
  return {
    trend: trend as { day: string; views: number }[],
    uploads: uploads as { video_id: string; title: string; url: string; views: number; likes: number; comments: number; published: string }[],
  };
}

export type BrandBrief = { id: string; company: string; category: string | null; brief: string; pitchable: boolean };

/**
 * Brands' saved briefs. Every brief counts toward a creator's "briefs you match" number (a count reveals nothing);
 * only pitchable ones are ever shown by name and text. Budgets are never selected.
 */
export async function brandBriefs(): Promise<BrandBrief[]> {
  return (await db()`
    select user_id::text as id, company, category, brief, pitchable from brand_profiles where brief is not null and brief <> ''`) as BrandBrief[];
}
