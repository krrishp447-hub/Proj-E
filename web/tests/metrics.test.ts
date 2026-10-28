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

test("deriveMetrics: average views ignore videos still collecting views (under a week) when 3+ settled ones exist", () => {
  const vids = [video(5000, 250, 50, 1), video(8000, 400, 80, 2), video(9000, 450, 90, 3), video(60000, 3000, 600, 10), video(50000, 2500, 500, 14), video(70000, 3500, 700, 21)];
  assert.equal(deriveMetrics(channel, vids, [], today).avgViews, 60000);
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

test("declared English (YouTube's default) loses to clearly Hinglish titles; other declared languages stand", async () => {
  const { contentLanguage, detectLanguage } = await import("../src/lib/scout/metrics.ts");
  const v = (title: string, lang?: string) => ({ id: title, snippet: { title, publishedAt: daysAgo(1), defaultAudioLanguage: lang }, statistics: {} });
  const hinglish = [v("Mera naya setup kaisa hai?", "en"), v("Bhai ye phone mat lena", "en"), v("Aaj kuch alag karte hain", "en"), v("iPhone 17 review", "en")];
  assert.equal(contentLanguage(hinglish), "Hindi");
  assert.equal(contentLanguage([v("Mera naya setup", "ta"), v("Bhai ye phone", "ta")]), "Tamil"); // a deliberate choice stands
  // plain English titles stay English (no false Hinglish from short words like "to", "do", "log", "par")
  assert.equal(detectLanguage(["How to log your workouts", "Do this before you buy", "Par 3 golf hole", "Kia Seltos review"]), "English");
});

test("brand channels by known-brand title; a creator whose name merely contains a brand is not one", async () => {
  const { isBrandChannel } = await import("../src/lib/scout/metrics.ts");
  assert.equal(isBrandChannel({ snippet: { title: "Nothing", description: "Inspiring human creativity by making tech fun." } }), true);
  assert.equal(isBrandChannel({ snippet: { title: "Samsung India", description: "" } }), true);
  assert.equal(isBrandChannel({ snippet: { title: "Nothing But Tech", description: "Reviews" } }), false);
  assert.equal(isBrandChannel({ snippet: { title: "Free Fire - Topic", description: "" } }), true); // auto-generated, not a creator
  assert.equal(isBrandChannel({ snippet: { title: "Topic Talks with Rahul", description: "" } }), false);
});

test("classify covers the extended niches without short-stem false hits", () => {
  assert.equal(classify("UPSC exam strategy, NEET study plan").niche, "Education");
  assert.equal(classify("Royal Enfield bike review and superbike ride").niche, "Automotive");
  assert.equal(classify("skincare routine and makeup tutorial").niche, "Beauty");
  assert.equal(classify("funny prank comedy sketch").niche, "Entertainment");
  assert.equal(classify("newborn baby care tips for toddler parenting").niche, "Parenting");
  assert.equal(classify("career moment card").niche, "Other"); // "car", "mom" stems don't fire
});

test("music releases classify as Music, not Tech (Official Audio is not an audio-gear review)", () => {
  assert.equal(classify("MC STAN - 911 Porsche (Official Music Video) | Official audio out tonight on Spotify | NUMB (Official Visualiser)").niche, "Music");
  assert.equal(classify("Sidhu Moose Wala - Lyrical Video | Full Audio Song").niche, "Music");
  assert.equal(classify("boAt Airdopes 141 review: audio quality, ANC and battery vs Noise Buds").niche, "Tech");
  assert.equal(classify("Best TWS earbuds under 2000 - audio test and unboxing").niche, "Tech");
});

test("every genre has a home: kids, sports, news, spiritual, lifestyle no longer fall into the nearest wrong niche", () => {
  assert.equal(classify("Wheels on the Bus | Nursery Rhymes and Kids Songs | cartoon for kids").niche, "Kids");
  assert.equal(classify("Pregnancy diet tips for new moms | newborn care | parenting").niche, "Parenting");
  assert.equal(classify("India vs Australia cricket highlights | IPL 2026 analysis").niche, "Sports");
  assert.equal(classify("Breaking news headlines | election debate tonight").niche, "News");
  assert.equal(classify("Hanuman Chalisa | Morning bhajan | Krishna aarti").niche, "Spiritual");
  assert.equal(classify("Family vlog | day in my life | home tour").niche, "Lifestyle");
  assert.equal(classify("Toyota Fortuner test drive review | cars").niche, "Automotive"); // "toys" must not match "Toyota"
});

test("one stray word isn't a niche; ties go to the niche with more different words, not to Tech by list order", () => {
  assert.equal(classify("my camera roll").niche, "Other"); // a single Tech word
  assert.equal(classify("phone phone | cricket ipl").niche, "Sports"); // 2 hits each: Sports matched 2 different words, Tech 1
});

test("niche names match whole words: Technoblade (Minecraft) is Gaming, not Tech", () => {
  assert.equal(classify("Technoblade | Minecraft bedwars gameplay | Minecraft hypixel skyblock").niche, "Gaming");
  assert.equal(classify("Technical Guruji | new smartphone unboxing | technology news").niche, "Tech");
});
