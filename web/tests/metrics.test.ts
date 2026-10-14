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
  id: `v${views}`,
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

test("sub-niche tags must recur across uploads; description boilerplate is ignored", () => {
  const vids = [
    video(1000, 50, 5, 3, "TWS earbuds under 2000"),
    video(1000, 50, 5, 9, "Best TWS for gaming"),
    video(1000, 50, 5, 15, "ANC headphones review"),
  ].map((v) => ({ ...v, snippet: { ...v.snippet, description: "My gear: travel bag, fitness band, coding laptop" } }));
  const m = deriveMetrics(channel, vids, [], today);
  assert.deepEqual(m.tags, ["tws"]); // tws in 2 of 3 titles; anc/gaming once; travel/fitness/coding only in descriptions
});

test("hidden like counts mean unknown engagement, not suspicious", () => {
  const hidden = [1, 2, 3].map((d) => ({ snippet: { title: "Review", publishedAt: daysAgo(d) }, id: `h${d}`, statistics: { viewCount: "40000", commentCount: "100" } }));
  const m = deriveMetrics({ ...channel, statistics: { subscriberCount: "200000" } }, hidden, [], today);
  assert.equal(m.eng, 0);
  assert.ok(m.auth >= 72, `hidden likes should not be penalised (got ${m.auth})`);
});

test("language: script, language name or Hinglish in ≥30% of titles; otherwise English", async () => {
  const { detectLanguage } = await import("../src/lib/scout/metrics.ts");
  assert.equal(detectLanguage(["सबसे सस्ता फोन", "नया ईयरबड्स रिव्यू", "Unboxing", "Top 5"]), "Hindi");
  assert.equal(detectLanguage(["Best TWS in Tamil", "Budget phone Tamil review", "Unboxing", "Specs"]), "Tamil");
  assert.equal(detectLanguage(["Sabse sasta earbuds kaise le", "Ye phone mat lena bhai", "Unboxing", "Specs"]), "Hindi");
  assert.equal(detectLanguage(["Best earbuds 2026", "ANC test", "Hindi"]), "English"); // one mention isn't enough
});

test("official brand channels are flagged; creators who mention brands are not", async () => {
  const { isBrandChannel } = await import("../src/lib/scout/metrics.ts");
  assert.equal(isBrandChannel({ snippet: { title: "Nothing", description: "Welcome to the official YouTube channel of Nothing." } }), true);
  assert.equal(isBrandChannel({ snippet: { title: "Tech Guy", description: "Reviews of Nothing, Samsung and OnePlus phones." } }), false);
});

test("spoken-audio language from YouTube wins over English-looking titles", async () => {
  const { contentLanguage } = await import("../src/lib/scout/metrics.ts");
  const v = (title: string, lang?: string) => ({ id: title, snippet: { title, publishedAt: daysAgo(1), defaultAudioLanguage: lang }, statistics: {} });
  assert.equal(contentLanguage([v("iPhone 17 Unboxing", "hi"), v("Best phone 2026", "hi"), v("Shorts", undefined)]), "Hindi");
  assert.equal(contentLanguage([v("Pixel review", "en-US"), v("Galaxy test", "en")]), "English");
  // no audio language declared → fall back to text (here: Devanagari channel description)
  assert.equal(contentLanguage([v("Phone review"), v("Unboxing")], "नमस्कार दोस्तों, हमारे चैनल में स्वागत है"), "Hindi");
});

test("brand channels by known-brand title; a creator whose name merely contains a brand is not one", async () => {
  const { isBrandChannel } = await import("../src/lib/scout/metrics.ts");
  assert.equal(isBrandChannel({ snippet: { title: "Nothing", description: "Inspiring human creativity by making tech fun." } }), true);
  assert.equal(isBrandChannel({ snippet: { title: "Samsung India", description: "" } }), true);
  assert.equal(isBrandChannel({ snippet: { title: "Nothing But Tech", description: "Reviews" } }), false);
});

test("classify covers the extended niches without short-stem false hits", () => {
  assert.equal(classify("UPSC exam strategy, NEET study plan").niche, "Education");
  assert.equal(classify("Royal Enfield bike review and superbike ride").niche, "Automotive");
  assert.equal(classify("skincare routine and makeup tutorial").niche, "Beauty");
  assert.equal(classify("funny prank comedy sketch").niche, "Entertainment");
  assert.equal(classify("newborn baby care tips for toddler parenting").niche, "Parenting");
  assert.equal(classify("career moment card").niche, "Other"); // "car", "mom" stems don't fire
});
