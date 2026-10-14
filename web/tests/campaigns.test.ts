import { test } from "node:test";
import assert from "node:assert/strict";
import { fairRate, isLate, matchVideo, nextStage, rollup, shareOfVoice, type Campaign, type Deliverable, type VideoPost } from "../src/lib/scout/campaigns.ts";

const campaign: Campaign = {
  id: "c1", brand: "Kestrel Audio", name: "Buds X launch", status: "Live", start: "2026-09-20", end: "2026-10-31",
  rules: { hashtags: ["#KestrelBudsX"], links: ["kestrel.audio/x"], mentions: ["@kestrelaudio"], keywords: ["Kestrel Buds X"] },
  creatorIds: [1, 2],
};
const post = (p: Partial<VideoPost>): VideoPost => ({
  id: "v", creatorId: 1, platform: "YouTube", title: "", description: "", publishedAt: "2026-10-01T10:00:00Z", url: "",
  views: 1000, likes: 50, comments: 10, daily: [400, 800, 1000], ...p,
});

test("tracking link + hashtag from a contracted creator files automatically, with auditable reasons", () => {
  const m = matchVideo(post({ title: "Kestrel Buds X review", description: "Buy: kestrel.audio/x?ref=a1 #KestrelBudsX #ad" }), campaign);
  assert.equal(m.status, "filed");
  assert.equal(m.confidence, 100);
  assert.deepEqual(m.reasons, ["Tracking link", "#KestrelBudsX", "“Kestrel Buds X” in title"]);
  assert.equal(m.disclosed, true);
});

test("keyword-only mention goes to review; paid flag from a connected channel lifts it to filed", () => {
  const p = post({ title: "Kestrel Buds X vs the rest" });
  assert.equal(matchVideo(p, campaign).status, "review");
  assert.equal(matchVideo({ ...p, paidFlag: true }, campaign).status, "filed");
});

test("uncontracted creator mentioning the brand is organic; outside the dates is ignored", () => {
  assert.equal(matchVideo(post({ creatorId: 9, description: "#KestrelBudsX" }), campaign).status, "organic");
  const late = matchVideo(post({ description: "#KestrelBudsX", publishedAt: "2026-12-01T00:00:00Z" }), campaign);
  assert.equal(late.status, "none");
  assert.deepEqual(late.reasons, ["Outside campaign dates"]);
});

test("rollup: totals, CPV, delivered vs promised, on-time and a cumulative timeline", () => {
  const a = post({ id: "a", publishedAt: "2026-10-01T09:00:00Z", views: 1000, likes: 80, comments: 20, daily: [500, 1000] });
  const b = post({ id: "b", creatorId: 2, publishedAt: "2026-10-02T09:00:00Z", views: 3000, likes: 200, comments: 100, daily: [1000, 3000] });
  const filed = [a, b].map((video) => ({ video, match: matchVideo({ ...video, description: "#KestrelBudsX #ad" }, campaign) }));
  const del = (id: string, creatorId: number, videoId: string, due: string): Deliverable =>
    ({ id, dealId: id, campaignId: "c1", creatorId, kind: "YouTube video", due, status: "Live", videoId, projectedViews: 2000, fee: 20000 });
  const r = rollup(filed, [del("d1", 1, "a", "2026-10-01"), del("d2", 2, "b", "2026-10-01")], "2026-10-03");
  assert.equal(r.views, 4000);
  assert.equal(r.engRate, 10);
  assert.equal(r.spend, 40000);
  assert.equal(r.cpv, 10);
  assert.equal(r.deliveredVsPromised, 1);
  assert.equal(r.onTime, 50); // b posted a day late
  assert.equal(r.disclosed, 100);
  assert.deepEqual(r.daily.map((d) => d.views), [500, 2000, 4000]);
  assert.equal(r.byCreator[0].creatorId, 2);
});

test("fair rate scales with views and engagement; stages advance and stop at Paid", () => {
  assert.deepEqual(fairRate(100_000, 5), { low: 40000, high: 90000, engFactor: 1 });
  assert.ok(fairRate(100_000, 10).high > fairRate(100_000, 5).high);
  assert.equal(nextStage("Negotiating"), "Contracted");
  assert.equal(nextStage("Paid"), "Paid");
  assert.equal(isLate({ status: "In production", due: "2026-10-01" } as Deliverable, "2026-10-14"), true);
});

test("share of voice by views, platform filter, multi-brand posts count for each", () => {
  const posts = [
    post({ id: "1", title: "Kestrel review", views: 600 }),
    post({ id: "2", title: "Ripple vs Kestrel", views: 300 }),
    post({ id: "3", title: "Ripple unboxing", views: 100, platform: "Instagram" }),
  ];
  const sov = shareOfVoice(posts, { Kestrel: ["kestrel"], Ripple: ["ripple"] });
  assert.equal(sov[0].brand, "Kestrel");
  assert.equal(Math.round(sov[0].share), 69); // 900 of 1300
  assert.equal(shareOfVoice(posts, { Kestrel: ["kestrel"], Ripple: ["ripple"] }, "Instagram")[0].brand, "Ripple");
});
