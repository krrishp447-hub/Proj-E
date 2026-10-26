import "server-only";
import type { YtChannel, YtVideo } from "@/lib/scout/metrics";

// YouTube Data API v3. Quota: 10,000 units/day per Google Cloud project.
// channels.list / playlistItems.list / videos.list cost 1 unit each (up to 50 ids per call).
const API = "https://www.googleapis.com/youtube/v3";

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  const url = `${API}/${path}?${new URLSearchParams({ ...params, key })}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`YouTube ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

export const chunk = <T,>(xs: T[], size: number) =>
  Array.from({ length: Math.ceil(xs.length / size) }, (_, i) => xs.slice(i * size, i * size + size));

/** True for YouTube's daily-quota errors (403 quotaExceeded / dailyLimitExceeded). */
export const isQuotaError = (e: unknown) => e instanceof Error && / 403: /.test(e.message) && /quota|dailyLimit/i.test(e.message);

/**
 * Up to 50 channels per call. Channels with hidden subscriber counts are skipped (no basis to rank).
 * If the daily quota runs out part-way, returns what was fetched so far with `quotaExhausted`, instead of throwing
 * away the whole run.
 */
export async function fetchChannels(ids: string[]): Promise<YtChannel[] & { quotaExhausted?: boolean }> {
  const out: YtChannel[] & { quotaExhausted?: boolean } = [];
  for (const batch of chunk(ids, 50)) {
    try {
      const r = await get<{ items?: YtChannel[] }>("channels", {
        part: "snippet,statistics,contentDetails,brandingSettings,topicDetails", // topicDetails: same 1-unit call
        id: batch.join(","),
        maxResults: "50",
      });
      out.push(...(r.items ?? []).filter((c) => !c.statistics.hiddenSubscriberCount));
    } catch (e) {
      if (!isQuotaError(e)) throw e;
      out.quotaExhausted = true;
      break;
    }
  }
  return out;
}

/** The channel's most recent uploads (2 units: one playlist page + one videos batch). */
export async function fetchRecentVideos(uploadsPlaylistId: string, max = 20): Promise<YtVideo[]> {
  // channels with no public uploads have no uploads playlist (YouTube answers 404) — that means "no videos"
  const list = await get<{ items?: { contentDetails: { videoId: string } }[] }>("playlistItems", {
    part: "contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults: String(max),
  }).catch((e: Error) => { if (e.message.includes(" 404:")) return { items: [] }; throw e; });
  const ids = (list.items ?? []).map((i) => i.contentDetails.videoId);
  if (!ids.length) return [];
  const vids = await get<{ items?: YtVideo[] }>("videos", { part: "snippet,statistics", id: ids.join(",") });
  return vids.items ?? [];
}

/** One page of channel search results in India (100 units — 100× a list call, so discovery is budgeted). */
export async function searchChannels(q: string, pageToken?: string): Promise<{ ids: string[]; next: string | null }> {
  const r = await get<{ items?: { id: { channelId: string } }[]; nextPageToken?: string }>("search", {
    part: "snippet", type: "channel", q, regionCode: "IN", maxResults: "50", ...(pageToken ? { pageToken } : {}),
  });
  return { ids: (r.items ?? []).map((i) => i.id.channelId), next: r.nextPageToken ?? null };
}

/** Specific videos by id (1 unit per 50): confirms a submitted deliverable link is public and on the creator's channel. */
export async function fetchVideos(ids: string[]): Promise<YtVideo[]> {
  const out: YtVideo[] = [];
  for (const batch of chunk(ids, 50)) {
    const r = await get<{ items?: YtVideo[] }>("videos", { part: "snippet,statistics", id: batch.join(",") });
    out.push(...(r.items ?? []));
  }
  return out;
}
