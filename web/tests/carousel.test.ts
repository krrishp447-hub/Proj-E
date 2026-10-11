import { test } from "node:test";
import assert from "node:assert/strict";
import { clampIndex, nearestIndex } from "../src/lib/carousel.ts";

test("nearestIndex picks the card centred closest to the track middle", () => {
  assert.equal(nearestIndex([100, 400, 700], 380), 1);
  assert.equal(nearestIndex([100, 400, 700], 0), 0);
  assert.equal(nearestIndex([100, 400, 700], 5000), 2);
  assert.equal(nearestIndex([100, 400], 250), 0); // tie keeps the earlier card
});

test("clampIndex keeps prev/next inside the deck", () => {
  assert.equal(clampIndex(-1, 5), 0);
  assert.equal(clampIndex(5, 5), 4);
  assert.equal(clampIndex(2, 5), 2);
});
