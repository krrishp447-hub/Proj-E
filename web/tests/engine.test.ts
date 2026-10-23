import { test } from "node:test";
import assert from "node:assert/strict";
import type { Creator } from "../src/lib/scout/data.ts";
import { audienceVerified, contextualize, describe, overlap, parseBrief, score } from "../src/lib/scout/engine.ts";

// Test fixtures: a strong Indian tech/earbuds YouTuber and an off-niche food creator.
const base: Creator = {
  id: 0, channelId: "UC_fixture_tech", name: "Fixture Tech", secondaryNiche: null, nicheConfidence: 0.9, handle: "@fixturetech", platform: "YouTube", country: "India", niche: "Tech",
  tags: ["tws", "earbuds", "audio", "reviews"], topics: ["earbud", "tws", "anc", "review", "boat"], subs: 312_000, eng: 5.8, views: 148_000, growth: 7.2, consistency: 92,
  geo: [["India", 74], ["US", 9]], age: [31, 47, 15, 7], male: 68, trend: [], collabs: 4, language: "English",
  auth: 88, suspicious: 5, campaigns: 14, repeat: 72, delivery: 1.2, proven: true, verifiedDays: 1, source: "youtube",
};
const CREATORS: Creator[] = [
  base,
  { ...base, id: 1, name: "Fixture Food", handle: "@fixturefood", niche: "Food", tags: ["recipes", "cooking"], topics: ["recipe", "cook", "paneer"], subs: 1_200_000, eng: 5.1, views: 420_000, male: 34 },
];

test("parseBrief reads niche, platform, country, sub-niche, size and intent", () => {
  const b = parseBrief("Indian YouTube tech creators who review TWS/earbuds, 50K–500K subs, strong engagement");
  assert.deepEqual(b.niches, ["Tech"]);
  assert.equal(b.platform, "YouTube");
  assert.equal(b.country, "India");
  assert.deepEqual(b.terms, ["review", "tws", "earbud"]);
  assert.equal(b.minSubs, 50_000);
  assert.equal(b.maxSubs, 500_000);
  assert.equal(b.wantEng, true);
});

test("size phrasing: M units, under, over, plus", () => {
  assert.deepEqual([parseBrief("1m-2m").minSubs, parseBrief("1m-2m").maxSubs], [1e6, 2e6]);
  assert.deepEqual([parseBrief("under 100k").minSubs, parseBrief("under 100k").maxSubs], [0, 1e5]);
  assert.equal(parseBrief("over 1.5m").minSubs, 1.5e6);
  assert.equal(parseBrief("500k+").minSubs, 5e5);
  assert.deepEqual(describe(parseBrief("under 100k")), ["under 100K"]);
});

test("no false hits: 'us' inside words, 'tech' inside 'fintech'", () => {
  assert.equal(parseBrief("business creators").country, undefined);
  assert.deepEqual(parseBrief("fintech founders").niches, []);
});

test("score is absolute: a perfect-fit creator scores high, a mismatch scores low", () => {
  const b = parseBrief("Indian YouTube tech earbuds 50k-500k strong engagement");
  const arjun = score(CREATORS[0], b);
  const simran = score(CREATORS[1], b);
  assert.ok(arjun.fits && arjun.score >= 70, `fit scored ${arjun.score}`);
  assert.ok(!simran.fits && simran.score < 30, `mismatch scored ${simran.score}`);
  for (const c of CREATORS) {
    const s = score(c, b).score;
    assert.ok(s >= 0 && s <= 100);
  }
});

test("overlap is symmetric and bounded", () => {
  const [a, b] = CREATORS;
  assert.equal(overlap(a, b), overlap(b, a));
  assert.ok(overlap(a, a) <= 93);
});

test("niche synonyms: cooking → Food, gym → Fitness", () => {
  assert.deepEqual(parseBrief("home cooking channels").niches, ["Food"]);
  assert.deepEqual(parseBrief("gym creators").niches, ["Fitness"]);
});

test("content terms skip filter words and niche names", () => {
  assert.deepEqual(parseBrief("YouTube finance creators").terms, []);
  assert.deepEqual(parseBrief("ANC earbuds").terms, ["anc", "earbud"]);
});

test("no size in the brief → creators under 10K are excluded; asking for small creators includes them", () => {
  const tiny = { ...CREATORS[0], subs: 800, views: 300, eng: 40 };
  assert.equal(score(tiny, parseBrief("tech creators")).fits, false);
  assert.equal(score(tiny, parseBrief("tech creators under 5k")).fits, true);
});

test("engagement on few views earns partial credit only", () => {
  const b = parseBrief("tech");
  const big = score({ ...CREATORS[0], views: 50_000, eng: 8 }, b).score;
  const small = score({ ...CREATORS[0], views: 500, eng: 8 }, b).score;
  assert.ok(big > small);
});

test("headphones / ANC briefs resolve to the Tech niche", () => {
  assert.deepEqual(parseBrief("ANC headphones review").niches, ["Tech"]);
});

test("reach: more average views ranks higher, all else equal", () => {
  const b = parseBrief("tech");
  assert.ok(score({ ...CREATORS[0], views: 90_000 }, b).score > score({ ...CREATORS[0], views: 2_000 }, b).score);
});

test("language in a brief is a hard filter", () => {
  const b = parseBrief("Tamil tech reviewers");
  assert.deepEqual(b.languages, ["Tamil"]);
  assert.equal(score({ ...CREATORS[0], language: "Tamil" }, b).fits, true);
  assert.equal(score({ ...CREATORS[0], language: "English" }, b).fits, false);
  assert.deepEqual(parseBrief("bangla unboxing").languages, ["Bengali"]);
});

test("'strong engagement' bar is the niche median, not a fixed 6.5%", async () => {
  const { contextualize } = await import("../src/lib/scout/engine.ts");
  const pool = [2, 3, 4, 5, 9].map((eng, i) => ({ ...CREATORS[0], id: i, eng }));
  const b = contextualize(parseBrief("tech creators with strong engagement"), pool);
  assert.equal(b.engBar, 4);
  assert.ok(score({ ...CREATORS[0], eng: 4.5 }, b).signals.some((s) => s.label.startsWith("High engagement") && s.points > 0));
});

test("overlap: verified audiences that differ score lower than the niche+country fallback", () => {
  const unverified = { ...CREATORS[0], geo: [] as [string, number][], age: [] as number[], male: null };
  assert.equal(audienceVerified(unverified), false);
  assert.equal(audienceVerified(CREATORS[0]), true);
  const teen = { ...CREATORS[0], age: [70, 25, 5, 0], male: 20 };
  const older = { ...CREATORS[0], id: 9, age: [0, 10, 40, 50], male: 85 };
  assert.ok(overlap(teen, older) < overlap(unverified, { ...unverified, id: 9 }));
});

test("upgraded parsing: the briefs the old parser got wrong", () => {
  const notHindi = parseBrief("beauty creators but not hindi");
  assert.deepEqual([notHindi.niches, notHindi.languages, notHindi.excludeLanguages], [["Beauty"], [], ["Hindi"]]);
  assert.deepEqual(parseBrief("travel vloggers over 500k with camera gear").niches, ["Travel"]); // named niche beats "camera" → Tech
  const views = parseBrief("finance youtubers with 100k+ avg views");
  assert.deepEqual([views.minViews, views.minSubs], [100_000, undefined]); // views, not subscribers
  assert.deepEqual(parseBrief("tech or gaming creators in Tamil").niches, ["Tech", "Gaming"]);
  assert.deepEqual(parseBrief("South Indian food bloggers").languages, ["Tamil", "Telugu", "Kannada", "Malayalam"]);
  assert.deepEqual(parseBrief("stock market for beginners hinglish").languages, ["Hindi"]);
  assert.deepEqual(parseBrief("stock market for beginners hinglish").terms, ["stock", "market", "beginner"]); // a language, not a topic
  const micro = parseBrief("micro influencers in fitness");
  assert.deepEqual([micro.tier, micro.minSubs, micro.maxSubs], ["micro", 10_000, 100_000]);
  assert.equal(parseBrief("tech creators with engagement above 5%").minEng, 5);
  assert.deepEqual(parseBrief("BGMI streamers in Hindi").niches, ["Gaming"]);
  assert.ok(parseBrief("MSI laptop reviewers").terms.includes("msi"));
  assert.equal(parseBrief("creators like Technical Guruji, under 1m").likeName, "Technical Guruji");
});

test("topics rank who actually makes the content; exclusions and lookalikes apply", () => {
  const all = CREATORS.map((c, i) => ({ ...c, id: i }));
  const b = contextualize(parseBrief("boat earbuds review"), all);
  assert.ok(score(all[0], b).score > score(all[1], b).score);
  assert.ok(score(all[0], b).signals.some((s) => s.label.startsWith("Topics ·")));
  assert.equal(score(all[1], contextualize(parseBrief("creators, no paneer"), all)).fits, false);
  const like = contextualize(parseBrief("creators like Fixture Tech"), all);
  assert.equal(like.like?.name, "Fixture Tech");
  assert.deepEqual(like.niches, ["Tech"]); // inherits the named creator's niche
  assert.equal(score(all[0], like).fits, false); // not themselves
});

test("a platform with no tracked creators says so instead of returning nothing", () => {
  const all = CREATORS.map((c, i) => ({ ...c, id: i })); // YouTube only
  const b = contextualize(parseBrief("Instagram fitness creators in India"), all);
  assert.equal(b.platform, undefined);
  assert.equal(b.platformMissing, "Instagram");
  assert.ok(describe(b).includes("Instagram not tracked yet"));
});

test("secondary niche: a Tech channel that also makes Gaming fits a gaming brief, below a primary gamer", () => {
  const gamer = { ...CREATORS[0], id: 5, channelId: "UC_g", niche: "Gaming", secondaryNiche: null, nicheConfidence: 0.95 };
  const hybrid = { ...CREATORS[0], id: 6, channelId: "UC_h", niche: "Tech", secondaryNiche: "Gaming", nicheConfidence: 0.6 };
  const b = parseBrief("gaming creators");
  const g = score(gamer, b), h = score(hybrid, b), t = score({ ...CREATORS[0], secondaryNiche: null }, b);
  assert.ok(g.fits && h.fits && !t.fits);
  assert.ok(g.score > h.score);
  assert.ok(h.signals.some((s) => s.label.startsWith("Also makes Gaming")));
});
