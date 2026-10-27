import "server-only";
import { randomUUID } from "node:crypto";
import { fairRate } from "@/lib/scout/campaigns";
import { fmt } from "@/lib/scout/engine";
import { act, whoseTurn, type DealAction, type DealStage, type OfferEntry, type Side, type Terms } from "@/lib/scout/deals";
import type { User } from "./auth";
import { sql } from "./db";
import { createDeliverables, deliverablesFor, type DeliverableView } from "./delivery";
import { unreadCounts } from "./messages";

function db() {
  if (!sql) throw new Error("DATABASE_URL is not set");
  return sql;
}

export type ChecklistItem = { text: string; done: boolean };
export type DealView = {
  id: string; title: string; stage: DealStage; initiatedBy: Side; due: string | null; checklist: ChecklistItem[]; updatedAt: string;
  counterpart: { name: string; sub: string }; offers: OfferEntry[]; myTurn: boolean;
  fair: { low: number; high: number } | null; // market guide from the creator's real views and engagement
  campaignId: string | null;
  deliverables: DeliverableView[]; // once agreed: each item from planned to paid
  unread: number; // chat messages from the other side since this side last opened the deal
  channelId: string;
};

const sideOf = (u: User): Side => (u.role === "brand" ? "brand" : "creator");

type DealRow = { id: string; title: string; stage: DealStage; initiated_by: Side; due: string | null; checklist: ChecklistItem[]; updated_at: string; cp_name: string; cp_sub: string; subs?: number; avg_views: number; eng: number; campaign_id: string | null; channel_id: string };
type OfferRow = { deal_id: string; by_party: Side; fee: number; deliverables: string; usage_rights: string; timeline: string; note: string | null; created_at: string };

/** Every deal the user is a party to: brands by brand_id, creators by the channel they've connected. */
export async function listDeals(u: User): Promise<DealView[]> {
  const q = db();
  if (u.role === "creator" && !u.channelId) return [];
  const rows = (u.role === "brand"
    ? await q`
        select d.id, d.title, d.stage, d.initiated_by, d.due::text as due, d.checklist, d.updated_at::text as updated_at, d.campaign_id, d.channel_id,
          c.name as cp_name, c.niche || ' · ' || c.language as cp_sub, c.subs, c.avg_views, c.eng
        from deals d join creators c using (channel_id) where d.brand_id = ${u.id} order by d.updated_at desc`
    : await q`
        select d.id, d.title, d.stage, d.initiated_by, d.due::text as due, d.checklist, d.updated_at::text as updated_at, d.campaign_id, d.channel_id,
          b.name as cp_name, coalesce(bp.kind || ' · ' || coalesce(bp.category, ''), 'Brand') as cp_sub, c.avg_views, c.eng
        from deals d join brands b on b.id = d.brand_id join creators c using (channel_id) left join brand_profiles bp on bp.user_id::text = d.brand_id
        where d.channel_id = ${u.channelId} order by d.updated_at desc`) as DealRow[];
  if (!rows.length) return [];
  const offers = (await q`
    select deal_id, by_party, fee, deliverables, usage_rights, timeline, note, created_at::text as created_at
    from offers where deal_id = any(${rows.map((r) => r.id)}) order by created_at, id`) as OfferRow[];
  const me = sideOf(u);
  const ids = rows.map((r) => r.id);
  const [items, unread] = await Promise.all([deliverablesFor(ids), unreadCounts(u, ids)]);
  return rows.map((r) => {
    const thread: OfferEntry[] = offers.filter((o) => o.deal_id === r.id).map((o) => ({
      by: o.by_party, fee: o.fee, deliverables: o.deliverables, usage: o.usage_rights, timeline: o.timeline, note: o.note ?? undefined, at: o.created_at,
    }));
    return {
      id: r.id, title: r.title, stage: r.stage, initiatedBy: r.initiated_by, due: r.due, checklist: r.checklist, updatedAt: r.updated_at,
      counterpart: { name: r.cp_name, sub: r.subs != null ? `${r.cp_sub} · ${fmt(r.subs)} subs` : r.cp_sub }, offers: thread, myTurn: whoseTurn({ stage: r.stage, offers: thread }) === me,
      fair: r.avg_views ? fairRate(r.avg_views, r.eng) : null,
      campaignId: r.campaign_id, deliverables: items.get(r.id) ?? [], unread: unread.get(r.id) ?? 0, channelId: r.channel_id,
    };
  });
}

/** The deal, only if this user is a party to it. */
async function ownDeal(u: User, id: string) {
  const [d] = (await db()`
    select id, stage from deals where id = ${id}
      and (${u.role === "brand"} and brand_id = ${u.id} or ${u.role === "creator"} and channel_id = ${u.channelId ?? ""})`) as { id: string; stage: DealStage }[];
  return d ?? null;
}

async function addOffer(dealId: string, by: Side, t: Terms) {
  await db()`insert into offers (deal_id, by_party, fee, deliverables, usage_rights, timeline, note)
    values (${dealId}, ${by}, ${t.fee}, ${t.deliverables}, ${t.usage}, ${t.timeline}, ${t.note ?? null})`;
}

/**
 * Open a deal. A brand makes an offer to a creator who claimed their channel;
 * a creator pitches a brand account. The opening terms are the first offer in the thread.
 */
export async function openDeal(u: User, target: string, title: string, terms: Terms, checklist: string[], due: string | null): Promise<string> {
  const q = db();
  const id = randomUUID();
  let brandId: string, channelId: string;
  if (u.role === "brand") {
    const [p] = (await q`select company from brand_profiles where user_id = ${u.id}`) as { company: string }[];
    if (!p) throw new Error("Finish your brand profile first");
    await q`insert into brands (id, name) values (${u.id}, ${p.company}) on conflict (id) do update set name = excluded.name`;
    // offers go only to creators who claimed their channel on ScoutBlack (others can be invited first)
    const [c] = (await q`select channel_id from creators c where channel_id = ${target}
      and exists (select 1 from channel_connections x where x.channel_id = c.channel_id)`) as { channel_id: string }[];
    if (!c) throw new Error("This creator hasn't claimed their channel on ScoutBlack yet");
    brandId = u.id; channelId = c.channel_id;
  } else {
    if (!u.channelId) throw new Error("Connect your channel first");
    const [b] = (await q`select user_id::text as id, company from brand_profiles where user_id::text = ${target} and pitchable`) as { id: string; company: string }[];
    if (!b) throw new Error("Brand not found");
    await q`insert into brands (id, name) values (${b.id}, ${b.company}) on conflict (id) do update set name = excluded.name`;
    brandId = b.id; channelId = u.channelId;
  }
  await q`insert into deals (id, brand_id, channel_id, title, stage, initiated_by, due, checklist)
    values (${id}, ${brandId}, ${channelId}, ${title}, 'Inbound', ${sideOf(u)}, ${due}, ${JSON.stringify(checklist.map((text) => ({ text, done: false })))}::jsonb)`;
  await addOffer(id, sideOf(u), terms);
  return id;
}

/** Counter / accept / decline / move, enforced by the shared rules. */
export async function dealAction(u: User, id: string, a: DealAction): Promise<string | null> {
  const d = await ownDeal(u, id);
  if (!d) return "Deal not found.";
  const offers = (await db()`select by_party as by from offers where deal_id = ${id} order by created_at, id`) as { by: Side }[];
  const state = { stage: d.stage, offers: offers.map((o) => ({ by: o.by, fee: 0, deliverables: "", usage: "", timeline: "", at: "" })) };
  const next = act(state, sideOf(u), a, new Date().toISOString());
  if ("error" in next) return next.error;
  // Only apply if nobody changed the deal since we read it (same stage, same number of offers). Otherwise the other
  // side acted at the same moment: ask to refresh instead of writing a stage that contradicts the offer thread.
  const [moved] = (await db()`
    update deals set stage = ${next.stage}, updated_at = now()
    where id = ${id} and stage = ${d.stage} and (select count(*) from offers where deal_id = ${id}) = ${offers.length}
    returning id`) as { id: string }[];
  if (!moved) return "This deal just changed. Refresh to see the latest offer.";
  if (a.type === "counter") await addOffer(id, sideOf(u), a.terms);
  // agreed (accepted, or moved into the work stages): the offer's deliverables become trackable items, once
  if (["Contracted", "In production", "Live", "Paid"].includes(next.stage)) await createDeliverables(id);
  return null;
}

export async function setChecklist(u: User, id: string, checklist: ChecklistItem[]) {
  if (!(await ownDeal(u, id))) return;
  const clean = checklist.slice(0, 30).map((c) => ({ text: String(c.text).slice(0, 200), done: !!c.done })).filter((c) => c.text.trim());
  await db()`update deals set checklist = ${JSON.stringify(clean)}::jsonb, updated_at = now() where id = ${id}`;
}

export async function setDue(u: User, id: string, due: string | null) {
  if (!(await ownDeal(u, id))) return;
  await db()`update deals set due = ${due}, updated_at = now() where id = ${id}`;
}

/** Counts for the dashboard card. */
export function dealSummary(deals: DealView[]) {
  const active = deals.filter((d) => d.stage !== "Declined" && d.stage !== "Paid");
  const agreed = (d: DealView) => d.offers.at(-1)?.fee ?? 0;
  return {
    needsReply: deals.filter((d) => d.myTurn).length,
    unread: deals.reduce((s, d) => s + d.unread, 0),
    incoming: deals.filter((d) => d.stage === "Inbound" && d.myTurn).length,
    active: active.length,
    contractedValue: deals.filter((d) => ["Contracted", "In production", "Live", "Paid"].includes(d.stage)).reduce((s, d) => s + agreed(d), 0),
  };
}
