import { test } from "node:test";
import assert from "node:assert/strict";
import { BRAND_PLANS, CREATOR_PLANS, manualCost, priceFor } from "../src/lib/scout/pricing.ts";

test("monthly prices are exact; yearly is 20% off (₹100 steps for brand plans)", () => {
  assert.equal(priceFor(25_000, false), 25_000);
  assert.equal(priceFor(25_000, true), 20_000);
  assert.equal(priceFor(499, false), 499);
  assert.equal(priceFor(499, true), 399);
});

test("time saved: hours minus ScoutBlack's half hour per shortlist, never negative", () => {
  assert.deepEqual(manualCost(4, 12, 800), { hoursSaved: 46, rupees: 36_800 });
  assert.deepEqual(manualCost(4, 0.25, 800), { hoursSaved: 0, rupees: 0 });
});

test("pricing stance: creators are never charged to be listed", () => {
  assert.equal(CREATOR_PLANS[0].monthly, 0);
  assert.ok(CREATOR_PLANS[0].features.some((f) => /listed/i.test(f.text)));
  assert.ok(BRAND_PLANS.every((p) => p.features.every((f) => !/searches? a month/i.test(f.text)))); // search is never metered
});

test("plan buttons start sign-in for their side directly (no role-choice page)", () => {
  assert.ok(BRAND_PLANS.every((p) => p.cta.href === "/api/auth/google/start?role=brand"));
  assert.ok(CREATOR_PLANS.every((p) => p.cta.href === "/api/auth/google/start?role=creator"));
});
