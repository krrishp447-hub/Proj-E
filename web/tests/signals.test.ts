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
