import { test } from "node:test";
import assert from "node:assert/strict";
import { auditBatch, checkCalculations, checkGolden, checkSanity, checkSegregation, type AuditRow } from "../src/lib/scout/audit.ts";

// A healthy batch: niches match their uploads, numbers match their videos.
const videos = [{ views: 1000, likes: 50, comments: 10 }, { views: 2000, likes: 80, comments: 20 }, { views: 3000, likes: 90, comments: 30 }];
const row = (i: number, niche: string, titles: string[]): AuditRow => ({
  channelId: `UC${i}`, name: `Creator ${i}`, about: "", niche, niche2: null, nicheConf: 0.9, language: "Hindi",
  subs: 50_000, avgViews: 2000, eng: 5, auth: 86, suspicious: 6, consistency: 70, titles, videos, // eng: median(6, 5, 4) = 5
});
const TECH = ["Smartphone review", "Laptop unboxing", "Best earbuds TWS", "iPhone camera test"];
const FOOD = ["Paneer recipe", "Easy cooking at home", "Street food tour recipe", "Chef special recipe"];
const healthy = [...Array.from({ length: 5 }, (_, i) => row(i, "Tech", TECH)), ...Array.from({ length: 5 }, (_, i) => row(10 + i, "Food", FOOD))];

test("a healthy batch passes all four checks", () => {
  const checks = auditBatch(healthy, [{ name: "Technical Guruji", niche: "Tech" }]);
  assert.equal(checks.length, 4);
  for (const c of checks) assert.ok(c.passed, `${c.name}: ${c.summary} ${c.failures.join(" | ")}`);
});

test("segregation check catches channels stored in the wrong niche (the MC STAN bug)", () => {
  const broken = healthy.map((r, i) => (i < 3 ? { ...r, niche: "Music" } : r)); // 3/10 mislabelled
  const c = checkSegregation(broken);
  assert.equal(c.passed, false);
  assert.match(c.failures[0], /stored Music, re-derived Tech/);
  assert.equal(checkGolden([{ name: "MC STAN", niche: "Tech" }]).passed, false);
});

test("calculation check catches wrong engagement, wrong avg views and inconsistent suspicious-%", () => {
  const broken = healthy.map((r, i) => (i === 0 ? { ...r, eng: 9.4 } : i === 1 ? { ...r, avgViews: 5000 } : r));
  const c = checkCalculations(broken);
  assert.equal(c.passed, false);
  assert.ok(c.failures.some((f) => /engagement 9.4% vs 5%/.test(f)));
  assert.ok(c.failures.some((f) => /avg views 5000 vs 2000/.test(f)));
  assert.equal(checkCalculations(healthy.map((r) => ({ ...r, suspicious: 20 }))).passed, false);
  // hidden likes (null) are skipped, a genuine 0 counts: median(6%, 5%) = 5.5 → stored 5.5 is correct
  const hidden = healthy.map((r) => ({ ...r, eng: 5.5, videos: [{ views: 1000, likes: null, comments: 0 }, { views: 1000, likes: 50, comments: 10 }, { views: 2000, likes: 80, comments: 20 }] }));
  assert.equal(checkCalculations(hidden.map((r) => ({ ...r, avgViews: 1000 }))).passed, true);
});

test("sanity check catches out-of-range values and a skewed batch", () => {
  assert.equal(checkSanity([...healthy.slice(1), { ...healthy[0], eng: 140 }]).passed, false);
  assert.equal(checkSanity([...healthy.slice(1), { ...healthy[0], niche: "Astrology" }]).passed, false);
  const allOther = healthy.map((r) => ({ ...r, niche: "Other" }));
  assert.match(checkSanity(allOther).failures.join(" "), /"Other" is 100%/);
});
