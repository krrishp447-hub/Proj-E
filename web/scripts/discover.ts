// Seed channels to track by searching YouTube for the niche Scout is starting with.
//   npm run discover                          (default queries below)
//   npm run discover -- "tech review hindi"   (your own queries)
// Each query costs 100 quota units (search.list) and adds up to 50 channels. Default set: 600 units.
import { neon } from "@neondatabase/serverless";

const { DATABASE_URL, YOUTUBE_API_KEY } = process.env;
if (!DATABASE_URL || !YOUTUBE_API_KEY) throw new Error("Set DATABASE_URL and YOUTUBE_API_KEY in .env.local");
const sql = neon(DATABASE_URL);

const DEFAULT_QUERIES = [
  "TWS earbuds review India",
  "budget earbuds review hindi",
  "ANC headphones review India",
  "smartphone review hindi",
  "tech unboxing India",
  "gadgets under 2000 review",
];
const queries = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_QUERIES;

let added = 0;
for (const q of queries) {
  const params = new URLSearchParams({ part: "snippet", type: "channel", q, regionCode: "IN", maxResults: "50", key: YOUTUBE_API_KEY });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) throw new Error(`search "${q}" failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { items = [] } = (await res.json()) as { items?: { id: { channelId: string } }[] };
  for (const it of items) {
    const rows = await sql`insert into channel_seeds (channel_id, note) values (${it.id.channelId}, ${q}) on conflict do nothing returning channel_id`;
    added += rows.length;
  }
  console.log(`"${q}": ${items.length} channels`);
}
console.log(`Added ${added} new seed channels. Next: trigger the ingest (see README).`);
