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

export type SegmentInput = { name: string; about?: string; titles: string[]; tags?: string[] };
export type Segment = { niche: string; secondary: string | null; confidence: number; scores: Record<string, number> };

const SELF_WEIGHT = 2;
const SELF_CAP = 5; // at most 10 points from self-description per niche

export function segment(input: SegmentInput): Segment {
  const self = nicheHits([input.name, input.about ?? "", ...(input.tags ?? [])].join(" \n "));
  const votes: Record<string, number> = {};
  for (const t of input.titles) { const v = titleVote(t); if (v) votes[v] = (votes[v] ?? 0) + 1; }

  const scores: Record<string, number> = {};
  for (const n of NICHES) scores[n] = SELF_WEIGHT * Math.min(self[n].count, SELF_CAP) + (votes[n] ?? 0);
  // ties: more distinct self-description words, then more title votes — never list order
  const ranked = [...NICHES].sort((a, b) => scores[b] - scores[a] || self[b].distinct - self[a].distinct || (votes[b] ?? 0) - (votes[a] ?? 0));
  const [best, second] = ranked;
  if (scores[best] < 2) return { niche: "Other", secondary: null, confidence: 0, scores };
  const confidence = Math.round((scores[best] / (scores[best] + scores[second])) * 100) / 100;
  const secondary = scores[second] >= 2 && scores[second] >= 0.4 * scores[best] ? second : null;
  return { niche: best, secondary, confidence, scores };
}
