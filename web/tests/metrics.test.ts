import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, deriveMetrics, estimateAuthenticity, growthFrom, type YtChannel, type YtVideo } from "../src/lib/scout/metrics.ts";

const today = new Date("2026-10-12T00:00:00Z");
const daysAgo = (d: number) => new Date(today.getTime() - d * 86_400_000).toISOString();

const channel: YtChannel = {
  id: "UC123",
  snippet: { title: "Earbud Lab India", description: "Honest TWS earbuds and ANC reviews", customUrl: "@earbudlab", country: "IN" },
  statistics: { subscriberCount: "120000" },
  contentDetails: { relatedPlaylists: { uploads: "UU123" } },
};
const video = (views: number, likes: number, comments: number, ageDays: number, title = "Best TWS earbuds under 2000"): YtVideo => ({
  snippet: { title, publishedAt: daysAgo(ageDays) },
  statistics: { viewCount: String(views), likeCount: String(likes), commentCount: String(comments) },
});

test("classify picks the niche and sub-niche tags from published text", () => {
  const c = classify("TWS earbuds review, ANC test, budget gadget pick");
  assert.equal(c.niche, "Tech");
  assert.deepEqual(c.tags, ["tws", "earbud", "anc", "budget"]);
  assert.equal(classify("weekend vlog").niche, "Other");
});

test("deriveMetrics: median views, median engagement %, cadence, country, handle", () => {
  const vids = [video(40000, 2000, 400, 5), video(60000, 3000, 600, 12), video(50000, 2400, 100, 20), video(0, 0, 0, 2)];
  const m = deriveMetrics(channel, vids, [], today);
  assert.equal(m.avgViews, 50000); // zero-view (just published) videos are ignored
  assert.equal(m.eng, 6); // median of 6.0, 6.0, 5.0
  assert.equal(m.country, "India");
  assert.equal(m.handle, "@earbudlab");
  assert.equal(m.niche, "Tech");
  assert.equal(m.consistency, Math.round((4 / 13) * 100));
  assert.equal(m.growth, 0); // no history yet → no growth claim
});

test("growthFrom uses the snapshot closest to 90 days old, ignores too-recent history", () => {
  assert.equal(growthFrom([{ takenOn: daysAgo(10), subs: 50 }], 100, today), 0);
  assert.equal(growthFrom([{ takenOn: daysAgo(88), subs: 100_000 }, { takenOn: daysAgo(40), subs: 110_000 }], 120_000, today), 20);
});

test("authenticity estimate penalises bought-follower patterns", () => {
  assert.ok(estimateAuthenticity(6, 50_000, 120_000) >= 85);
  assert.ok(estimateAuthenticity(0.3, 500, 1_000_000) <= 45);
});
