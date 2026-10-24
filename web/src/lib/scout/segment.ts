// Channel segregation: which niche a creator belongs to, how sure we are, and what else they make. Pure, rule-based.
//
// Two kinds of evidence, weighed separately so neither can dominate:
//   self-description — channel name, description, keywords: what the creator says they are (capped per niche,
//                      so a description stuffed with keywords can't win on its own)
//   uploads          — every video title votes on its own, so 15 cricket videos outweigh one "tech" mention
// The primary niche needs at least 2 points; the runner-up is kept as a secondary niche when it is substantial.
import { NICHES } from "./data.ts";
import { SYNONYMS } from "./engine.ts";

// Music releases ("Official Audio", "Lyrical Video"): count as Music, never as the Tech word "audio".
const MUSIC_RELEASE = /official\s+(music\s+)?(video|audio|visuali[sz]er)|audio\s+song|full\s+audio|lyric(al)?\s+video|\blyrics?\b|\bvisuali[sz]er\b/g;

const PATTERNS = NICHES.map((n) => ({
  niche: n,
  // the niche's own name matches as a whole word ("tech", not "Technoblade"); synonyms at word start ("earbud" → "earbuds")
  res: [new RegExp(String.raw`\b${n.toLowerCase()}\b`, "g"), ...(SYNONYMS[n] ?? []).map((w) => new RegExp(String.raw`\b${w}`, "g"))],
}));

export type Hits = Record<string, { count: number; distinct: number }>;

/** Keyword hits per niche in one piece of text. */
export function nicheHits(text: string): Hits {
  const t = text.toLowerCase().replace(MUSIC_RELEASE, " music ");
  const out: Hits = {};
  for (const { niche, res } of PATTERNS) {
    const counts = res.map((re) => t.match(re)?.length ?? 0);
    out[niche] = { count: counts.reduce((a, b) => a + b, 0), distinct: counts.filter(Boolean).length };
  }
  return out;
}

/** The single best niche in a short text (one video title), or null if nothing matches or it's a tie. */
function titleVote(title: string): string | null {
  const h = Object.entries(nicheHits(title)).filter(([, v]) => v.count > 0).sort((a, b) => b[1].count - a[1].count || b[1].distinct - a[1].distinct);
  if (!h.length) return null;
  if (h[1] && h[1][1].count === h[0][1].count && h[1][1].distinct === h[0][1].distinct) return null; // ambiguous title
  return h[0][0];
}

export type SegmentInput = {
  name: string; about?: string; titles: string[]; tags?: string[];
  categories?: (string | null | undefined)[]; // each upload's YouTube categoryId, chosen by the creator
  topics?: string[]; // the channel's topicDetails.topicCategories (Wikipedia URLs)
};
export type Segment = { niche: string; secondary: string | null; confidence: number; scores: Record<string, number> };

const SELF_WEIGHT = 2;
const SELF_CAP = 5; // at most 10 points from self-description per niche

// YouTube's own video categories: what the creator picked, independent of title words. People & Blogs (22, the default)
// and Howto & Style (26: beauty, fashion, cooking and DIY alike) say nothing. Entertainment (24), Education (27: finance and tech
// tutorials file there) and Sports (17: gym and yoga creators pick it) are common catch-alls: a quarter, mostly a tie-break.
// Capped per niche like self-description, so 20 uploads filed under Music can't drown a bhajan channel's devotional words.
const CATEGORY_CAP = 10;
const CATEGORY: Record<string, [string, number]> = {
  "20": ["Gaming", 1.5], "10": ["Music", 1.5], "23": ["Entertainment", 1.5], "24": ["Entertainment", 0.25], "28": ["Tech", 1.5],
  "17": ["Sports", 0.25], "25": ["News", 1.5], "27": ["Education", 0.25], "2": ["Automotive", 1.5], "19": ["Travel", 1.5],
};
// Channel topics (Wikipedia pages YouTube assigns). Broad ones (Entertainment, Lifestyle, Knowledge) count less.
const TOPIC_POINTS = 3;
function topicNiche(url: string): [string, number] | null {
  const t = decodeURIComponent(url.split("/wiki/")[1] ?? url);
  if (/video_game|_game$|^Video_game_culture$/i.test(t)) return ["Gaming", TOPIC_POINTS];
  if (/^Music$|_music$|^Jazz$|^Reggae$|^Rhythm_and_blues$/i.test(t)) return ["Music", TOPIC_POINTS];
  if (/^Technology$/i.test(t)) return ["Tech", TOPIC_POINTS];
  if (/^Sport$|^Association_football$|^Cricket$|^Basketball$|^Boxing$|^Golf$|^Tennis$|^Volleyball$|^Motorsport$|^Mixed_martial_arts$|^Professional_wrestling$/i.test(t)) return ["Sports", TOPIC_POINTS];
  if (/^Food$/i.test(t)) return ["Food", TOPIC_POINTS];
  if (/^Physical_fitness$/i.test(t)) return ["Fitness", TOPIC_POINTS];
  if (/^Physical_attractiveness$/i.test(t)) return ["Beauty", TOPIC_POINTS];
  if (/^Fashion$/i.test(t)) return ["Fashion", TOPIC_POINTS];
  if (/^Tourism$/i.test(t)) return ["Travel", TOPIC_POINTS];
  if (/^Vehicle$/i.test(t)) return ["Automotive", TOPIC_POINTS];
  if (/^Politics$|^Military$/i.test(t)) return ["News", TOPIC_POINTS];
  if (/^Religion$/i.test(t)) return ["Spiritual", TOPIC_POINTS];
  if (/^Business$/i.test(t)) return ["Finance", TOPIC_POINTS];
  if (/^Humour$|^Film$|^Television_program$|^Performing_arts$|^Entertainment$/i.test(t)) return ["Entertainment", 1];
  if (/^Knowledge$/i.test(t)) return ["Education", 1];
  if (/^Lifestyle_\(sociology\)$/i.test(t)) return ["Lifestyle", 1];
  return null;
}

export function segment(input: SegmentInput): Segment {
  const self = nicheHits([input.name, input.about ?? "", ...(input.tags ?? [])].join(" \n "));
  const votes: Record<string, number> = {};
  for (const t of input.titles) { const v = titleVote(t); if (v) votes[v] = (votes[v] ?? 0) + 1; }
  const cats: Record<string, number> = {}, catVideos: Record<string, number> = {};
  for (const c of input.categories ?? []) { const m = c ? CATEGORY[c] : undefined; if (m) { cats[m[0]] = (cats[m[0]] ?? 0) + m[1]; catVideos[m[0]] = (catVideos[m[0]] ?? 0) + 1; } }
  const topics: Record<string, number> = {};
  for (const u of input.topics ?? []) { const m = topicNiche(u); if (m) topics[m[0]] = Math.max(topics[m[0]] ?? 0, m[1]); }

  const scores: Record<string, number> = {};
  for (const n of NICHES) scores[n] = SELF_WEIGHT * Math.min(self[n].count, SELF_CAP) + (votes[n] ?? 0) + Math.min(cats[n] ?? 0, CATEGORY_CAP) + (topics[n] ?? 0);
  // ties: more distinct self-description words, then more title votes — never list order
  const ranked = [...NICHES].sort((a, b) => scores[b] - scores[a] || self[b].distinct - self[a].distinct || (votes[b] ?? 0) - (votes[a] ?? 0));
  // Devotional music is Spiritual, with Music as its secondary: a brand searching "bhajan" wants these channels, and their
  // Devanagari/Bengali titles often hide the devotional words from the keyword list while YouTube files them under Music.
  if (ranked[0] === "Music" && self.Spiritual.distinct + (votes.Spiritual ?? 0) >= 2) { ranked.splice(ranked.indexOf("Spiritual"), 1); ranked.unshift("Spiritual"); }
  const [best, second] = ranked;
  // At least two pieces of evidence: title votes, distinct self-description words, a word in the channel's own name
  // (counted again: "… Gaming" is strong), the uploads' YouTube categories, the channel's YouTube topics. One stray
  // description word ("From BB to your speakers") must not make a sketch-comedy channel Tech at 100%.
  const evidence = (votes[best] ?? 0) + self[best].distinct + (nicheHits(input.name)[best].count ? 1 : 0)
    + Math.min(2, catVideos[best] ?? 0) + (topics[best] ? 1 : 0); // two+ uploads filed the same way is enough on its own
  if (scores[best] < 2 || evidence < 2) return { niche: "Other", secondary: null, confidence: 0, scores };
  const confidence = Math.round((scores[best] / (scores[best] + scores[second])) * 100) / 100;
  const secondary = scores[second] >= 2 && scores[second] >= 0.4 * scores[best] ? second : null;
  return { niche: best, secondary, confidence, scores };
}
