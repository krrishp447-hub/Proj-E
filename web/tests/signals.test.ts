import { test } from "node:test";
import assert from "node:assert/strict";
import { daysSinceUpload, safetyFlags, sponsoredShare } from "../src/lib/scout/signals.ts";

const today = new Date("2026-10-23T00:00:00Z");

test("recency: days since the newest upload, null without uploads", () => {
  assert.equal(daysSinceUpload([{ title: "a", publishedAt: "2026-10-20T10:00:00Z" }, { title: "b", publishedAt: "2026-09-01T00:00:00Z" }], today), 2);
  assert.equal(daysSinceUpload([], today), null);
});

test("sponsorship load counts disclosed videos; unknown without descriptions", () => {
  const u = (description: string) => ({ title: "Review", description, publishedAt: "2026-10-01" });
  assert.equal(sponsoredShare([u("#ad Buy now"), u("Sponsored by Acme"), u("my thoughts"), u("links below")]), 50);
  assert.equal(sponsoredShare([{ title: "x", publishedAt: "2026-10-01" }]), null);
});

test("brand safety needs a pattern, ignores normal gaming / music words", () => {
  assert.deepEqual(safetyFlags(["TUJHYA AAICHI GAAND (Official Video)", "Gaand faad performance", "NUMB"]), ["profanity"]);
  assert.deepEqual(safetyFlags(["Aviator game trick to win", "Satta matka result today", "My vlog"]), ["gambling"]);
  assert.deepEqual(safetyFlags(["MC STAN live", "BGMI 20 kill game", "Headshot montage"]), []);
  assert.deepEqual(safetyFlags(["Matka silk sarees", "Nude lipstick shades", "GTA 5 Diamond Casino Heist", "Casino heist finale", "Nude gloss"]), []);
  assert.deepEqual(safetyFlags(["onlyfans drama", "normal video"]), []); // a single title isn't a pattern
});

test("segregation: YouTube's own categories and topics outweigh one stray keyword", async () => {
  const { segment } = await import("../src/lib/scout/segment.ts");
  const titles = Array.from({ length: 12 }, (_, i) => `Dhindora S1E2 | Part ${i + 1}`);
  // one Tech word in the description, no niche words in titles: not enough on its own
  assert.equal(segment({ name: "BB Show", about: "From BB to your speakers", titles }).niche, "Other");
  // the creator filed every upload under Comedy (23) → Entertainment
  assert.equal(segment({ name: "BB Show", about: "From BB to your speakers", titles, categories: titles.map(() => "23") }).niche, "Entertainment");
  // a gaming channel whose titles never say "gaming": category 20 + the "Video game culture" topic decide it
  const g = segment({ name: "Z Plays", titles: ["TINY vs GIANT hide and seek", "1v4 clutch!"], categories: ["20", "20"], topics: ["https://en.wikipedia.org/wiki/Video_game_culture"] });
  assert.equal(g.niche, "Gaming");
  // People & Blogs (the default) carries no vote
  assert.equal(segment({ name: "Daily", titles: ["hello", "day 2"], categories: ["22", "22"] }).niche, "Other");
});
