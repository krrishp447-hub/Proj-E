import { NICHES, type Creator, type Platform } from "./data.ts";

export type Brief = {
  niche?: string;
  platform?: Platform;
  country?: string;
  keywords: string[];
  minSubs?: number;
  maxSubs?: number;
  wantEng?: boolean;
  wantGrowth?: boolean;
};

export const KEYWORDS = ["tws", "earbud", "audio", "anc", "headphone", "smartphone", "gaming", "recipe", "investing", "fashion", "coding", "programming", "travel", "fitness", "budget", "premium"];

export const SYNONYMS: Record<string, string[]> = {
  Tech: ["gadget", "earbud", "tws", "smartphone", "audio"],
  Food: ["cook", "recipe", "chef", "kitchen"],
  Fitness: ["gym", "workout", "nutrition"],
  Finance: ["money", "invest", "stock", "personal finance"],
  Gaming: ["gamer", "esports"],
  Fashion: ["beauty", "style", "makeup"],
  Travel: ["trip", "tourism"],
};

/** "50k", "1.2m", "500000" → number of followers. */
const amount = (n: string, unit = "") => Number(n) * (unit === "m" ? 1e6 : unit === "k" ? 1e3 : 1);

/** Plain-English brief → structured filters. Transparent heuristics, not ML. */
export function parseBrief(text: string): Brief {
  const t = text.toLowerCase();
  // word-start match: "earbud" finds "earbuds", but "anc" doesn't fire inside "finance"
  const b: Brief = { keywords: KEYWORDS.filter((k) => new RegExp(`\\b${k}`).test(t)) };
  b.niche = NICHES.find((n) => new RegExp(`\\b(${[n.toLowerCase(), ...(SYNONYMS[n] ?? [])].join("|")})`).test(t));
  if (/youtube|\byt\b/.test(t)) b.platform = "YouTube";
  else if (/insta|\breels?\b|\big\b/.test(t)) b.platform = "Instagram";
  if (/\bindia(n)?\b/.test(t)) b.country = "India";
  else if (/\bus\b|\bu\.s\.|\bamerica(n)?\b/.test(t)) b.country = "US";

  const range = t.match(/(\d+(?:\.\d+)?)\s*([km])?\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*([km])/);
  const under = t.match(/(?:under|below|less than|<)\s*(\d+(?:\.\d+)?)\s*([km])/);
  const over = t.match(/(?:over|above|more than|>)\s*(\d+(?:\.\d+)?)\s*([km])|(\d+(?:\.\d+)?)\s*([km])\s*\+/);
  if (range) {
    b.minSubs = amount(range[1], range[2] ?? range[4]);
    b.maxSubs = amount(range[3], range[4]);
  } else if (under) {
    b.minSubs = 0;
    b.maxSubs = amount(under[1], under[2]);
  } else if (over) {
    b.minSubs = over[1] ? amount(over[1], over[2]) : amount(over[3], over[4]);
    b.maxSubs = Infinity;
  }
  if (/strong engagement|high engagement|good engagement|engaged/.test(t)) b.wantEng = true;
  if (/growing|fast.?grow|rising|up.?and.?coming/.test(t)) b.wantGrowth = true;
  return b;
}

export const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".0", "")}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${n}`;

/** Human-readable chips for what the parser understood. */
export function describe(b: Brief): string[] {
  const out: string[] = [];
  if (b.niche) out.push(b.niche);
  if (b.platform) out.push(b.platform);
  if (b.country) out.push(b.country);
  const extra = b.keywords.filter((k) => k !== b.niche?.toLowerCase()); // don't echo the niche twice
  if (extra.length) out.push(extra.join(", "));
  if (b.minSubs !== undefined && b.maxSubs !== undefined)
    out.push(b.maxSubs === Infinity ? `${fmt(b.minSubs)}+` : b.minSubs === 0 ? `under ${fmt(b.maxSubs)}` : `${fmt(b.minSubs)}–${fmt(b.maxSubs)}`);
  if (b.wantEng) out.push("high engagement");
  if (b.wantGrowth) out.push("fast-growing");
  return out;
}

export type Signal = { label: string; points: number };
export type Match = { creator: Creator; score: number; signals: Signal[]; fits: boolean };

/**
 * Absolute 0–100 match: points earned ÷ the most this brief could award.
 * (A weak query no longer makes its least-bad result look like a 99.)
 */
export function score(c: Creator, b: Brief): Match {
  const signals: Signal[] = [];
  let max = 0;
  const add = (label: string, points: number, possible: number) => {
    max += possible;
    if (Math.round(points) !== 0) signals.push({ label, points: Math.round(points) });
  };
  let fits = true;
  const gate = (ok: boolean, label: string, pts: number, miss: string, penalty: number) => {
    if (ok) add(label, pts, pts);
    else { add(miss, -penalty, pts); fits = false; }
  };

  if (b.niche) gate(c.niche === b.niche, `Niche · ${c.niche}`, 20, "Different niche", 25);
  if (b.platform) gate(c.platform === b.platform, `Platform · ${c.platform}`, 10, "Different platform", 15);
  if (b.country) gate(c.country === b.country, `Audience · ${c.country}`, 10, "Different geography", 15);
  if (b.keywords.length) {
    const hits = b.keywords.filter((k) => c.tags.some((t) => t.includes(k))).length;
    add(hits ? `Sub-niche · ${hits}/${b.keywords.length} match` : "No sub-niche match", (hits / b.keywords.length) * 20, 20);
  }
  if (b.minSubs !== undefined && b.maxSubs !== undefined)
    gate(c.subs >= b.minSubs && c.subs <= b.maxSubs, "In size range", 10, c.subs > b.maxSubs ? "Above size range" : "Below size range", 8);

  add(`Engagement ${c.eng}%`, (Math.min(c.eng, 9) / 9) * 12, 12);
  add(`Growth +${c.growth}%`, (Math.min(c.growth, 20) / 20) * 6, 6);
  add(`Authenticity ${c.auth}`, ((c.auth - 60) / 40) * 8, 8);
  add(`Track record · ${c.repeat}% repeat`, (c.repeat / 100) * 6 + (c.proven ? 4 : 0), 10);
  if (b.wantEng) add("High engagement", c.eng >= 6.5 ? 6 : 0, 6);
  if (b.wantGrowth) add("Fast-growing", c.growth >= 10 ? 6 : 0, 6);

  const earned = signals.reduce((s, x) => s + x.points, 0);
  return { creator: c, score: Math.max(0, Math.min(100, Math.round((earned / max) * 100))), signals, fits };
}

/** Estimated shared audience between two creators (0–93%), from geo, niche, age, gender and platform. */
export function overlap(a: Creator, b: Creator): number {
  let s = 0;
  // Without connected demographics, fall back to channel country and neutral midpoints.
  const market = (c: Creator) => c.geo[0]?.[0] ?? c.country;
  if (market(a) === market(b)) s += 34;
  if (a.niche === b.niche) s += 24;
  s += a.age.length && b.age.length ? Math.max(0, 20 - a.age.reduce((d, v, i) => d + Math.abs(v - b.age[i]), 0) / 2) : 10;
  s += a.male !== null && b.male !== null ? Math.max(0, 14 - Math.abs(a.male - b.male) / 2) : 7;
  if (a.platform === b.platform) s += 6;
  return Math.min(93, Math.round(s));
}
