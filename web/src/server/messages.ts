import "server-only";
import type { Side } from "@/lib/scout/deals";
import type { User } from "./auth";
import { sql } from "./db";

function db() {
  if (!sql) throw new Error("DATABASE_URL is not set");
  return sql;
}

export type Message = { id: number; by: Side; body: string; at: string };
const sideOf = (u: User): Side => (u.role === "brand" ? "brand" : "creator");

/** True if this user is a party to the deal (the brand that owns it, or the creator whose channel it's with). */
async function party(u: User, dealId: string) {
  const [d] = (await db()`
    select 1 from deals where id = ${dealId}
      and (${u.role === "brand"} and brand_id = ${u.id} or ${u.role === "creator"} and channel_id = ${u.channelId ?? ""})`) as unknown[];
  return !!d;
}

/** Messages after `after` (an id), oldest first, and marks the deal read for this side. Null if not a party. */
export async function listMessages(u: User, dealId: string, after = 0): Promise<Message[] | null> {
  if (!(await party(u, dealId))) return null;
  const q = db();
  const rows = (await q`
    select id::int, by_party, body, created_at::text as at from deal_messages
    where deal_id = ${dealId} and id > ${after} order by id limit 200`) as { id: number; by_party: Side; body: string; at: string }[];
  if (sideOf(u) === "brand") await q`update deals set brand_read_at = now() where id = ${dealId}`;
  else await q`update deals set creator_read_at = now() where id = ${dealId}`;
  return rows.map((r) => ({ id: r.id, by: r.by_party, body: r.body, at: r.at }));
}

const PER_MINUTE = 20; // anti-spam: plenty for a real conversation

export async function sendMessage(u: User, dealId: string, text: string): Promise<{ error: string } | { message: Message }> {
  const body = text.trim().slice(0, 2000);
  if (!body) return { error: "Write a message first." };
  if (!(await party(u, dealId))) return { error: "Deal not found." };
  const q = db();
  const [{ n }] = (await q`select count(*)::int as n from deal_messages where user_id = ${u.id} and created_at > now() - interval '1 minute'`) as { n: number }[];
  if (n >= PER_MINUTE) return { error: "You're sending messages too fast. Wait a moment." };
  const [m] = (await q`
    insert into deal_messages (deal_id, by_party, user_id, body) values (${dealId}, ${sideOf(u)}, ${u.id}, ${body})
    returning id::int, by_party, body, created_at::text as at`) as { id: number; by_party: Side; body: string; at: string }[];
  await q`update deals set updated_at = now() where id = ${dealId}`;
  return { message: { id: m.id, by: m.by_party, body: m.body, at: m.at } };
}

/** Unread messages per deal for this user: from the other side, after this side last read the deal. */
export async function unreadCounts(u: User, dealIds: string[]): Promise<Map<string, number>> {
  if (!dealIds.length) return new Map();
  const mine = sideOf(u);
  const rows = (await db()`
    select m.deal_id, count(*)::int as n from deal_messages m join deals d on d.id = m.deal_id
    where m.deal_id = any(${dealIds}) and m.by_party <> ${mine}
      and m.created_at > coalesce(case when ${mine} = 'brand' then d.brand_read_at else d.creator_read_at end, '-infinity'::timestamptz)
    group by m.deal_id`) as { deal_id: string; n: number }[];
  return new Map(rows.map((r) => [r.deal_id, r.n]));
}
