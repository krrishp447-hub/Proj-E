import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { computeSov, sovPattern, type BrandTerms, type SovResult, type SovVideo } from "@/lib/scout/sov";
import { sql } from "./db";

/**
 * Share of voice for a set of brands over tracked creators' uploads from the last `days` days (optionally one niche).
 * One regex scan of stored titles + descriptions for the whole set; cached until the nightly ingest brings new videos.
 * Views are each video's current count; every counted video was published inside the window.
 */
export async function getShareOfVoice(brands: BrandTerms[], category: string | null, days = 90): Promise<SovResult | null> {
  "use cache";
  cacheTag("creators");
  cacheLife("hours");
  const pattern = sovPattern(brands);
  if (!sql || !pattern || brands.length < 2) return null;
  // ponytail: biggest 5,000 matching videos; page through them if a category ever has more
  const rows = (await sql`
    select v.video_id as "videoId", v.title, v.description, v.url, v.views, v.published_at::text as "publishedAt",
      v.channel_id as "channelId", c.name as creator,
      (select json_agg(json_build_array(s.taken_on::text, s.views) order by s.taken_on) from video_snapshots s
        where s.video_id = v.video_id and s.taken_on > current_date - 36) as snaps -- for views gained per week
    from videos v join creators c using (channel_id)
    where v.published_at > now() - make_interval(days => ${days}) and not c.is_brand
      and (${category}::text is null or c.niche = ${category} or c.niche2 = ${category})
      and (v.title ~* ${pattern} or v.description ~* ${pattern})
    order by v.views desc limit 5000`) as SovVideo[];
  const r = computeSov(rows, brands, days);
  // offers need a claimed channel: mark who's on ScoutBlack so the outreach list links offers only for them
  const claimed = new Set(((await sql`select channel_id from channel_connections where channel_id = any(${r.creators.map((c) => c.channelId)})`) as { channel_id: string }[]).map((x) => x.channel_id));
  for (const c of r.creators) c.claimed = claimed.has(c.channelId);
  return r;
}

/** The demo's live example: India's TWS-earbud market, with each brand's product names (common words excluded). */
export const DEMO_SOV: { title: string; category: string; brands: BrandTerms[] } = {
  title: "TWS earbuds in India",
  category: "Tech",
  brands: [
    { name: "boAt", terms: ["boAt", "Airdopes", "Rockerz"] },
    { name: "Noise", terms: ["Noise Buds", "Noise Air Buds", "NoiseFit", "gonoise"] },
    { name: "OnePlus", terms: ["OnePlus Buds", "OnePlus Nord Buds"] },
    { name: "realme", terms: ["realme Buds", "realme TechLife Buds"] },
    { name: "Boult", terms: ["Boult", "Boult Audio"] },
    { name: "JBL", terms: ["JBL"] },
  ],
};
