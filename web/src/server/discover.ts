import "server-only";
import { sql } from "./db";
import { searchChannels } from "./youtube";

// Every niche × language search Scout runs. Rule-based, not a model: extend a list to widen discovery.
const TERMS: Record<string, string[]> = {
  Tech: ["tech review", "smartphone review", "gadgets unboxing", "earbuds review", "laptop review"],
  Food: ["recipes", "cooking channel", "street food"],
  Fitness: ["fitness workout", "gym", "yoga"],
  Gaming: ["gaming", "bgmi", "gameplay live"],
  Travel: ["travel vlog", "bike travel"],
  Fashion: ["fashion", "men style"],
  Beauty: ["makeup", "skincare"],
  Finance: ["stock market", "personal finance", "investing"],
  Education: ["upsc", "study tips", "coding tutorial"],
  Automotive: ["car review", "bike review"],
  Entertainment: ["comedy sketch", "movie review"],
  Parenting: ["parenting", "baby care"],
};
const LANGS = ["india", "hindi", "tamil", "telugu", "bengali", "marathi", "kannada", "malayalam", "gujarati", "punjabi"];
export const QUERIES = Object.values(TERMS).flatMap((ts) => ts.flatMap((t) => LANGS.map((l) => `${t} ${l}`)));

const DAILY_QUOTA = 10_000;
const HEADROOM = 1_000; // never plan to the last unit
const PER_CHANNEL = 2.02; // ingest cost per channel per day (see ingest.ts)
const PER_QUERY = 100 + 50 * PER_CHANNEL; // one search page + refreshing what it can add
const MAX_QUERIES = 20;

export type DiscoveryResult = { activeSeeds: number; queries: number; added: number; quotaUnits: number };

/**
 * Grow the channel list with whatever quota the daily refresh leaves over. Runs the least-recently-run
 * queries, continuing each from its last page; a query that stops yielding new channels is retired.
 * Stops on its own once refreshing the tracked channels would use the whole quota (~4,000 channels).
 */
export async function runDiscovery(): Promise<DiscoveryResult> {
  if (!sql) throw new Error("DATABASE_URL is not set");
  await sql`insert into discovery_queries (q) select unnest(${QUERIES}::text[]) on conflict do nothing`;
  const [{ n: activeSeeds }] = (await sql`select count(*)::int as n from channel_seeds where active`) as { n: number }[];
  const budget = DAILY_QUOTA - HEADROOM - Math.ceil(activeSeeds * PER_CHANNEL);
  const result: DiscoveryResult = { activeSeeds, queries: 0, added: 0, quotaUnits: 0 };
  const take = Math.max(0, Math.min(MAX_QUERIES, Math.floor(budget / PER_QUERY)));
  if (!take) return result;

  const queries = (await sql`
    select q, page_token from discovery_queries where not done
    order by last_run nulls first, q limit ${take}`) as { q: string; page_token: string | null }[];
  for (const { q, page_token } of queries) {
    const { ids, next } = await searchChannels(q, page_token ?? undefined);
    result.queries++;
    result.quotaUnits += 100;
    const rows = await sql`
      insert into channel_seeds (channel_id, note) select unnest(${ids}::text[]), ${q}
      on conflict do nothing returning channel_id`;
    result.added += rows.length;
    // retire a query once results run out or a page brings nothing new (deeper pages only get less relevant)
    await sql`
      update discovery_queries set page_token = ${next}, last_run = current_date, added = added + ${rows.length},
        done = ${!next || rows.length === 0} where q = ${q}`;
  }
  return result;
}
