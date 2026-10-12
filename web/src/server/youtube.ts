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

/** Up to 50 channels per call. Channels with hidden subscriber counts are skipped (no basis to rank). */
export async function fetchChannels(ids: string[]): Promise<YtChannel[]> {
  const out: YtChannel[] = [];
  for (const batch of chunk(ids, 50)) {
    const r = await get<{ items?: YtChannel[] }>("channels", {
      part: "snippet,statistics,contentDetails,brandingSettings",
      id: batch.join(","),
      maxResults: "50",
    });
    out.push(...(r.items ?? []).filter((c) => !c.statistics.hiddenSubscriberCount));
  }
  return out;
}

/** The channel's most recent uploads (2 units: one playlist page + one videos batch). */
export async function fetchRecentVideos(uploadsPlaylistId: string, max = 20): Promise<YtVideo[]> {
  const list = await get<{ items?: { contentDetails: { videoId: string } }[] }>("playlistItems", {
    part: "contentDetails",
    playlistId: uploadsPlaylistId,
    maxResults: String(max),
  });
  const ids = (list.items ?? []).map((i) => i.contentDetails.videoId);
  if (!ids.length) return [];
  const vids = await get<{ items?: YtVideo[] }>("videos", { part: "snippet,statistics", id: ids.join(",") });
  return vids.items ?? [];
}
