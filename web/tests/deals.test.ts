import { test } from "node:test";
import assert from "node:assert/strict";
import { act, validTerms, whoseTurn, type DealState } from "../src/lib/scout/deals.ts";

const terms = { fee: 50_000, deliverables: "1 video", usage: "Organic · 30 days", timeline: "2 weeks" };
const fresh: DealState = { stage: "Inbound", offers: [{ ...terms, by: "brand", at: "2026-10-01" }] };
const ok = (r: DealState | { error: string }) => { if ("error" in r) throw new Error(r.error); return r; };

test("turn-taking: only the side that didn't make the latest offer can counter or accept", () => {
  assert.equal(whoseTurn(fresh), "creator");
  assert.ok("error" in act(fresh, "brand", { type: "accept" }, "t"));
  assert.ok("error" in act(fresh, "brand", { type: "counter", terms }, "t"));
  const countered = ok(act(fresh, "creator", { type: "counter", terms: { ...terms, fee: 70_000 } }, "2026-10-02"));
  assert.equal(countered.stage, "Negotiating");
  assert.equal(whoseTurn(countered), "brand");
  const agreed = ok(act(countered, "brand", { type: "accept" }, "t"));
  assert.equal(agreed.stage, "Contracted");
  assert.equal(whoseTurn(agreed), null);
});

test("work stages: drag only after contract; decline closes any open deal", () => {
  assert.ok("error" in act(fresh, "creator", { type: "move", to: "Contracted" }, "t")); // no skipping the accept
  const live = ok(act({ ...fresh, stage: "Contracted" }, "creator", { type: "move", to: "Live" }, "t"));
  assert.equal(live.stage, "Live");
  assert.ok("error" in act(live, "brand", { type: "move", to: "Negotiating" }, "t"));
  assert.equal(ok(act(fresh, "creator", { type: "decline" }, "t")).stage, "Declined");
  assert.ok("error" in act({ ...fresh, stage: "Paid" }, "brand", { type: "decline" }, "t"));
});

test("validTerms rejects missing fields and absurd fees", () => {
  assert.deepEqual(validTerms({ ...terms, fee: "45000" as unknown as number }), { ...terms, fee: 45_000, note: undefined });
  assert.equal(validTerms({ ...terms, fee: -1 }), null);
  assert.equal(validTerms({ ...terms, deliverables: " " }), null);
});
