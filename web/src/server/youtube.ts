import "server-only";
import { LATEST_UPLOADS, type YtChannel, type YtVideo } from "@/lib/scout/metrics";

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

const MAX_HISTORY = 150; // ponytail: 3 playlist pages; a channel posting 2+ a day is cut at ~75 days, raise if SOV needs it

/**
 * A channel's uploads, newest first: the latest 20, or with `days`, everything published in that window (at least the
 * latest 20, at most 150). 1 unit per 50 listed + 1 per 50 fetched: 2 for most channels, up to 6 for daily uploaders.
 */
export async function fetchRecentVideos(uploadsPlaylistId: string, days?: number): Promise<{ videos: YtVideo[]; units: number }> {
  const since = days ? Date.now() - days * 86_400_000 : 0;
  const ids: string[] = [];
  let units = 0, page: string | undefined;
  do {
    // channels with no public uploads have no uploads playlist (YouTube answers 404) — that means "no videos"
    const list = await get<{ items?: { contentDetails: { videoId: string; videoPublishedAt?: string } }[]; nextPageToken?: string }>("playlistItems", {
      part: "contentDetails", playlistId: uploadsPlaylistId, maxResults: String(days ? 50 : LATEST_UPLOADS), ...(page ? { pageToken: page } : {}),
    }).catch((e: Error) => { if (e.message.includes(" 404:")) return { items: [], nextPageToken: undefined }; throw e; });
    units++;
    const items = list.items ?? [];
    const inWindow = (at?: string) => !at || Date.parse(at) >= since;
    for (const i of items) if (ids.length < LATEST_UPLOADS || inWindow(i.contentDetails.videoPublishedAt)) ids.push(i.contentDetails.videoId);
    page = days && list.nextPageToken && inWindow(items.at(-1)?.contentDetails.videoPublishedAt) && ids.length < MAX_HISTORY ? list.nextPageToken : undefined;
  } while (page);
  const videos: YtVideo[] = [];
  for (const batch of chunk(ids.slice(0, MAX_HISTORY), 50)) {
    const r = await get<{ items?: YtVideo[] }>("videos", { part: "snippet,statistics,contentDetails", id: batch.join(",") });
    units++;
    videos.push(...(r.items ?? []));
  }
  return { videos, units };
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
    const r = await get<{ items?: YtVideo[] }>("videos", { part: "snippet,statistics,contentDetails", id: batch.join(",") });
    out.push(...(r.items ?? []));
  }
  return out;
}
