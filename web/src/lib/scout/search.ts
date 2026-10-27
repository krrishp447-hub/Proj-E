// One search over every creator: parse the brief, score everyone, return the best few with summary numbers.
// Runs on the server for /demo (so the browser never downloads every creator) and locally for the homepage sample.
import type { Creator } from "./data.ts";
import { contextualize, describe, parseBrief, score, understoodNothing, type Match } from "./engine.ts";

export type SearchResult = {
  query: string;
  understood: string[]; // chips: what the parser understood
  unread: boolean; // a non-empty brief ScoutBlack couldn't read at all (logged, and the UI says so)
  total: number; // creators searched
  fitCount: number; // creators that fit every part of the brief
  missCount: number; // near misses
  medianScore: number; // across all fits, not just the returned ones
  avgAuth: number;
  proven: number;
  fits: Match[]; // best fits, best first (at most `limit`)
  misses: Match[]; // best near misses (at most `missLimit`)
  pinned: Match[]; // requested creators (e.g. the shortlist), scored against this brief wherever they rank
};

// Shared by the demo page (server) and ScoutApp (client): a constant exported from a "use client" module is only a
// client reference on the server, not the string (it crashed /demo without ?q=).
export const DEFAULT_QUERY = "Indian YouTube tech creators who review earbuds, 50K–500K subs, strong engagement";

export const HOME_RESULTS = 6; // the homepage shows this many matches, then pricing and the full app
export const RESULT_LIMIT = 100;
export const MISS_LIMIT = 50;

export function searchAll(creators: Creator[], query: string, opts: { limit?: number; missLimit?: number; pinned?: string[] } = {}): SearchResult {
  const brief = contextualize(parseBrief(query), creators);
  const scored = creators.map((c) => score(c, brief));
  const byScore = (a: Match, b: Match) => b.score - a.score || b.creator.subs - a.creator.subs;
  const fits = scored.filter((m) => m.fits).sort(byScore);
  const misses = scored.filter((m) => !m.fits).sort(byScore);
  const scores = fits.map((m) => m.score).sort((a, b) => a - b);
  const want = new Set(opts.pinned ?? []);
  return {
    query,
    understood: describe(brief),
    unread: !!query.trim() && understoodNothing(brief),
    total: creators.length,
    fitCount: fits.length,
    missCount: misses.length,
    medianScore: scores.length ? scores[Math.floor(scores.length / 2)] : 0,
    avgAuth: fits.length ? Math.round(fits.reduce((s, m) => s + m.creator.auth, 0) / fits.length) : 0,
    proven: fits.filter((m) => m.creator.proven).length,
    fits: fits.slice(0, opts.limit ?? RESULT_LIMIT),
    misses: misses.slice(0, opts.missLimit ?? MISS_LIMIT),
    pinned: want.size ? scored.filter((m) => want.has(m.creator.channelId)) : [],
  };
}
