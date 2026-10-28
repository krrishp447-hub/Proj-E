// Pure transforms: YouTube Data API v3 payloads → ScoutBlack signals. No I/O, so it is unit-tested directly.
import { NICHES } from "./data.ts";
import { KEYWORDS } from "./engine.ts";
import { nicheHits, segment } from "./segment.ts";
import { topicsFrom } from "./topics.ts";

/** The subset of a `channels.list` item we request (part=snippet,statistics,contentDetails,brandingSettings). */
export type YtChannel = {
  id: string;
  snippet: { title: string; description?: string; customUrl?: string; country?: string };
  statistics: { subscriberCount?: string; videoCount?: string; viewCount?: string; hiddenSubscriberCount?: boolean };
  contentDetails: { relatedPlaylists: { uploads: string } };
  brandingSettings?: { channel?: { keywords?: string } };
  topicDetails?: { topicCategories?: string[] }; // Wikipedia topic URLs YouTube assigns to the channel
};

/** The subset of a `videos.list` item we request (part=snippet,statistics). */
export type YtVideo = {
  id: string;
  snippet: { title: string; description?: string; tags?: string[]; publishedAt: string; defaultAudioLanguage?: string; categoryId?: string; channelId?: string };
  statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
};

export type Snapshot = { takenOn: string; subs: number }; // ISO date

/** Uploads a channel's metrics, niche and language are computed from: its latest 20 (more may be stored for SOV). */
export const LATEST_UPLOADS = 20;

export type ChannelMetrics = {
  channelId: string;
  name: string;
  handle: string;
  country: string;
  niche: string;
  secondaryNiche: string | null;
  nicheConfidence: number; // 0–1
  tags: string[];
  subs: number;
  avgViews: number;
  eng: number; // %
  growth: number; // % over ~90 days, 0 until history exists
  consistency: number; // 0–100
  auth: number; // estimated
  suspicious: number; // estimated %
  language: string;
  isBrand: boolean;
  topics: string[];
};

export const COUNTRY: Record<string, string> = { IN: "India", US: "US", GB: "UK", AE: "UAE" };
const n = (s?: string) => Number(s ?? 0) || 0;
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Niche + sub-niche tags from what the channel actually publishes (titles, descriptions, tags, channel keywords). */
export type Classification = { niche: string; tags: string[]; score: number; scores: Record<string, number> };

/**
 * Pooled keyword classification of one text (used for per-video sub-niche tags and quick checks). Channels are
 * segregated with segment(), which weighs self-description and uploads separately and adds secondary + confidence.
 */
export function classify(text: string): Classification {
  const h = nicheHits(text);
  let best = { niche: "Other", score: 0, distinct: 0 };
  for (const n of NICHES) {
    const { count, distinct } = h[n];
    if (count > best.score || (count === best.score && distinct > best.distinct)) best = { niche: n, score: count, distinct };
  }
  const t = text.toLowerCase();
  return {
    niche: best.score >= 2 ? best.niche : "Other",
    tags: KEYWORDS.filter((k) => new RegExp(String.raw`\b${k}`).test(t)),
    score: best.score,
    scores: Object.fromEntries(NICHES.map((n) => [n, h[n].count])),
  };
}

// Indian scripts by Unicode block. Devanagari is reported as Hindi (Marathi uses the same script).
const SCRIPTS: [string, RegExp][] = [
  ["Hindi", /[ऀ-ॿ]/], ["Bengali", /[ঀ-৿]/], ["Punjabi", /[਀-੿]/], ["Gujarati", /[઀-૿]/],
  ["Tamil", /[஀-௿]/], ["Telugu", /[ఀ-౿]/], ["Kannada", /[ಀ-೿]/], ["Malayalam", /[ഀ-ൿ]/],
];
// Romanised Hindi ("Hinglish") markers: common words that aren't English words too (no "to", "do", "log", "mat", "par").
const HINGLISH = new RegExp(String.raw`\b(${[
  "kya", "kaise", "kaisa", "kaisi", "kyu", "kyun", "kyon", "kab", "kahan", "kitna", "kitne", "hai", "hain", "hoon", "tha", "thi", "nahi", "nahin",
  "mein", "mai", "mera", "meri", "mere", "tera", "teri", "tere", "apna", "apni", "apne", "humne", "maine", "aap", "tum", "yeh", "woh",
  "wala", "wale", "wali", "bhai", "bhaiya", "yaar", "dost", "karo", "karna", "karke", "kiya", "kiye", "raha", "rahe", "rahi", "gaya", "gayi", "gaye",
  "diya", "liya", "bhi", "aur", "lekin", "sabse", "bahut", "bohot", "kuch", "kuchh", "toh", "aaj", "abhi", "pehli", "pehla", "baar", "ghar",
  "paisa", "paise", "dekho", "dekha", "sasta", "sasti", "lene", "kharido", "accha", "achha", "naya", "nayi", "wapas", "saath", "zindagi", "duniya", "ka", "ki", "ke",
].join("|")})\b`, "i");
const NAMED = ["Hindi", "Tamil", "Telugu", "Bengali", "Bangla", "Marathi", "Kannada", "Malayalam", "Gujarati", "Punjabi"];

/** Primary content language: a script or language name in ≥30% of recent titles (min 2), else English. */
// YouTube language codes → ScoutBlack language names ("hi", "en-IN", "ta"…).
const CODES: Record<string, string> = { hi: "Hindi", en: "English", ta: "Tamil", te: "Telugu", bn: "Bengali", mr: "Marathi", kn: "Kannada", ml: "Malayalam", gu: "Gujarati", pa: "Punjabi" };

/**
 * Primary content language. Best evidence first: the spoken-audio language creators set on their videos
 * (majority, if at least 40% of recent uploads declare one); otherwise scripts / language names / Hinglish
 * in titles and the channel description.
 */
export function contentLanguage(recent: YtVideo[], channelDescription = ""): string {
  const fromText = detectLanguage([...recent.map((v) => v.snippet.title), channelDescription, channelDescription]);
  const codes = recent.map((v) => CODES[(v.snippet.defaultAudioLanguage ?? "").split("-")[0].toLowerCase()]).filter(Boolean);
  if (recent.length && codes.length / recent.length >= 0.4) {
    const tally = codes.reduce<Record<string, number>>((m, l) => ({ ...m, [l]: (m[l] ?? 0) + 1 }), {});
    const declared = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
    // "English" is YouTube's default audio setting, often left untouched by Hindi and regional creators: when the
    // titles clearly say otherwise, believe the titles. Any other declared language is a deliberate choice.
    return declared === "English" && fromText !== "English" ? fromText : declared;
  }
  return fromText;
}

/** Primary language from text alone: a script, language name or Hinglish in ≥30% of samples (min 2), else English. */
export function detectLanguage(titles: string[]): string {
  if (!titles.length) return "English";
  const need = Math.max(2, Math.ceil(titles.length * 0.3));
  const count = (test: (t: string) => boolean) => titles.filter(test).length;
  let best = { lang: "English", n: 0 };
  for (const [lang, re] of SCRIPTS) { const n = count((t) => re.test(t)); if (n > best.n) best = { lang, n }; }
  for (const name of NAMED) {
    const n = count((t) => new RegExp(`\\b${name}\\b`, "i").test(t));
    if (n > best.n) best = { lang: name === "Bangla" ? "Bengali" : name, n };
  }
  const hinglish = count((t) => HINGLISH.test(t));
  if (hinglish > best.n) best = { lang: "Hindi", n: hinglish };
  return best.n >= need ? best.lang : "English";
}

/**
 * Known consumer-tech brands and retailers in India. A channel whose title IS one of these (optionally followed by
 * "India", "Official" or "Mobile") is the company, not a creator. Extend this list as new brands show up in seeds.
 */
export const KNOWN_BRANDS = [
  "nothing", "samsung", "oneplus", "apple", "google", "xiaomi", "redmi", "poco", "realme", "vivo", "oppo", "iqoo", "motorola", "lava",
  "infinix", "tecno", "itel", "honor", "asus", "lenovo", "hp", "dell", "acer", "sony", "lg", "jbl", "sennheiser", "bose", "skullcandy",
  "boat", "noise", "boult", "ptron", "mivi", "fire-boltt", "zebronics", "truke", "amazfit", "amazon", "flipkart", "croma", "reliance digital",
];
const BRAND_TITLE = new RegExp(`^(${KNOWN_BRANDS.join("|")})( india| official| mobiles?| global)*$`, "i");

/** Official brand/company channels aren't creators: they're kept for share of voice but out of creator search. */
export function isBrandChannel(ch: Pick<YtChannel, "snippet">): boolean {
  const text = `${ch.snippet.title}\n${ch.snippet.description ?? ""}`;
  return (
    BRAND_TITLE.test(ch.snippet.title.trim()) ||
    / - Topic$/.test(ch.snippet.title.trim()) || // YouTube's auto-generated pages for a game or artist ("Free Fire - Topic"), not a creator

    /\bofficial (youtube )?channel of\b|\bthe official (youtube )?channel\b|\bofficial account of\b|\bcustomer (care|support)\b|\bwelcome to the official\b/i.test(text)
  );
}

/** Sub-niche tags that recur: in at least 20% of recent uploads (titles + video tags), minimum 2 uploads. */
export function recurringTags(recent: YtVideo[]): string[] {
  if (!recent.length) return [];
  const need = Math.max(2, Math.ceil(recent.length * 0.2));
  const per = recent.map((v) => classify([v.snippet.title, ...(v.snippet.tags ?? [])].join(" ")).tags);
  return [...new Set(per.flat())].filter((t) => per.filter((ts) => ts.includes(t)).length >= need);
}

/** 90-day growth from stored daily snapshots; 0 until ~30 days of history exist (no history → no claim). */
export function growthFrom(snaps: Snapshot[], subsNow: number, today: Date): number {
  const DAY = 86_400_000;
  const old = snaps
    .map((s) => ({ ...s, age: (today.getTime() - new Date(s.takenOn).getTime()) / DAY }))
    .filter((s) => s.age >= 30 && s.age <= 120 && s.subs > 0)
    .sort((a, b) => Math.abs(a.age - 90) - Math.abs(b.age - 90))[0];
  return old ? Math.round(((subsNow - old.subs) / old.subs) * 1000) / 10 : 0;
}

/**
 * Authenticity is an estimate from public signals: healthy engagement and a plausible views-to-subscribers
 * ratio score high; near-zero engagement or views far below the subscriber base suggest bought followers.
 */
export function estimateAuthenticity(eng: number | null, avgViews: number, subs: number): number {
  let a = 72;
  if (eng === null) a += 0; // likes hidden by the creator: no engagement evidence either way
  else if (eng >= 2 && eng <= 15) a += 12;
  else if (eng < 0.8) a -= 18;
  else if (eng > 25) a -= 10;
  const ratio = subs ? avgViews / subs : 0;
  if (ratio >= 0.05 && ratio <= 0.8) a += 8;
  else if (ratio < 0.01) a -= 15;
  return clamp(Math.round(a), 40, 95);
}

export function deriveMetrics(ch: YtChannel, recent: YtVideo[], snaps: Snapshot[], today = new Date()): ChannelMetrics {
  const subs = n(ch.statistics.subscriberCount);
  // Videos under a week old are still collecting views: a daily uploader's last 20 would drag the median down. Use
  // settled videos when there are at least 3, else everything with views (new or rarely-posting channels).
  const viewed = recent.filter((v) => n(v.statistics.viewCount) > 0);
  const settled = viewed.filter((v) => today.getTime() - new Date(v.snippet.publishedAt).getTime() >= 7 * 86_400_000);
  const views = (settled.length >= 3 ? settled : viewed).map((v) => n(v.statistics.viewCount));
  const avgViews = Math.round(median(views));
  // creators can hide like counts (likeCount absent) — those videos say nothing about engagement
  const engs = recent
    .filter((v) => n(v.statistics.viewCount) > 0 && v.statistics.likeCount !== undefined)
    .map((v) => ((n(v.statistics.likeCount) + n(v.statistics.commentCount)) / n(v.statistics.viewCount)) * 100);
  const engKnown = engs.length > 0;
  const eng = engKnown ? Math.round(median(engs) * 10) / 10 : 0;

  // posting consistency: uploads in the last 90 days vs. a weekly cadence (≈13 uploads = 100)
  const recent90 = recent.filter((v) => today.getTime() - new Date(v.snippet.publishedAt).getTime() <= 90 * 86_400_000).length;
  const consistency = clamp(Math.round((recent90 / 13) * 100), 0, 100);

  // Niche from everything the channel says about itself; sub-niche tags only from what recurs in uploads.
  // Video descriptions are excluded from tags: creators paste the same affiliate/link list into every one.
  const seg = segment({ name: ch.snippet.title, about: [ch.snippet.description, ch.brandingSettings?.channel?.keywords].filter(Boolean).join("\n"), titles: recent.map((v) => v.snippet.title),
    categories: recent.map((v) => v.snippet.categoryId), topics: ch.topicDetails?.topicCategories });
  const tags = recurringTags(recent);
  const auth = estimateAuthenticity(engKnown ? eng : null, avgViews, subs);
  const language = contentLanguage(recent, ch.snippet.description);

  return {
    channelId: ch.id,
    name: ch.snippet.title,
    handle: ch.snippet.customUrl ?? ch.id,
    country: COUNTRY[ch.snippet.country ?? ""] ?? ch.snippet.country ?? "Unknown",
    niche: seg.niche,
    secondaryNiche: seg.secondary,
    nicheConfidence: seg.confidence,
    tags,
    subs,
    avgViews,
    eng,
    growth: growthFrom(snaps, subs, today),
    consistency,
    auth,
    suspicious: Math.max(1, Math.round((100 - auth) * 0.4)),
    language,
    isBrand: isBrandChannel(ch),
    topics: topicsFrom(recent.map((v) => [v.snippet.title, ...(v.snippet.tags ?? [])].join(" "))),
  };
}
