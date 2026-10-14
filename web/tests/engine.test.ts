import { test } from "node:test";
import assert from "node:assert/strict";
import { CREATORS } from "../src/lib/scout/data.ts";
import { describe, overlap, parseBrief, score } from "../src/lib/scout/engine.ts";

test("parseBrief reads niche, platform, country, sub-niche, size and intent", () => {
  const b = parseBrief("Indian YouTube tech creators who review TWS/earbuds, 50K–500K subs, strong engagement");
  assert.equal(b.niche, "Tech");
  assert.equal(b.platform, "YouTube");
  assert.equal(b.country, "India");
  assert.deepEqual(b.keywords, ["tws", "earbud"]);
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
  assert.equal(parseBrief("fintech founders").niche, undefined);
});

test("score is absolute: a perfect-fit creator scores high, a mismatch scores low", () => {
  const b = parseBrief("Indian YouTube tech earbuds 50k-500k strong engagement");
  const arjun = score(CREATORS.find((c) => c.name === "Tech With Arjun")!, b);
  const simran = score(CREATORS.find((c) => c.name === "Simran Cooks")!, b);
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
  assert.equal(parseBrief("home cooking channels").niche, "Food");
  assert.equal(parseBrief("gym creators").niche, "Fitness");
});

test("keywords match at word starts only", () => {
  assert.deepEqual(parseBrief("YouTube finance creators").keywords, []);
  assert.deepEqual(parseBrief("ANC earbuds").keywords, ["earbud", "anc"]);
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
  assert.equal(parseBrief("ANC headphones review").niche, "Tech");
});

test("reach: more average views ranks higher, all else equal", () => {
  const b = parseBrief("tech");
  assert.ok(score({ ...CREATORS[0], views: 90_000 }, b).score > score({ ...CREATORS[0], views: 2_000 }, b).score);
});

test("language in a brief is a hard filter", () => {
  const b = parseBrief("Tamil tech reviewers");
  assert.equal(b.language, "Tamil");
  assert.equal(score({ ...CREATORS[0], language: "Tamil" }, b).fits, true);
  assert.equal(score({ ...CREATORS[0], language: "English" }, b).fits, false);
  assert.equal(parseBrief("bangla unboxing").language, "Bengali");
});

test("'strong engagement' bar is the niche median, not a fixed 6.5%", async () => {
  const { contextualize } = await import("../src/lib/scout/engine.ts");
  const pool = [2, 3, 4, 5, 9].map((eng, i) => ({ ...CREATORS[0], id: i, eng }));
  const b = contextualize(parseBrief("tech creators with strong engagement"), pool);
  assert.equal(b.engBar, 4);
  assert.ok(score({ ...CREATORS[0], eng: 4.5 }, b).signals.some((s) => s.label.startsWith("High engagement") && s.points > 0));
});
