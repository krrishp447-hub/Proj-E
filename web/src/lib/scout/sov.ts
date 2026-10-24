// Share of voice on YouTube: of all views on tracked creators' uploads that name any brand in a set, how much names each.
// Pure; the server scans stored videos once per brand set (server/sov.ts). Same matching rules as brand mentions.
import { DISCLOSURE } from "./campaigns.ts";
import { mentionMatcher, mentionPattern } from "./mentions.ts";

export type BrandTerms = { name: string; terms: string[] };
export type SovVideo = { videoId: string; title: string; description: string; url: string; views: number; publishedAt: string; channelId: string; creator: string };

export type SovBrand = {
  name: string;
  videos: number;
  views: number;
  share: number; // % of all brand-naming views (a video naming two brands counts for both)
  paidViews: number; // views on videos with an ad disclosure; the rest is earned (organic)
  creators: number;
  weekly: number[]; // views per week, oldest first
};
export type SovPost = { videoId: string; title: string; url: string; views: number; publishedAt: string; creator: string; brands: string[]; disclosed: boolean };
export type CreatorVoice = { channelId: string; creator: string; views: Record<string, number> }; // brand → views naming it
export type SovResult = { days: number; brands: SovBrand[]; posts: SovPost[]; creators: CreatorVoice[] };

/** One prefilter pattern for the whole set (the database scan); exact per-brand matching happens in computeSov. */
export const sovPattern = (brands: BrandTerms[]) => mentionPattern(brands.flatMap((b) => b.terms));

export function computeSov(videos: SovVideo[], brands: BrandTerms[], days: number, now = new Date()): SovResult {
  const weeks = Math.max(1, Math.ceil(days / 7));
  const matchers = brands.map((b) => ({ name: b.name, named: mentionMatcher(b.terms) }));
  const posts = videos
    .map((v) => {
      const text = `${v.title}\n${v.description}`;
      return { v, brands: matchers.filter((m) => m.named(text)).map((m) => m.name), disclosed: DISCLOSURE.test(text) };
    })
    .filter((p) => p.brands.length);

  const rows = brands.map((b) => {
    const mine = posts.filter((p) => p.brands.includes(b.name));
    const weekly = Array<number>(weeks).fill(0);
    for (const p of mine) {
      const ago = Math.floor((now.getTime() - new Date(p.v.publishedAt).getTime()) / (7 * 86_400_000));
      if (ago >= 0 && ago < weeks) weekly[weeks - 1 - ago] += p.v.views;
    }
    return {
      name: b.name,
      videos: mine.length,
      views: mine.reduce((s, p) => s + p.v.views, 0),
      share: 0,
      paidViews: mine.filter((p) => p.disclosed).reduce((s, p) => s + p.v.views, 0),
      creators: new Set(mine.map((p) => p.v.channelId)).size,
      weekly,
    };
  });
  const total = rows.reduce((s, r) => s + r.views, 0);
  for (const r of rows) r.share = total ? Math.round((r.views / total) * 1000) / 10 : 0;

  const byCreator = new Map<string, CreatorVoice>();
  for (const p of posts) {
    const c = byCreator.get(p.v.channelId) ?? { channelId: p.v.channelId, creator: p.v.creator, views: {} };
    for (const b of p.brands) c.views[b] = (c.views[b] ?? 0) + p.v.views;
    byCreator.set(p.v.channelId, c);
  }
  const reach = (c: CreatorVoice) => Object.values(c.views).reduce((s, v) => s + v, 0);

  return {
    days,
    brands: rows.sort((a, b) => b.views - a.views),
    posts: posts.sort((a, b) => b.v.views - a.v.views).slice(0, 30).map((p) => ({
      videoId: p.v.videoId, title: p.v.title, url: p.v.url, views: p.v.views, publishedAt: p.v.publishedAt, creator: p.v.creator, brands: p.brands, disclosed: p.disclosed,
    })),
    creators: [...byCreator.values()].sort((a, b) => reach(b) - reach(a)).slice(0, 300),
  };
}

/** The outreach list: creators who named a competitor but never you, biggest competitor reach first. */
export function opportunities(r: SovResult, you: string, max = 20) {
  return r.creators
    .filter((c) => !c.views[you])
    .map((c) => ({ ...c, competitorViews: Object.values(c.views).reduce((s, v) => s + v, 0), competitors: Object.keys(c.views) }))
    .sort((a, b) => b.competitorViews - a.competitorViews)
    .slice(0, max);
}

/** Profile text → competitors. One per line, "Name: term, term" (or just "Name", which is its own term). */
export function parseCompetitors(text: string): BrandTerms[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 6).map((line) => {
    const i = line.indexOf(":");
    const name = (i > 0 ? line.slice(0, i) : line).trim().slice(0, 60);
    const terms = (i > 0 ? line.slice(i + 1).split(",") : [name]).map((t) => t.trim()).filter(Boolean).slice(0, 8);
    return { name, terms: terms.length ? terms : [name] };
  }).filter((b) => b.name);
}
export const formatCompetitors = (bs: BrandTerms[]) => bs.map((b) => (b.terms.length === 1 && b.terms[0] === b.name ? b.name : `${b.name}: ${b.terms.join(", ")}`)).join("\n");
