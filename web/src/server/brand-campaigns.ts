import "server-only";
import { randomUUID } from "node:crypto";
import { rollup, type CampaignRollup, type Deliverable, type MatchResult, type TrackingRules, type VideoPost } from "@/lib/scout/campaigns";
import type { User } from "./auth";
import { fileCampaignPosts } from "./campaigns";
import { fileDeliverablePosts } from "./delivery";
import { sql } from "./db";

function db() {
  if (!sql) throw new Error("DATABASE_URL is not set");
  return sql;
}

export type CampaignPhase = "Planned" | "Live" | "Completed";
export type CampaignSummary = { id: string; name: string; start: string; end: string; phase: CampaignPhase; deals: number; posts: number; views: number; review: number };

const phase = (start: string, end: string, today = new Date().toISOString().slice(0, 10)): CampaignPhase => (today < start ? "Planned" : today > end ? "Completed" : "Live");
const list = (s: string, max = 10) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, max).map((x) => x.slice(0, 120));

/** Form text → tracking rules (comma-separated each). Hashtags get their #, mentions their @. */
export function rulesFrom(fd: { hashtags: string; links: string; mentions: string; keywords: string }): TrackingRules {
  return {
    hashtags: list(fd.hashtags).map((h) => (h.startsWith("#") ? h : `#${h}`)),
    links: list(fd.links),
    mentions: list(fd.mentions).map((m) => (m.startsWith("@") ? m : `@${m}`)),
    keywords: list(fd.keywords),
  };
}

export async function listCampaigns(u: User): Promise<CampaignSummary[]> {
  const rows = (await db()`
    select c.id, c.name, c.start_date::text as start, c.end_date::text as "end",
      (select count(*)::int from deals d where d.campaign_id = c.id) as deals,
      (select count(*)::int from campaign_posts p where p.campaign_id = c.id and p.status = 'filed') as posts,
      (select coalesce(sum(v.views), 0)::bigint from campaign_posts p join videos v using (video_id) where p.campaign_id = c.id and p.status = 'filed') as views,
      (select count(*)::int from campaign_posts p where p.campaign_id = c.id and p.status = 'review') as review
    from campaigns c where c.brand_id = ${u.id} order by c.start_date desc, c.created_at desc`) as
    { id: string; name: string; start: string; end: string; deals: number; posts: number; views: string; review: number }[];
  return rows.map((r) => ({ ...r, views: Number(r.views), phase: phase(r.start, r.end) }));
}

export type CampaignInput = { name: string; start: string; end: string; rules: TrackingRules };

export async function saveCampaign(u: User, input: CampaignInput, id?: string): Promise<string> {
  const q = db();
  const [p] = (await q`select company from brand_profiles where user_id = ${u.id}`) as { company: string }[];
  await q`insert into brands (id, name) values (${u.id}, ${p?.company ?? "Brand"}) on conflict (id) do update set name = excluded.name`;
  const rules = JSON.stringify(input.rules);
  if (id) {
    await q`update campaigns set name = ${input.name}, start_date = ${input.start}::date, end_date = ${input.end}::date, rules = ${rules}::jsonb
      where id = ${id} and brand_id = ${u.id}`;
  } else {
    id = randomUUID();
    // stored "Live": the nightly filer only looks inside the campaign's dates anyway; the phase shown is from the dates
    await q`insert into campaigns (id, brand_id, name, status, start_date, end_date, rules)
      values (${id}, ${u.id}, ${input.name}, 'Live', ${input.start}::date, ${input.end}::date, ${rules}::jsonb)`;
  }
  await fileCampaignPosts(id); // this campaign's creators now; organic mentions from everyone else come with the nightly run
  return id;
}

/** Put a deal (and its creator and deliverables) into one of the brand's campaigns, or take it out (null). */
export async function assignDeal(u: User, dealId: string, campaignId: string | null): Promise<string | null> {
  const q = db();
  const [d] = (await q`select channel_id, campaign_id from deals where id = ${dealId} and brand_id = ${u.id}`) as { channel_id: string; campaign_id: string | null }[];
  if (!d) return "Deal not found.";
  if (campaignId) {
    const [c] = (await q`select 1 from campaigns where id = ${campaignId} and brand_id = ${u.id}`) as unknown[];
    if (!c) return "Campaign not found.";
    await q`insert into campaign_creators (campaign_id, channel_id) values (${campaignId}, ${d.channel_id}) on conflict do nothing`;
  }
  await q`update deals set campaign_id = ${campaignId}, updated_at = now() where id = ${dealId}`;
  await q`update deliverables set campaign_id = ${campaignId} where deal_id = ${dealId}`;
  if (d.campaign_id && d.campaign_id !== campaignId) {
    // the deal's own videos were filed into the old campaign as deliverables: they leave with the deal
    await q`delete from campaign_posts p where p.campaign_id = ${d.campaign_id} and p.decided_by = 'deliverable'
      and p.video_id in (select video_id from deliverables where deal_id = ${dealId} and video_id is not null)`;
    await q`delete from campaign_creators cc where cc.campaign_id = ${d.campaign_id} and cc.channel_id = ${d.channel_id}
      and not exists (select 1 from deals x where x.campaign_id = cc.campaign_id and x.channel_id = cc.channel_id)`;
  }
  if (campaignId) { await fileDeliverablePosts(dealId); await fileCampaignPosts(campaignId); }
  return null;
}

/** A post the matcher wasn't sure about: the brand files it or rejects it (a human call is never overwritten). */
export async function decidePost(u: User, campaignId: string, videoId: string, status: "filed" | "rejected") {
  await db()`update campaign_posts p set status = ${status}, decided_by = ${u.id}
    from campaigns c where c.id = p.campaign_id and c.brand_id = ${u.id} and p.campaign_id = ${campaignId} and p.video_id = ${videoId}`;
}

export type CampaignDetail = {
  id: string; name: string; start: string; end: string; phase: CampaignPhase; rules: TrackingRules;
  creators: string[]; // index = rollup creatorId
  stats: CampaignRollup;
  posts: { videoId: string; title: string; url: string; creator: string; views: number; publishedAt: string; status: string; reasons: string[]; disclosed: boolean }[];
  deliverables: { id: string; dealId: string; creator: string; kind: string; due: string; status: string; fee: number; late: boolean; url: string | null; draft: string | null }[];
};

export async function campaignDetail(u: User, id: string): Promise<CampaignDetail | null> {
  const q = db();
  const [c] = (await q`select id, name, start_date::text as start, end_date::text as "end", rules from campaigns where id = ${id} and brand_id = ${u.id}`) as
    { id: string; name: string; start: string; end: string; rules: TrackingRules }[];
  if (!c) return null;
  const posts = (await q`
    select p.video_id, p.status, p.reasons, p.disclosed, p.confidence, v.title, v.url, v.views, v.likes, v.comments, v.published_at::text as published_at,
      v.channel_id, cr.name as creator,
      (select array_agg(s.views order by s.taken_on) from video_snapshots s where s.video_id = p.video_id) as daily
    from campaign_posts p join videos v using (video_id) join creators cr on cr.channel_id = v.channel_id
    where p.campaign_id = ${id} and p.status in ('filed', 'review', 'organic') order by v.views desc`) as
    { video_id: string; status: string; reasons: string[]; disclosed: boolean; confidence: number; title: string; url: string; views: number; likes: number | null; comments: number;
      published_at: string; channel_id: string; creator: string; daily: number[] | null }[];
  const items = (await q`
    select x.id, x.deal_id, x.kind, x.due::text as due, x.status, x.fee, x.projected_views, x.video_id, x.video_url, x.draft_url, x.channel_id, cr.name as creator
    from deliverables x join creators cr on cr.channel_id = x.channel_id where x.campaign_id = ${id} order by x.due`) as
    { id: string; deal_id: string; kind: string; due: string; status: string; fee: number; projected_views: number; video_id: string | null; video_url: string | null; draft_url: string | null; channel_id: string; creator: string }[];

  // rollup() is shared with the demo and indexes creators by number
  const channels = [...new Set([...posts.map((p) => p.channel_id), ...items.map((x) => x.channel_id)])];
  const names = channels.map((ch) => posts.find((p) => p.channel_id === ch)?.creator ?? items.find((x) => x.channel_id === ch)?.creator ?? ch);
  const idx = (ch: string) => channels.indexOf(ch);
  const today = new Date().toISOString().slice(0, 10);
  const filed = posts.filter((p) => p.status === "filed").map((p) => ({
    video: { id: p.video_id, creatorId: idx(p.channel_id), platform: "YouTube", title: p.title, description: "", publishedAt: p.published_at, url: p.url,
      views: p.views, likes: p.likes ?? 0, comments: p.comments, daily: p.daily?.length ? p.daily : [p.views] } satisfies VideoPost,
    match: { confidence: p.confidence, reasons: p.reasons, status: "filed", disclosed: p.disclosed, linked: false } satisfies MatchResult,
  }));
  // Delivered statuses (Approved, Paid) count as live for the roll-up's delivery numbers
  const deliverables: Deliverable[] = items.map((x) => ({
    id: x.id, dealId: x.deal_id, campaignId: id, creatorId: idx(x.channel_id), kind: x.kind as Deliverable["kind"], due: x.due,
    status: ["Live", "Approved", "Paid"].includes(x.status) ? "Live" : "Planned", videoId: x.video_id ?? undefined, projectedViews: x.projected_views, fee: x.fee,
  }));
  return {
    id: c.id, name: c.name, start: c.start, end: c.end, phase: phase(c.start, c.end), rules: c.rules, creators: names,
    stats: rollup(filed, deliverables, today),
    posts: posts.map((p) => ({ videoId: p.video_id, title: p.title, url: p.url, creator: p.creator, views: p.views, publishedAt: p.published_at, status: p.status, reasons: p.reasons, disclosed: p.disclosed })),
    deliverables: items.map((x) => ({ id: x.id, dealId: x.deal_id, creator: x.creator, kind: x.kind, due: x.due, status: x.status, fee: x.fee,
      late: !["Live", "Approved", "Paid"].includes(x.status) && x.due < today, url: x.video_url, draft: x.draft_url })),
  };
}
