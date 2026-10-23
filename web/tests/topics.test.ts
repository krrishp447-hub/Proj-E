import { test } from "node:test";
import assert from "node:assert/strict";
import { contentWords, idfOf, stem, topicMatch, topicsFrom } from "../src/lib/scout/topics.ts";

test("content words drop boilerplate and Hinglish fillers, keep model names, stem plurals", () => {
  assert.deepEqual(contentWords("MSI Thin 15 Review - Best Gaming Laptops in 2024 | Kya ye sabse sasta hai?"), ["msi", "thin", "review", "gaming", "laptop", "sabse", "budget"]); // sasta → budget (alias)
  assert.deepEqual(contentWords("Galaxy S24 vs iPhone 16"), ["galaxy", "s24", "iphone"]);
  assert.equal(stem("earbuds"), "earbud");
  assert.equal(stem("batteries"), "battery");
  assert.equal(stem("constructor"), "constructor"); // not Object.prototype.constructor
  assert.deepEqual(topicsFrom(["toString valueOf constructor", "constructor toString"]), ["constructor", "tostr"]);
});

test("topics are words that recur across a creator's titles", () => {
  const t = topicsFrom(["BGMI live rank push", "BGMI new update", "Free Fire vs BGMI", "my setup tour"]);
  assert.equal(t[0], "bgmi");
  assert.ok(!t.includes("setup")); // appears once
});

test("rare terms weigh more: matching 'msi' matters more than matching 'review'", () => {
  const idf = idfOf([["review", "phone"], ["review", "laptop", "msi"], ["review", "camera"], ["review", "laptop"]]);
  const msiOnly = topicMatch(["msi", "review"], ["msi"], idf).score;
  const reviewOnly = topicMatch(["msi", "review"], ["review"], idf).score;
  assert.ok(msiOnly > reviewOnly, `${msiOnly} vs ${reviewOnly}`);
  assert.deepEqual(topicMatch([], ["msi"], idf), { score: 0, matched: [] });
});
