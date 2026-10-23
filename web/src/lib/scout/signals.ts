// Brand-relevant signals from a channel's recent uploads. Pure; computed at ingest and backfilled from stored videos.
import { DISCLOSURE } from "./campaigns.ts";

export type UploadLite = { title: string; description?: string; publishedAt: string };

/** Days since the newest upload (null if none). */
export function daysSinceUpload(uploads: UploadLite[], today = new Date()): number | null {
  const newest = Math.max(...uploads.map((u) => new Date(u.publishedAt).getTime()).filter(Number.isFinite));
  return Number.isFinite(newest) ? Math.max(0, Math.floor((today.getTime() - newest) / 86_400_000)) : null;
}

/**
 * Share of recent uploads that disclose a sponsorship (#ad, "sponsored by", "paid promotion"…), 0–100.
 * null when descriptions aren't available (they're cleared for pruned channels), since disclosures mostly live there.
 */
export function sponsoredShare(uploads: UploadLite[]): number | null {
  if (!uploads.length || uploads.every((u) => !u.description)) return null;
  const ads = uploads.filter((u) => DISCLOSURE.test(`${u.title}\n${u.description ?? ""}`)).length;
  return Math.round((ads / uploads.length) * 100);
}

// Words a brand-safety reviewer would flag in titles. Whole words only; deliberately short and unambiguous
// ("MC" is a rapper's title, "kill" is normal in gaming, "nude" is a lipstick shade, "matka" a silk, GTA has a casino heist).
const SAFETY: [string, RegExp][] = [
  ["profanity", /\b(fuck\w*|shit\w*|bitch\w*|chutiy\w*|bhosd\w*|madarchod|behenchod|gaand|lund|randi|harami)\b/i],
  ["adult", /\b(nsfw|xxx|onlyfans|hot girls?)\b|\b18\+/i],
  ["gambling", /\b(satta|betting (?:app|tips|site)|online casino|casino app|teen patti|rummy cash|aviator game)\b/i],
];

/** Brand-safety flags present in at least 2 recent titles (one stray title isn't a pattern). */
export function safetyFlags(titles: string[]): string[] {
  return SAFETY.filter(([, re]) => titles.filter((t) => re.test(t)).length >= 2).map(([flag]) => flag);
}
