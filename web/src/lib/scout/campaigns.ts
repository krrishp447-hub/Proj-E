// Campaign, deal and deliverable model + pure logic (matching, roll-ups, fair rates, share of voice).
// No I/O: the demo, the server ingest and the tests all run the same functions.

export type Platform = "YouTube" | "Instagram";
/** Creator reference: array index in the demo, YouTube channel id on the server. */
export type CreatorRef = number | string;

export type TrackingRules = {
  hashtags: string[]; // "#kestrelbudsx"
  links: string[]; // "kestrel.audio/x" — tracking/UTM link fragments
  mentions: string[]; // "@kestrelaudio"
  keywords: string[]; // "kestrel buds x"
};

export type Campaign<Id extends CreatorRef = number> = {
  id: string;
  brand: string;
  name: string;
  status: "Planned" | "Live" | "Completed";
  start: string; // ISO date
  end: string;
  rules: TrackingRules;
  creatorIds: Id[]; // contracted creators
};

export type VideoPost<Id extends CreatorRef = number> = {
  id: string;
  creatorId: Id;
  platform: Platform;
  title: string;
  description: string;
  publishedAt: string; // ISO
  url: string;
  paidFlag?: boolean; // platform "paid promotion" flag — only readable when the creator has connected their channel
  views: number;
  likes: number;
  comments: number;
  daily: number[]; // cumulative views per day since publish (index 0 = publish day)
};

export type MatchStatus = "filed" | "review" | "organic" | "none";
export type MatchResult = { confidence: number; reasons: string[]; status: MatchStatus; disclosed: boolean; linked: boolean };

export const STAGES = ["Inbound", "Negotiating", "Contracted", "In production", "Live", "Paid"] as const;
export type Stage = (typeof STAGES)[number];

export type Offer = { by: "brand" | "creator"; fee: number; deliverables: string; usage: string; timeline: string; at: string; note?: string };

export type Deliverable<Id extends CreatorRef = number> = {
  id: string;
  dealId: string;
  campaignId?: string;
  creatorId: Id;
  kind: "YouTube video" | "YouTube Short" | "Instagram Reel" | "Instagram Story";
  due: string; // ISO date
  status: "Planned" | "In production" | "Submitted" | "Live";
  videoId?: string; // set when the post goes live (auto-linked by the matcher)
  projectedViews: number;
  fee: number;
};

export type Deal = {
  id: string;
  creatorId: number;
  brand: string;
  campaignId?: string;
  title: string;
  stage: Stage;
  requirements: string[];
  offers: Offer[]; // full negotiation history, oldest first — both sides see the same thread
};

const DAY = 86_400_000;
const lc = (s: string) => s.toLowerCase();
export const DISCLOSURE = /(#ad\b|#sponsored|#paidpartnership|#collab|paid promotion|sponsored by|in partnership with)/i;

/** Thresholds for filing. Above FILE → straight into the campaign folder; between REVIEW and FILE → human check. */
export const FILE = 60;
export const REVIEW = 30;

/**
 * How confident are we that this upload belongs to this campaign? Public signals only, each with a reason the
 * brand can audit. Creator-connected channels add the platform's paid-promotion flag.
 */
export function matchVideo<Id extends CreatorRef>(v: VideoPost<Id>, c: Campaign<Id>): MatchResult {
  const title = lc(v.title), body = lc(`${v.title}\n${v.description}`);
  const reasons: string[] = [];
  let conf = 0;
  const linked = c.rules.links.some((l) => body.includes(lc(l)));
  if (linked) { conf += 60; reasons.push("Tracking link"); }
  for (const h of c.rules.hashtags) if (body.includes(lc(h))) { conf += 40; reasons.push(h); break; }
  for (const m of c.rules.mentions) if (body.includes(lc(m))) { conf += 25; reasons.push(m); break; }
  const kw = c.rules.keywords.find((k) => title.includes(lc(k))) ?? c.rules.keywords.find((k) => body.includes(lc(k)));
  if (kw) { const inTitle = title.includes(lc(kw)); conf += inTitle ? 30 : 15; reasons.push(`“${kw}”${inTitle ? " in title" : ""}`); }
  if (v.paidFlag) { conf += 30; reasons.push("Paid-promotion flag"); }

  const t = new Date(v.publishedAt).getTime();
  const inWindow = t >= new Date(c.start).getTime() && t <= new Date(c.end).getTime() + DAY;
  const disclosed = DISCLOSURE.test(body) || !!v.paidFlag;
  if (!inWindow || !conf) return { confidence: 0, reasons: inWindow ? [] : ["Outside campaign dates"], status: "none", disclosed, linked };

  const confidence = Math.min(100, conf);
  const contracted = c.creatorIds.includes(v.creatorId);
  const status: MatchStatus = !contracted ? (confidence >= REVIEW ? "organic" : "none") : confidence >= FILE ? "filed" : confidence >= REVIEW ? "review" : "none";
  return { confidence, reasons, status, disclosed, linked };
}

export type CampaignRollup = {
  posts: number;
  views: number;
  engagements: number;
  engRate: number; // %
  spend: number; // fees of deliverables that are live
  cpv: number; // ₹ per view
  cpe: number; // ₹ per engagement
  deliveredVsPromised: number; // actual ÷ projected views on live deliverables
  onTime: number; // % of live deliverables posted on or before due date
  disclosed: number; // % of filed posts carrying a disclosure
  daily: { day: string; views: number }[]; // cumulative campaign views by date
  byCreator: { creatorId: number; posts: number; views: number; engRate: number; projected: number; fee: number }[];
};

/** Everything a brand otherwise collects by opening each video: totals, efficiency, delivery and a timeline. */
export function rollup(filed: { video: VideoPost; match: MatchResult }[], deliverables: Deliverable[], today: string): CampaignRollup {
  const views = filed.reduce((s, f) => s + f.video.views, 0);
  const engagements = filed.reduce((s, f) => s + f.video.likes + f.video.comments, 0);
  // only deliverables whose post is in the folder count — spend and views must cover the same posts
  const filedIds = new Set(filed.map((f) => f.video.id));
  const live = deliverables.filter((d) => d.status === "Live" && d.videoId && filedIds.has(d.videoId));
  const liveVideo = (d: Deliverable) => filed.find((f) => f.video.id === d.videoId)?.video;
  const spend = live.reduce((s, d) => s + d.fee, 0);
  const projected = live.reduce((s, d) => s + d.projectedViews, 0);
  const delivered = live.reduce((s, d) => s + (liveVideo(d)?.views ?? 0), 0);
  const onTime = live.filter((d) => { const v = liveVideo(d); return v && v.publishedAt.slice(0, 10) <= d.due; }).length;

  // campaign timeline: sum each video's cumulative curve onto calendar days
  const first = filed.length ? Math.min(...filed.map((f) => new Date(f.video.publishedAt.slice(0, 10)).getTime())) : new Date(today).getTime();
  const days = Math.max(1, Math.round((new Date(today).getTime() - first) / DAY) + 1);
  const daily = Array.from({ length: days }, (_, i) => {
    const t = first + i * DAY;
    const v = filed.reduce((s, f) => {
      const k = Math.round((t - new Date(f.video.publishedAt.slice(0, 10)).getTime()) / DAY);
      return k < 0 ? s : s + (f.video.daily[Math.min(k, f.video.daily.length - 1)] ?? 0);
    }, 0);
    return { day: new Date(t).toISOString().slice(0, 10), views: v };
  });

  const ids = [...new Set([...filed.map((f) => f.video.creatorId), ...deliverables.map((d) => d.creatorId)])];
  const byCreator = ids.map((creatorId) => {
    const mine = filed.filter((f) => f.video.creatorId === creatorId).map((f) => f.video);
    const v = mine.reduce((s, x) => s + x.views, 0), e = mine.reduce((s, x) => s + x.likes + x.comments, 0);
    const ds = deliverables.filter((d) => d.creatorId === creatorId);
    return { creatorId, posts: mine.length, views: v, engRate: v ? (e / v) * 100 : 0, projected: ds.reduce((s, d) => s + d.projectedViews, 0), fee: ds.reduce((s, d) => s + d.fee, 0) };
  }).sort((a, b) => b.views - a.views);

  return {
    posts: filed.length,
    views,
    engagements,
    engRate: views ? (engagements / views) * 100 : 0,
    spend,
    cpv: views ? spend / views : 0,
    cpe: engagements ? spend / engagements : 0,
    deliveredVsPromised: projected ? delivered / projected : 0,
    onTime: live.length ? (onTime / live.length) * 100 : 0,
    disclosed: filed.length ? (filed.filter((f) => f.match.disclosed).length / filed.length) * 100 : 0,
    daily,
    byCreator,
  };
}

/** Deliverable is late if it's due and not live. */
export const isLate = (d: Deliverable, today: string) => d.status !== "Live" && d.due < today;

/**
 * Transparent fair-rate range for one dedicated video: average views × a CPM band, scaled by engagement.
 * The band is a configurable assumption, shown to both sides — not a market fact.
 */
export const CPM_BAND = { low: 400, high: 900 }; // ₹ per 1,000 views (illustrative default)
export function fairRate(avgViews: number, engRate: number, band = CPM_BAND) {
  const engFactor = Math.max(0.7, Math.min(1.5, engRate / 5));
  const round = (x: number) => Math.round(x / 1000) * 1000;
  return { low: round((avgViews / 1000) * band.low * engFactor), high: round((avgViews / 1000) * band.high * engFactor), engFactor };
}

/** Next stage in the pipeline (Paid is terminal). */
export const nextStage = (s: Stage): Stage => STAGES[Math.min(STAGES.indexOf(s) + 1, STAGES.length - 1)];

export type SovRow = { brand: string; mentions: number; views: number; share: number };

/**
 * Share of voice in a category: of all views on posts that mention any tracked brand, how much mentions each one.
 * A post mentioning two brands counts toward both.
 */
export function shareOfVoice(posts: VideoPost[], brands: Record<string, string[]>, platform?: Platform): SovRow[] {
  const pool = posts.filter((p) => !platform || p.platform === platform);
  const rows = Object.entries(brands).map(([brand, terms]) => {
    const hits = pool.filter((p) => terms.some((t) => lc(`${p.title} ${p.description}`).includes(lc(t))));
    return { brand, mentions: hits.length, views: hits.reduce((s, p) => s + p.views, 0), share: 0 };
  });
  const total = rows.reduce((s, r) => s + r.views, 0);
  return rows.map((r) => ({ ...r, share: total ? (r.views / total) * 100 : 0 })).sort((a, b) => b.views - a.views);
}
