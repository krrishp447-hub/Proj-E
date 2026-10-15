// Brand mentions across tracked uploads: which videos name a brand, and whether they carry an ad disclosure.
import { DISCLOSURE } from "./campaigns.ts";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const bounded = (alts: string) => `(^|[^A-Za-z0-9_])(${alts})($|[^A-Za-z0-9_])`;

/**
 * Tracked terms as typed by a brand:
 *   "Noise Buds", "#AcmeSound"  → match, case-insensitive, whole term ("Noise" matches "Noise Buds", not "noises")
 *   "boAt"                      → stylized casing (lowercase→uppercase inside a word) matches case-sensitively, so "boat" doesn't count
 *   "-noise cancelling"         → exclusion: that phrase is ignored wherever it appears, so it can't trigger a match
 */
export function parseTerms(terms: string[]) {
  const clean = terms.map((t) => t.trim()).filter((t) => t.replace(/^-/, "").trim().length >= 2);
  const exclude = clean.filter((t) => t.startsWith("-")).map((t) => t.slice(1).trim());
  const include = clean.filter((t) => !t.startsWith("-"));
  return { include, exclude };
}

/**
 * Case-insensitive superset pattern for the database prefilter. The same string works as a JS RegExp and as a
 * Postgres `~*` pattern; summarizeMentions then applies the exact rules (casing, exclusions).
 */
export function mentionPattern(terms: string[]): string | null {
  const { include } = parseTerms(terms);
  return include.length ? bounded(include.map(escape).join("|")) : null;
}

// "boAt", "iPhone": a lowercase→uppercase switch inside a word. Not "Acme Buds" (two words), not hashtags (casing varies).
const stylized = (t: string) => !t.startsWith("#") && /[a-z][A-Z]/.test(t);

/** Exact matcher: true if the text names a tracked term, after removing excluded phrases. */
export function mentionMatcher(terms: string[]): (text: string) => boolean {
  const { include, exclude } = parseTerms(terms);
  const res = include.map((t) => new RegExp(bounded(escape(t)), stylized(t) ? "" : "i"));
  const ex = exclude.length ? new RegExp(exclude.map(escape).join("|"), "gi") : null;
  return (text) => {
    const t = ex ? text.replace(ex, " ") : text;
    return res.some((re) => re.test(t));
  };
}

export type Mention = { videoId: string; title: string; url: string; views: number; publishedAt: string; creator: string; handle: string; disclosed: boolean };
type Row = Omit<Mention, "disclosed"> & { description: string };

export function summarizeMentions(rows: Row[], terms: string[]) {
  const named = mentionMatcher(terms);
  const hits: Mention[] = rows
    .filter((r) => named(`${r.title}\n${r.description}`))
    .map(({ description, ...r }) => ({ ...r, disclosed: DISCLOSURE.test(`${r.title}\n${description}`) }))
    .sort((a, b) => b.views - a.views);
  return {
    videos: hits.length,
    views: hits.reduce((s, m) => s + m.views, 0),
    creators: new Set(hits.map((m) => m.handle)).size,
    disclosedPct: hits.length ? Math.round((hits.filter((m) => m.disclosed).length / hits.length) * 100) : 0,
    top: hits.slice(0, 8),
  };
}
