// Search-quality benchmark on live data: real briefs, each with a rule for what a relevant result is.
//   npm run benchmark
// Score per brief = precision@10: the share of the top 10 that satisfy the brief's rule. "forbid" rules must match none
// of the top 20 (the MC STAN-in-"tech" class of bug). Briefs marked `known gap` document what rules can't do yet
// (typos, Hindi script, everyday synonyms): they show where the next improvement should go, and that it worked.
import { neon } from "@neondatabase/serverless";
import type { Creator } from "../src/lib/scout/data.ts";
import { rowToCreator, type CreatorRow } from "../src/lib/scout/rows.ts";
import { searchAll } from "../src/lib/scout/search.ts";

type Case = { q: string; relevant: (c: Creator) => boolean; forbid?: (c: Creator) => boolean; gap?: string };
const has = (c: Creator, ...words: string[]) => words.some((w) => c.topics.includes(w) || c.tags.some((t) => t.startsWith(w)));
const niche = (c: Creator, ...n: string[]) => n.includes(c.niche) || (!!c.secondaryNiche && n.includes(c.secondaryNiche));
const SOUTH = ["Tamil", "Telugu", "Kannada", "Malayalam"];
const INDIAN = (c: Creator) => c.country === "India" || (c.country === "Unknown" && c.language !== "English");

const CASES: Case[] = [
  { q: "tech", relevant: (c) => niche(c, "Tech"), forbid: (c) => c.niche === "Music" },
  { q: "tech creators", relevant: (c) => niche(c, "Tech"), forbid: (c) => c.niche === "Music" },
  { q: "Hindi tech reviewers", relevant: (c) => niche(c, "Tech") && c.language === "Hindi" },
  { q: "Indian YouTube tech creators who review earbuds, 50K–500K subs, strong engagement", relevant: (c) => niche(c, "Tech") && c.subs >= 50_000 && c.subs <= 500_000 },
  { q: "MSI laptop reviewers", relevant: (c) => niche(c, "Tech") && has(c, "laptop", "msi") },
  { q: "BGMI streamers in Hindi", relevant: (c) => niche(c, "Gaming") && c.language === "Hindi" && has(c, "bgmi") },
  { q: "gaming creators but not bgmi", relevant: (c) => niche(c, "Gaming") && !has(c, "bgmi") },
  { q: "South Indian food bloggers", relevant: (c) => niche(c, "Food") && SOUTH.includes(c.language) },
  { q: "beauty creators but not hindi", relevant: (c) => niche(c, "Beauty") && c.language !== "Hindi" },
  { q: "skincare routine creators", relevant: (c) => niche(c, "Beauty") && has(c, "skincare", "skin") },
  { q: "kids rhymes", relevant: (c) => niche(c, "Kids") },
  { q: "cricket creators", relevant: (c) => niche(c, "Sports") && has(c, "cricket", "ipl") },
  { q: "news channels in bengali", relevant: (c) => niche(c, "News") && c.language === "Bengali" },
  { q: "devotional bhajan", relevant: (c) => niche(c, "Spiritual") || has(c, "bhajan") },
  { q: "music artists", relevant: (c) => niche(c, "Music") },
  { q: "punjabi singers", relevant: (c) => niche(c, "Music") && c.language === "Punjabi" },
  { q: "stock market for beginners hinglish", relevant: (c) => niche(c, "Finance") && c.language === "Hindi" },
  { q: "finance youtubers with 100k+ avg views", relevant: (c) => niche(c, "Finance") && c.views >= 100_000 },
  { q: "micro influencers in fitness", relevant: (c) => niche(c, "Fitness") && c.subs >= 10_000 && c.subs <= 100_000 },
  { q: "yoga for beginners", relevant: (c) => niche(c, "Fitness") && has(c, "yoga") },
  { q: "car reviews in tamil", relevant: (c) => niche(c, "Automotive") && c.language === "Tamil" },
  { q: "travel vlogs in malayalam", relevant: (c) => niche(c, "Travel") && c.language === "Malayalam" },
  { q: "upsc preparation", relevant: (c) => niche(c, "Education") && has(c, "upsc", "ias") },
  { q: "creators like Technical Guruji", relevant: (c) => niche(c, "Tech"), forbid: (c) => c.name === "Technical Guruji" },
  // phrasing: everyday synonyms, typos, Hindi script (were 33% as known gaps before aliases / typo fixes / script + Hinglish maps)
  { q: "affordable phone reviews", relevant: (c) => niche(c, "Tech") },
  { q: "cheap earphones", relevant: (c) => niche(c, "Tech") && has(c, "earbud", "tws", "budget") },
  { q: "ernbuds review", relevant: (c) => niche(c, "Tech") && has(c, "earbud", "tws") },
  { q: "fitnes creators", relevant: (c) => niche(c, "Fitness") },
  { q: "workout videos in tamil", relevant: (c) => niche(c, "Fitness") && c.language === "Tamil" },
  { q: "टेक रिव्यू हिंदी", relevant: (c) => niche(c, "Tech") && c.language === "Hindi" },
  { q: "गेमिंग", relevant: (c) => niche(c, "Gaming") },
  { q: "रेसिपी", relevant: (c) => niche(c, "Food") },
  { q: "स्किनकेयर", relevant: (c) => niche(c, "Beauty") },
  { q: "குழந்தை பாடல்கள்", relevant: (c) => niche(c, "Kids") },
  { q: "రుచికరమైన వంటలు", relevant: (c) => niche(c, "Food") },
  { q: "paisa kaise bachaye", relevant: (c) => niche(c, "Finance") },
  { q: "gaane sunao", relevant: (c) => niche(c, "Music") },
  { q: "bike ride vlogs", relevant: (c) => niche(c, "Automotive", "Travel") },
  { q: "smartwatch reviews", relevant: (c) => niche(c, "Tech") && has(c, "smartwatch", "watch") },
  // the market: ScoutBlack is for Indian creators, so a brief without a country still means India; "India" in a brief
  // mustn't drop channels that never set a country (a third of them) when everything else says Indian
  { q: "personal finance creators in english", relevant: (c) => niche(c, "Finance") && INDIAN(c) },
  { q: "comedy creators", relevant: (c) => niche(c, "Entertainment") && INDIAN(c) },
  { q: "indian cooking channels in hindi", relevant: (c) => niche(c, "Food") && c.language === "Hindi" },
];

const sql = neon(process.env.DATABASE_URL!);
const rows = (await sql`
  select c.*, 0 as age_days, extract(day from now() - c.last_upload)::int as upload_days, false as claimed, false as has_email, null::int[] as trend, null::int[] as aud_age, null::int as aud_male, null::jsonb as aud_geo
  from creators c where not c.is_brand order by c.subs desc`) as CreatorRow[];
const creators = rows.map(rowToCreator);

const results = CASES.map((k) => {
  const r = searchAll(creators, k.q, { limit: 20, missLimit: 0 });
  const top10 = r.fits.slice(0, 10).map((m) => m.creator);
  // precision over what's returned (up to 10); a pool smaller than 10 is a data-coverage issue, reported as "thin"
  const precision = top10.length ? top10.filter(k.relevant).length / top10.length : 0;
  const forbidden = k.forbid ? r.fits.slice(0, 20).filter((m) => k.forbid!(m.creator)).map((m) => m.creator.name) : [];
  return { ...k, precision: forbidden.length ? 0 : precision, fits: r.fitCount, forbidden, top: top10.slice(0, 3).map((c) => c.name), fixes: r.understood.filter((u) => u.includes(" → ")) };
});

const core = results.filter((r) => !r.gap), gaps = results.filter((r) => r.gap);
const avg = (xs: typeof results) => Math.round((xs.reduce((s, r) => s + r.precision, 0) / Math.max(1, xs.length)) * 100);
console.log(`Search benchmark · ${creators.length} creators\n`);
for (const r of results) {
  const flag = r.forbidden.length ? `  ✗ forbidden in top 20: ${r.forbidden.slice(0, 3).join(", ")}` : "";
  console.log(`${String(Math.round(r.precision * 100)).padStart(4)}%  ${r.q.padEnd(44).slice(0, 44)} ${String(r.fits).padStart(5)} fit${r.fits < 10 ? " (thin)" : ""}${r.gap ? `  [gap: ${r.gap}]` : ""}${r.fixes.length ? `  (read ${r.fixes.join(", ")})` : ""}${flag}`);
}
console.log(`\nCore precision@10: ${avg(core)}% over ${core.length} briefs · ${core.filter((r) => r.precision >= 0.8).length} at ≥80%`);
if (gaps.length) console.log(`Known gaps: ${avg(gaps)}% over ${gaps.length} briefs`);
