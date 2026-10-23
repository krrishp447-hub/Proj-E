import "server-only";
import { fairRate } from "@/lib/scout/campaigns";
import { sql } from "./db";

/** What the offer page needs to show about a creator: identity, reach and a market-rate guide. */
export type CreatorCard = {
  channelId: string; name: string; handle: string; niche: string; language: string; subs: number; views: number; eng: number;
  fair: { low: number; high: number };
};
export type BrandCard = { id: string; company: string; category: string | null; brief: string | null }; // never the budget

type Row = { channel_id: string; name: string; handle: string; niche: string; language: string; subs: number; avg_views: number; eng: number };
const card = (r: Row): CreatorCard => ({
  channelId: r.channel_id, name: r.name, handle: r.handle, niche: r.niche, language: r.language, subs: r.subs, views: r.avg_views, eng: r.eng,
  fair: fairRate(r.avg_views, r.eng),
});

function db() {
  if (!sql) throw new Error("DATABASE_URL is not set");
  return sql;
}

export const MAX_TARGETS = 10;

export async function creatorCards(ids: string[]): Promise<CreatorCard[]> {
  const clean = [...new Set(ids)].filter((id) => /^[\w-]{10,40}$/.test(id)).slice(0, MAX_TARGETS);
  if (!clean.length) return [];
  const rows = (await db()`
    select channel_id, name, handle, niche, language, subs, avg_views, eng from creators
    where channel_id = any(${clean}) and not is_brand`) as Row[];
  return clean.map((id) => rows.find((r) => r.channel_id === id)).filter((r): r is Row => !!r).map(card);
}

/** Name / handle search for the offer page's creator picker (biggest channels first). */
export async function searchCreatorCards(q: string): Promise<CreatorCard[]> {
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = (await db()`
    select channel_id, name, handle, niche, language, subs, avg_views, eng from creators
    where not is_brand and (name ilike ${like} or handle ilike ${like}) order by subs desc limit 8`) as Row[];
  return rows.map(card);
}

/** Brands a creator can pitch: only those who opted in (brand_profiles.pitchable). Budgets are never exposed. */
export async function pitchableBrands(): Promise<BrandCard[]> {
  return (await db()`select user_id::text as id, company, category, brief from brand_profiles where pitchable order by company`) as BrandCard[];
}
