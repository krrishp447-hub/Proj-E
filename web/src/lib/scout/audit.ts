// Data-quality audit, run on every 100 newly added creators (server/audit.ts). Pure: given the stored rows, it re-derives
// what should be there and compares. Four checks:
//   1. segregation    — re-segmenting each channel from its stored name/description/titles gives the stored niche
//   2. golden set     — well-known channels sit in the niche everyone knows they belong to
//   3. calculations   — engagement and average views recomputed from stored video stats match; authenticity maths holds
//   4. sanity & drift — every value in range; no niche swallows the batch; "Other" stays small
import { NICHES } from "./data.ts";
import { LANGUAGES } from "./engine.ts";
import { segment } from "./segment.ts";

export type AuditVideo = { views: number; likes: number | null; comments: number }; // likes null = hidden by the creator
export type AuditRow = {
  channelId: string; name: string; about: string; niche: string; niche2: string | null; nicheConf: number; language: string;
  subs: number; avgViews: number; eng: number; auth: number; suspicious: number; consistency: number;
  titles: string[]; videos: AuditVideo[]; // the channel's most recent uploads, newest first (≤ 20)
  categories?: (string | null)[]; topics?: string[]; // YouTube's genre signals (segment.ts)
};
export type Check = { name: string; passed: boolean; summary: string; failures: string[] };

/** Channels whose niche isn't in doubt. Only those present in the database are checked. */
export const GOLDEN: Record<string, string> = {
  "MC STAN": "Music", "Sidhu Moose Wala": "Music", "Yo Yo Honey Singh": "Music",
  "Technical Guruji": "Tech", "Trakin Tech": "Tech", "Manoj Saru": "Tech", "GT Hindi": "Tech",
  "ChuChuTV Bangla": "Kids", "infobells - Tamil": "Kids",
  "ABP ANANDA": "News", "Zee 24 Taas": "News",
  "Technoblade": "Gaming", "Aakash Chopra": "Sports",
};

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (k: number, n: number) => (n ? Math.round((k / n) * 100) : 100);

export const THRESHOLDS = { segregation: 90, calculations: 95, maxNicheShare: 50, maxOther: 30 };

export function checkSegregation(rows: AuditRow[]): Check {
  const judged = rows.filter((r) => r.titles.length >= 3);
  const wrong = judged.filter((r) => segment({ name: r.name, about: r.about, titles: r.titles, categories: r.categories, topics: r.topics }).niche !== r.niche);
  const ok = pct(judged.length - wrong.length, judged.length);
  return {
    name: "Segregation is consistent", passed: ok >= THRESHOLDS.segregation,
    summary: `${ok}% of ${judged.length} channels re-segment to their stored niche (need ≥ ${THRESHOLDS.segregation}%)`,
    failures: wrong.slice(0, 5).map((r) => `${r.name}: stored ${r.niche}, re-derived ${segment({ name: r.name, about: r.about, titles: r.titles, categories: r.categories, topics: r.topics }).niche}`),
  };
}

export function checkGolden(golden: { name: string; niche: string }[]): Check {
  const wrong = golden.filter((g) => GOLDEN[g.name] && GOLDEN[g.name] !== g.niche);
  return {
    name: "Known channels are in the right niche", passed: wrong.length === 0,
    summary: `${golden.length - wrong.length}/${golden.length} known channels correct`,
    failures: wrong.map((g) => `${g.name}: ${g.niche}, should be ${GOLDEN[g.name]}`),
  };
}

export function checkCalculations(rows: AuditRow[]): Check {
  const judged = rows.filter((r) => r.videos.length >= 3);
  const failures: string[] = [];
  let good = 0;
  for (const r of judged) {
    const views = median(r.videos.map((v) => v.views).filter((v) => v > 0));
    // hidden likes carry no engagement evidence; a genuine 0 does (same rule as deriveMetrics)
    const engs = r.videos.filter((v) => v.views > 0 && v.likes !== null).map((v) => (((v.likes ?? 0) + v.comments) / v.views) * 100);
    const eng = engs.length ? Math.round(median(engs) * 10) / 10 : 0;
    const viewsOk = Math.abs(views - r.avgViews) <= Math.max(2, r.avgViews * 0.02); // views tick up between ingest and save
    const engOk = Math.abs(eng - r.eng) <= 0.3;
    const susOk = r.suspicious === Math.max(1, Math.round((100 - r.auth) * 0.4));
    if (viewsOk && engOk && susOk) good++;
    else if (failures.length < 5) failures.push(`${r.name}: ${!viewsOk ? `avg views ${r.avgViews} vs ${Math.round(views)} recomputed; ` : ""}${!engOk ? `engagement ${r.eng}% vs ${eng}%; ` : ""}${!susOk ? `suspicious ${r.suspicious}% doesn't follow authenticity ${r.auth}` : ""}`.replace(/; $/, ""));
  }
  const ok = pct(good, judged.length);
  return {
    name: "Calculations are correct", passed: ok >= THRESHOLDS.calculations,
    summary: `${ok}% of ${judged.length} channels: avg views, engagement and suspicious-% recompute correctly (need ≥ ${THRESHOLDS.calculations}%)`,
    failures,
  };
}

export function checkSanity(rows: AuditRow[]): Check {
  const failures: string[] = [];
  const bad = (r: AuditRow, why: string) => failures.length < 5 && failures.push(`${r.name}: ${why}`);
  for (const r of rows) {
    if (!(r.eng >= 0 && r.eng <= 100)) bad(r, `engagement ${r.eng}%`);
    if (r.subs < 0 || r.avgViews < 0) bad(r, "negative counts");
    if (!(r.consistency >= 0 && r.consistency <= 100)) bad(r, `consistency ${r.consistency}`);
    if (!(r.auth >= 40 && r.auth <= 95)) bad(r, `authenticity ${r.auth}`);
    if (![...NICHES, "Other"].includes(r.niche)) bad(r, `unknown niche ${r.niche}`);
    if (r.niche2 && (r.niche2 === r.niche || !NICHES.includes(r.niche2))) bad(r, `bad secondary niche ${r.niche2}`);
    if (!(r.nicheConf >= 0 && r.nicheConf <= 1)) bad(r, `confidence ${r.nicheConf}`);
    if (!LANGUAGES.includes(r.language)) bad(r, `unknown language ${r.language}`);
  }
  const counts = rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.niche]: (m[r.niche] ?? 0) + 1 }), {});
  const [topNiche, top] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];
  const topShare = pct(top, rows.length), other = pct(counts.Other ?? 0, rows.length);
  if (topShare > THRESHOLDS.maxNicheShare) failures.push(`${topNiche} is ${topShare}% of the batch (max ${THRESHOLDS.maxNicheShare}%): discovery or segregation is skewed`);
  if (other > THRESHOLDS.maxOther) failures.push(`"Other" is ${other}% of the batch (max ${THRESHOLDS.maxOther}%): niche vocabulary is missing a genre`);
  return {
    name: "Values are sane, mix isn't skewed", passed: failures.length === 0,
    summary: `${rows.length} channels in range · largest niche ${topNiche} ${topShare}% · Other ${other}%`,
    failures,
  };
}

export function auditBatch(rows: AuditRow[], golden: { name: string; niche: string }[]): Check[] {
  return [checkSegregation(rows), checkGolden(golden), checkCalculations(rows), checkSanity(rows)];
}
