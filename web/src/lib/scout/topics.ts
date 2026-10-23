// What a creator actually makes, from their own video titles: recurring words, stemmed. Pure; used at ingest
// (to store creators.topics) and at search time (to read the brief the same way). Rule-based, no model.

// Words that say nothing about the content: English + Hinglish function words, video boilerplate, languages.
const STOP = new Set(`
a an the and or but of to in on at by for from with without about into over under than then this that these those it its
is are was were be been being am do does did have has had will would can could should may might must not no yes so too very
just only also more most less least much many some any all each every both few other such own same new best top full part
how what why when where who whom which whose there here up down out off again once your you our we they them their his her
my me i he she video videos short shorts reel reels live stream streams channel channels subscribe official episode ep vlog
vlogs vs versus ft feat day days today week month year years 2023 2024 2025 2026 first last one two three get got make made
kya hai hain ka ki ke se me mein aur ko bhi ye yeh woh kaise kar karo karna wala wale wali tha thi the hota hoti sab bhai
hindi english tamil telugu bengali bangla marathi kannada malayalam gujarati punjabi india indian
creator creators influencer influencers youtuber youtubers channel content audience follower followers sub subs subscriber
subscribers view views engagement strong high good great fast growing like similar who make makes making`.split(/\s+/).filter(Boolean));

// Agent nouns → the activity word titles use ("reviewers" find "review" videos).
// A Map, not an object literal: title words like "constructor" must not resolve to Object.prototype members.
const IRREGULAR = new Map(Object.entries({ reviewer: "review", reviewers: "review", gamer: "gaming", gamers: "gaming", investor: "invest", investors: "invest", investing: "invest", cooking: "cook", traveller: "travel", travellers: "travel" }));

/** Light stemmer, applied identically to titles and briefs (consistency matters more than linguistic accuracy). */
export function stem(w: string): string {
  const irregular = IRREGULAR.get(w);
  if (irregular) return irregular;
  if (w.length > 6 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Content words: letters in any script (Devanagari, Tamil…), 3+ chars, digits only inside words ("s24", "rtx4090"). */
export function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((w) => w.length >= 3 && /\p{L}/u.test(w) && !STOP.has(w))
    .map(stem)
    .filter((w) => !STOP.has(w));
}

/** Words that recur across a creator's titles (in ≥2 of them), most frequent first. */
export function topicsFrom(titles: string[], max = 20): string[] {
  const count = new Map<string, number>();
  for (const t of titles) for (const w of new Set(contentWords(t))) count.set(w, (count.get(w) ?? 0) + 1);
  return [...count].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([w]) => w);
}

/** Inverse document frequency over all creators' topics: rare words ("bgmi", "msi") count more than common ones ("review"). */
export function idfOf(topicLists: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const ts of topicLists) for (const t of new Set(ts)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = topicLists.length || 1;
  return new Map([...df].map(([t, d]) => [t, Math.log(1 + n / d)]));
}

/** Share (0–1) of the brief's topic weight this creator covers, and which terms matched. */
export function topicMatch(terms: string[], topics: string[], idf: Map<string, number>) {
  if (!terms.length) return { score: 0, matched: [] as string[] };
  const max = Math.max(1, ...idf.values());
  const w = (t: string) => idf.get(t) ?? max; // a word no creator uses is maximally specific
  const have = new Set(topics);
  const matched = terms.filter((t) => have.has(t));
  return { score: matched.reduce((s, t) => s + w(t), 0) / terms.reduce((s, t) => s + w(t), 0), matched };
}
