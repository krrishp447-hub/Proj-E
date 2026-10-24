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
  assert.deepEqual([kestrel.views, kestrel.paidViews, kestrel.weekly], [4000, 1000, [3000, 1000]]);
  assert.equal(boat.share + kestrel.share, 100);
  assert.equal(r.posts[0].videoId, "b");
  assert.deepEqual(r.posts[0].brands, ["Kestrel", "boAt"]);
  // outreach: UC3 talks about boAt but never Kestrel; UC2 already mentions Kestrel
  assert.deepEqual(opportunities(r, "Kestrel").map((c) => c.channelId), ["UC3"]);
});

test("competitors round-trip through the profile text", () => {
  const cs = parseCompetitors("boAt: boAt, Airdopes\nNoise: Noise Buds, -noise cancelling\nJBL\n\n");
  assert.deepEqual(cs, [{ name: "boAt", terms: ["boAt", "Airdopes"] }, { name: "Noise", terms: ["Noise Buds", "-noise cancelling"] }, { name: "JBL", terms: ["JBL"] }]);
  assert.deepEqual(parseCompetitors(formatCompetitors(cs)), cs);
});
