import "server-only";
import { randomUUID } from "node:crypto";
import { googleDriveUrl, parseDeliverables, stageFromDelivery, youtubeVideoId, type DeliverableKind, type DeliveryStatus } from "@/lib/scout/delivery";
import { DISCLOSURE } from "@/lib/scout/campaigns";
import type { DealStage } from "@/lib/scout/deals";
import type { User } from "./auth";
import { saveVideos } from "./campaigns";
import { sql } from "./db";
import { fetchVideos, isQuotaError } from "./youtube";

function db() {
  if (!sql) throw new Error("DATABASE_URL is not set");
  return sql;
}

export type DeliverableView = {
  id: string; kind: DeliverableKind; due: string; status: DeliveryStatus; fee: number; projectedViews: number;
  videoUrl: string | null; videoId: string | null; title: string | null; views: number | null; publishedAt: string | null;
  draftUrl: string | null; draftAt: string | null; // the creator's draft cut (Google Drive) for review before posting
};

/** Every item of these deals, oldest first, with the live video's title and current views. */
export async function deliverablesFor(dealIds: string[]): Promise<Map<string, DeliverableView[]>> {
  const out = new Map<string, DeliverableView[]>();
  if (!dealIds.length) return out;
  const rows = (await db()`
    select d.id, d.deal_id, d.kind, d.due::text as due, d.status, d.fee, d.projected_views, d.video_url, d.video_id, d.draft_url, d.draft_at::text as draft_at,
      v.title, v.views, v.published_at::text as published_at
    from deliverables d left join videos v on v.video_id = d.video_id
    where d.deal_id = any(${dealIds}) order by d.due, d.created_at, d.id`) as {
    id: string; deal_id: string; kind: DeliverableKind; due: string; status: DeliveryStatus | "In production"; fee: number; projected_views: number;
    video_url: string | null; video_id: string | null; title: string | null; views: number | null; published_at: string | null;
    draft_url: string | null; draft_at: string | null;
  }[];
  for (const r of rows) {
    const list = out.get(r.deal_id) ?? [];
    list.push({ id: r.id, kind: r.kind, due: r.due, status: r.status === "In production" ? "Planned" : r.status, fee: r.fee, projectedViews: r.projected_views,
      videoUrl: r.video_url, videoId: r.video_id, title: r.title, views: r.views, publishedAt: r.published_at, draftUrl: r.draft_url, draftAt: r.draft_at });
    out.set(r.deal_id, list);
  }
  return out;
}

/**
 * Once a deal is agreed: the accepted offer's deliverables become items ("1 video + 2 Shorts" → three), the agreed fee
 * split across them, due on the deal's due date (or in two weeks). Runs once per deal; later changes are by hand.
 */
export async function createDeliverables(dealId: string) {
  const q = db();
  const [d] = (await q`
    select d.channel_id, d.campaign_id, coalesce(d.due, current_date + 14)::text as due, c.avg_views,
      (select o.deliverables from offers o where o.deal_id = d.id order by o.created_at desc, o.id desc limit 1) as text,
      (select o.fee from offers o where o.deal_id = d.id order by o.created_at desc, o.id desc limit 1) as fee
    from deals d join creators c using (channel_id)
    where d.id = ${dealId} and not exists (select 1 from deliverables x where x.deal_id = d.id)`) as
    { channel_id: string; campaign_id: string | null; due: string; avg_views: number; text: string | null; fee: number | null }[];
  if (!d) return;
  const kinds = parseDeliverables(d.text ?? "");
  const fee = d.fee ?? 0, each = Math.floor(fee / kinds.length);
  for (const [i, kind] of kinds.entries()) {
    // ponytail: Shorts projected at half a channel's average views; replace with Shorts-specific averages if they're stored
    const projected = Math.round(kind === "YouTube Short" ? d.avg_views / 2 : d.avg_views);
    await q`insert into deliverables (id, deal_id, campaign_id, channel_id, kind, due, fee, projected_views)
      values (${randomUUID()}, ${dealId}, ${d.campaign_id}, ${d.channel_id}, ${kind}, ${d.due}::date, ${i === 0 ? fee - each * (kinds.length - 1) : each}, ${projected})`;
  }
}

/** Move the deal along as its items are delivered (forward only). */
export async function syncStage(dealId: string) {
  const q = db();
  const [d] = (await q`select stage from deals where id = ${dealId}`) as { stage: DealStage }[];
  if (!d) return;
  const items = ((await q`select status from deliverables where deal_id = ${dealId}`) as { status: DeliveryStatus | "In production" }[])
    .map((r) => (r.status === "In production" ? "Planned" : r.status));
  const next = stageFromDelivery(d.stage, items);
  if (next !== d.stage) await q`update deals set stage = ${next}, updated_at = now() where id = ${dealId} and stage = ${d.stage}`;
}

type Item = { id: string; deal_id: string; channel_id: string; status: string; video_id: string | null; stage: DealStage };

/** The item, only if this user is a party to its deal. */
async function ownItem(u: User, id: string): Promise<Item | null> {
  const [r] = (await db()`
    select x.id, x.deal_id, x.channel_id, x.status, x.video_id, d.stage from deliverables x join deals d on d.id = x.deal_id
    where x.id = ${id} and (${u.role === "brand"} and d.brand_id = ${u.id} or ${u.role === "creator"} and d.channel_id = ${u.channelId ?? ""})`) as Item[];
  return r ?? null;
}

/** Confirm a video from YouTube and link it: public, and on the creator's own channel. */
async function linkVideo(item: { id: string; channel_id: string }, videoId: string, url: string): Promise<"live" | "pending" | "wrong-channel"> {
  const q = db();
  let video;
  try { [video] = await fetchVideos([videoId]); } catch (e) { if (!isQuotaError(e)) throw e; } // out of quota: confirm tonight
  if (video && video.snippet.channelId !== item.channel_id) return "wrong-channel";
  if (!video) { await q`update deliverables set video_url = ${url}, status = 'Submitted' where id = ${item.id}`; return "pending"; }
  await saveVideos(q, item.channel_id, [video]);
  await q`update deliverables set video_url = ${url}, video_id = ${videoId}, status = 'Live' where id = ${item.id}`;
  return "live";
}

/** Creator: "here's the video". Returns an error message, or null. */
export async function submitDeliverable(u: User, id: string, url: string): Promise<string | null> {
  if (u.role !== "creator") return "Only the creator submits videos.";
  const item = await ownItem(u, id);
  if (!item) return "Deliverable not found.";
  if (!["Planned", "In production", "Submitted"].includes(item.status)) return "This one is already live.";
  const videoId = youtubeVideoId(url);
  if (!videoId) return "Paste a YouTube video link (youtube.com/watch?v=…, youtu.be/… or a Shorts link).";
  const [taken] = (await db()`select 1 from deliverables where video_id = ${videoId} and id <> ${id}`) as unknown[];
  if (taken) return "That video is already linked to another deliverable.";
  const r = await linkVideo(item, videoId, url.trim().slice(0, 300));
  if (r === "wrong-channel") return "That video isn't on your connected channel.";
  if (r === "live") await fileDeliverablePosts(item.deal_id);
  await syncStage(item.deal_id);
  return null;
}

/** Creator: share (or replace, or clear with "") the draft cut for review: a Google Drive / Docs link. */
export async function setDraftLink(u: User, id: string, url: string): Promise<string | null> {
  if (u.role !== "creator") return "Only the creator shares drafts.";
  const item = await ownItem(u, id);
  if (!item) return "Deliverable not found.";
  if (item.status === "Paid") return "This one is already paid.";
  const draft = url.trim() ? googleDriveUrl(url) : null;
  if (url.trim() && !draft) return "Paste a Google Drive link (drive.google.com or docs.google.com), shared so the brand can open it.";
  await db()`update deliverables set draft_url = ${draft}, draft_at = ${draft ? new Date().toISOString() : null} where id = ${id}`;
  return null;
}

/** Brand: approve a live video, mark it paid, or reopen it (send back for changes). */
export async function setDeliverableStatus(u: User, id: string, to: "Approved" | "Paid" | "Planned"): Promise<string | null> {
  if (u.role !== "brand") return "Only the brand approves and pays.";
  const item = await ownItem(u, id);
  if (!item) return "Deliverable not found.";
  const q = db();
  if (to === "Approved") {
    if (item.status !== "Live") return "Approve once the video is live.";
    await q`update deliverables set status = 'Approved', approved_at = now() where id = ${id}`;
  } else if (to === "Paid") {
    if (!["Live", "Approved"].includes(item.status)) return "Mark paid once the video is live.";
    await q`update deliverables set status = 'Paid', paid_at = now(), approved_at = coalesce(approved_at, now()) where id = ${id}`;
  } else {
    if (item.status === "Paid") return "Paid items can't be reopened.";
    // sent back for changes: its auto-filed post leaves the campaign until a new video is confirmed
    if (item.video_id) await q`delete from campaign_posts where video_id = ${item.video_id} and decided_by = 'deliverable'`;
    await q`update deliverables set status = 'Planned', video_id = null, approved_at = null where id = ${id}`;
  }
  await syncStage(item.deal_id);
  return null;
}

/** Brand: add an item to an agreed deal (e.g. an extra Short), or remove one that isn't live yet. */
export async function addDeliverable(u: User, dealId: string, kind: DeliverableKind, due: string): Promise<string | null> {
  if (u.role !== "brand") return "Only the brand edits deliverables.";
  const q = db();
  const [d] = (await q`select channel_id, campaign_id, stage from deals where id = ${dealId} and brand_id = ${u.id}`) as { channel_id: string; campaign_id: string | null; stage: DealStage }[];
  if (!d) return "Deal not found.";
  if (!["Contracted", "In production", "Live"].includes(d.stage)) return "Agree the deal first.";
  const [c] = (await q`select avg_views from creators where channel_id = ${d.channel_id}`) as { avg_views: number }[];
  await q`insert into deliverables (id, deal_id, campaign_id, channel_id, kind, due, projected_views)
    values (${randomUUID()}, ${dealId}, ${d.campaign_id}, ${d.channel_id}, ${kind}, ${due}::date, ${Math.round(kind === "YouTube Short" ? (c?.avg_views ?? 0) / 2 : c?.avg_views ?? 0)})`;
  return null;
}
export async function removeDeliverable(u: User, id: string): Promise<string | null> {
  if (u.role !== "brand") return "Only the brand edits deliverables.";
  const item = await ownItem(u, id);
  if (!item) return "Deliverable not found.";
  if (!["Planned", "In production", "Submitted"].includes(item.status)) return "Live items stay on the record.";
  await db()`delete from deliverables where id = ${id}`;
  await syncStage(item.deal_id);
  return null;
}

/**
 * Nightly: confirm submitted links that YouTube can now see (made public, or quota was out), and refresh live
 * deliverable videos' stats weekly so campaign numbers stay current (and inside the 30-day API data rule).
 */
export async function checkDeliverables(): Promise<{ confirmed: number; refreshed: number }> {
  const q = db();
  const out = { confirmed: 0, refreshed: 0 };
  const pending = (await q`select id, deal_id, channel_id, video_url from deliverables where status = 'Submitted' and video_url is not null limit 200`) as
    { id: string; deal_id: string; channel_id: string; video_url: string }[];
  for (const p of pending) {
    const vid = youtubeVideoId(p.video_url);
    const r = vid ? await linkVideo(p, vid, p.video_url) : null;
    if (r === "live") { out.confirmed++; await fileDeliverablePosts(p.deal_id); await syncStage(p.deal_id); }
    // checked while the quota was out at submit time, and it's someone else's video: back to the creator to resubmit
    if (r === "wrong-channel") await q`update deliverables set status = 'Planned', video_url = null where id = ${p.id}`;
  }
  const stale = (await q`
    select d.channel_id, d.video_id from deliverables d join videos v on v.video_id = d.video_id
    where v.fetched_at < now() - interval '6 days' order by v.fetched_at limit 500`) as { channel_id: string; video_id: string }[];
  if (stale.length) {
    let videos;
    try { videos = await fetchVideos(stale.map((s) => s.video_id)); } catch (e) { if (isQuotaError(e)) return out; throw e; } // out of quota: next night
    const channelOf = new Map(stale.map((s) => [s.video_id, s.channel_id]));
    for (const v of videos) { await saveVideos(q, channelOf.get(v.id)!, [v]); out.refreshed++; }
  }
  return out;
}

/**
 * A confirmed deliverable video is its campaign's post by definition: file it as a decided post (decided_by
 * 'deliverable', so the nightly matcher never re-labels it), with its ad-disclosure flag. Runs on confirmation and
 * when the deal joins a campaign.
 */
export async function fileDeliverablePosts(dealId: string) {
  const q = db();
  const rows = (await q`
    select x.campaign_id, x.video_id, v.title, v.description from deliverables x join videos v on v.video_id = x.video_id
    where x.deal_id = ${dealId} and x.campaign_id is not null`) as { campaign_id: string; video_id: string; title: string; description: string }[];
  for (const r of rows) {
    await q`insert into campaign_posts (campaign_id, video_id, confidence, reasons, status, disclosed, decided_by)
      values (${r.campaign_id}, ${r.video_id}, 100, ${["Submitted for this deal"]}, 'filed', ${DISCLOSURE.test(`${r.title}\n${r.description}`)}, 'deliverable')
      on conflict (campaign_id, video_id) do update set status = 'filed', decided_by = 'deliverable', confidence = 100, reasons = excluded.reasons, disclosed = excluded.disclosed`;
  }
}
