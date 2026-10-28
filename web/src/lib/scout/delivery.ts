// Delivery after a deal is agreed: the offer's deliverables become items each tracked from planned to paid. Pure, tested.
import type { DealStage } from "./deals.ts";

export type DeliverableKind = "YouTube video" | "YouTube Short";
export const DELIVERY_STATUSES = ["Planned", "Submitted", "Live", "Approved", "Paid"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
//   Planned   — agreed, not posted yet
//   Submitted — the creator shared a link ScoutBlack couldn't confirm yet (unlisted, not public, or not fetched)
//   Live      — the video is public on the creator's own channel (confirmed from YouTube); views tracked
//   Approved  — the brand checked it
//   Paid      — the brand marked the fee paid

const WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/**
 * The agreed offer's free-text deliverables → items. "1 YouTube video + 2 Shorts", "dedicated video and 3 shorts",
 * "integration". Anything unrecognised is one YouTube video: an agreed deal always has something to track.
 */
export function parseDeliverables(text: string): DeliverableKind[] {
  const out: DeliverableKind[] = [];
  const t = text.toLowerCase();
  // "review" / "integration" / "unboxing" describe a video ("1 review video" is one item); a lone "review" (as in
  // "script review") isn't a deliverable, so only videos, Shorts and standalone integrations are counted.
  for (const m of t.matchAll(/(\d+|a|an|one|two|three|four|five|six)?\s*(?:x\s*)?(?:(?:youtube|yt|dedicated|integrated|long[- ]form|review|integration|unboxing)\s+)*(shorts?|videos?|integrations?)\b/g)) {
    const n = Math.min(10, m[1] ? Number(m[1]) || WORDS[m[1]] || 1 : 1);
    const kind: DeliverableKind = m[2].startsWith("short") ? "YouTube Short" : "YouTube video";
    for (let i = 0; i < n; i++) out.push(kind);
  }
  return out.length ? out.slice(0, 10) : ["YouTube video"];
}

/** The video id in a YouTube link (watch, youtu.be, shorts, live, embed), or null. */
export function youtubeVideoId(url: string): string | null {
  const m = url.trim().match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})(?![\w-])/);
  return m ? m[1] : null;
}

const ORDER: DealStage[] = ["Contracted", "In production", "Live", "Paid"];

/**
 * Where the deal should be, given its items: all paid → Paid; all at least live → Live; anything posted or submitted →
 * In production. Only ever moves a deal forward (a manual stage the brand set further along is kept).
 */
export function stageFromDelivery(current: DealStage, items: DeliveryStatus[]): DealStage {
  if (!items.length || !ORDER.includes(current)) return current;
  const rank = (s: DeliveryStatus) => DELIVERY_STATUSES.indexOf(s);
  const next: DealStage = items.every((s) => s === "Paid") ? "Paid"
    : items.every((s) => rank(s) >= rank("Live")) ? "Live"
    : items.some((s) => rank(s) >= rank("Submitted")) ? "In production"
    : current;
  return ORDER.indexOf(next) > ORDER.indexOf(current) ? next : current;
}

/** A Google Drive / Docs share link (the creator's draft cut for review), normalised; null if it isn't one. */
export function googleDriveUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" && /^(drive|docs)\.google\.com$/.test(u.hostname) && url.length <= 500 ? u.toString() : null;
  } catch {
    return null;
  }
}
