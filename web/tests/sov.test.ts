import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSov, formatCompetitors, opportunities, parseCompetitors, type SovVideo } from "../src/lib/scout/sov.ts";

const now = new Date("2026-10-23T00:00:00Z");
const v = (id: string, channelId: string, title: string, views: number, daysAgo: number, description = ""): SovVideo => ({
  videoId: id, title, description, url: `https://youtu.be/${id}`, views, publishedAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), channelId, creator: channelId,
});
const brands = [
  { name: "Kestrel", terms: ["Kestrel", "Kestrel Buds"] },
  { name: "boAt", terms: ["boAt", "Airdopes"] },
];

test("share of voice: views per brand, paid vs earned, weekly trend, exact matching", () => {
  const r = computeSov([
    v("a", "UC1", "Kestrel Buds review", 1000, 2, "#ad"),
    v("b", "UC2", "boAt Airdopes vs Kestrel", 3000, 9),
    v("c", "UC3", "Best boat ride in Goa", 9000, 1), // "boat" is not "boAt"
    v("d", "UC3", "Airdopes 141 unboxing", 500, 3),
  ], brands, 14, now);
  const [kestrel, boat] = r.brands;
  assert.deepEqual([boat.name, boat.views, boat.videos, boat.creators], ["boAt", 3500, 2, 2]);
  // weekly = views gained per week over the last 4: with no daily counts, a video's views land in its publish week
  assert.deepEqual([kestrel.views, kestrel.paidViews, kestrel.weekly], [4000, 1000, [0, 0, 3000, 1000]]);
  assert.equal(boat.share + kestrel.share, 100);
  assert.equal(r.posts[0].videoId, "b");
  assert.deepEqual(r.posts[0].brands, ["Kestrel", "boAt"]);
  // outreach: UC3 talks about boAt but never Kestrel; UC2 already mentions Kestrel
  assert.deepEqual(opportunities(r, "Kestrel").map((c) => c.channelId), ["UC3"]);
});

test("weekly trend is views gained each week (from daily counts), not total views by publish week", () => {
  const day = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString().slice(0, 10);
  // published 40 days ago: had 50K before the window, gained 1K, 2K, 4K, then 3K in the latest week (60K now)
  const old = { ...v("o", "UC9", "Kestrel Buds long-term review", 60_000, 40), snaps: [[day(29), 50_000], [day(21), 51_000], [day(14), 53_000], [day(7), 57_000]] as [string, number][] };
  const r = computeSov([old], brands, 90, now);
  assert.deepEqual(r.brands.find((b) => b.name === "Kestrel")!.weekly, [1000, 2000, 4000, 3000]);
  // a video too old for daily counts (no snaps, published before the window) adds nothing to the trend
  const stale = computeSov([v("s", "UC8", "Kestrel Buds review", 80_000, 70)], brands, 90, now);
  assert.deepEqual(stale.brands.find((b) => b.name === "Kestrel")!.weekly, [0, 0, 0, 0]);
});

test("competitors round-trip through the profile text", () => {
  const cs = parseCompetitors("boAt: boAt, Airdopes\nNoise: Noise Buds, -noise cancelling\nJBL\n\n");
  assert.deepEqual(cs, [{ name: "boAt", terms: ["boAt", "Airdopes"] }, { name: "Noise", terms: ["Noise Buds", "-noise cancelling"] }, { name: "JBL", terms: ["JBL"] }]);
  assert.deepEqual(parseCompetitors(formatCompetitors(cs)), cs);
});
