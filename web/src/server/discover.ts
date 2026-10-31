import "server-only";
import { sql } from "./db";
import { searchChannels } from "./youtube";

// Every niche × language search ScoutBlack runs. Rule-based, not a model: extend a list to widen discovery.
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
  Music: ["music cover", "indie music"],
  Kids: ["kids rhymes"],
  Sports: ["cricket analysis"],
  News: ["news analysis"],
  Spiritual: ["devotional"],
  Lifestyle: ["daily vlog"],
};
const LANGS = ["india", "hindi", "tamil", "telugu", "bengali", "marathi", "kannada", "malayalam", "gujarati", "punjabi"];
export const QUERIES = Object.values(TERMS).flatMap((ts) => ts.flatMap((t) => LANGS.map((l) => `${t} ${l}`)));
const NICHE_OF = new Map<string, string>(Object.entries(TERMS).flatMap(([niche, ts]) => ts.flatMap((t) => LANGS.map((l) => [`${t} ${l}`, niche] as const))));

/** Interleave items by group, keeping each group's order: a1 b1 c1 a2 b2 c2 … */
function roundRobin<T>(items: T[], group: (x: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const x of items) groups.set(group(x), [...(groups.get(group(x)) ?? []), x]);
  const out: T[] = [];
  for (let i = 0; out.length < items.length; i++) for (const g of groups.values()) if (g[i]) out.push(g[i]);
  return out;
}

const DAILY_QUOTA = 10_000;
const HEADROOM = 1_000; // never plan to the last unit
const PER_CHANNEL = 2.02 / 3; // ingest cost per channel per day: one refresh (~2.02 units) every 3rd night (see ingest.ts); ponytail: assumes all active channels are on the 3-day tier, a safe over-estimate while claimed (daily) ones are a handful
const PER_QUERY = 100 + 50 * PER_CHANNEL; // one search page + refreshing what it can add
const MAX_QUERIES = 20;

export type DiscoveryResult = { activeSeeds: number; queries: number; added: number; quotaUnits: number };

/**
 * Grow the channel list with whatever quota the daily refresh leaves over. Runs the least-recently-run
 * queries, continuing each from its last page; a query that stops yielding new channels is retired.
 * Stops on its own once refreshing the tracked channels would use the whole quota (~12,000 channels at one refresh per 3 nights).
 */
export async function runDiscovery(): Promise<DiscoveryResult> {
  if (!sql) throw new Error("DATABASE_URL is not set");
  await sql`insert into discovery_queries (q) select unnest(${QUERIES}::text[]) on conflict do nothing`;
  const [{ n: activeSeeds }] = (await sql`select count(*)::int as n from channel_seeds where active`) as { n: number }[];
  const budget = DAILY_QUOTA - HEADROOM - Math.ceil(activeSeeds * PER_CHANNEL);
  const result: DiscoveryResult = { activeSeeds, queries: 0, added: 0, quotaUnits: 0 };
  const take = Math.max(0, Math.min(MAX_QUERIES, Math.floor(budget / PER_QUERY)));
  if (!take) return result;

  // Least-recently-run first, then round-robin across niches. Alphabetical order alone spent a whole day on
  // "bike review …" / "bike travel …" (Automotive, Travel) while Beauty and Fashion got nothing.
  const open = (await sql`
    select q, page_token from discovery_queries where not done order by last_run nulls first, q`) as { q: string; page_token: string | null }[];
  const queries = roundRobin(open, (r) => NICHE_OF.get(r.q) ?? "Other").slice(0, take);
  for (const { q, page_token } of queries) {
    const { ids, next } = await searchChannels(q, page_token ?? undefined);
    result.queries++;
    result.quotaUnits += 100;
    const rows = await sql`
      insert into channel_seeds (channel_id, note) select unnest(${ids}::text[]), ${q}
      on conflict do nothing returning channel_id`;
    result.added += rows.length;
    // Retire a query when YouTube has no more pages, or after 3 pages in a row that added nothing (overlapping searches
    // often return known channels on page 1 while deeper pages still hold new ones). `pages` counts that empty streak.
    await sql`
      update discovery_queries set page_token = ${next}, last_run = current_date, added = added + ${rows.length},
        pages = case when ${rows.length} > 0 then 0 else pages + 1 end,
        done = ${!next} or (${rows.length} = 0 and pages + 1 >= 3) where q = ${q}`;
  }
  return result;
}
