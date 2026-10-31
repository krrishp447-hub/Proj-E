import { test } from "node:test";
import assert from "node:assert/strict";
import { canonCity, cityMentions, citiesIn, durationSeconds, isShort } from "../src/lib/scout/places.ts";

test("video length from the API's ISO 8601 durations", () => {
  assert.equal(durationSeconds("PT45S"), 45);
  assert.equal(durationSeconds("PT1M5S"), 65);
  assert.equal(durationSeconds("PT1H2M3S"), 3723);
  assert.equal(durationSeconds("P1DT1S"), 86401);
  assert.equal(durationSeconds("P0D"), 0); // live streams before they end
  assert.equal(durationSeconds(undefined), null);
  assert.equal(durationSeconds("garbage"), null);
});

test("Shorts: up to 60 s, or up to 3 min when tagged #shorts; unknown length is unknown", () => {
  assert.equal(isShort(58), true);
  assert.equal(isShort(150, "Budget phone pick #shorts"), true);
  assert.equal(isShort(150, "Budget phone review"), false); // a 2.5-minute video
  assert.equal(isShort(240, "#shorts"), false); // over YouTube's 3-minute limit
  assert.equal(isShort(0), false);
  assert.equal(isShort(null), null);
});

test("cities: display names, other spellings, whole words, Navi Mumbai isn't also Mumbai", () => {
  assert.deepEqual(citiesIn("Best street food in Bombay and Bangalore"), ["Mumbai", "Bengaluru"]);
  assert.deepEqual(citiesIn("Navi Mumbai flat tour"), ["Navi Mumbai"]);
  assert.deepEqual(citiesIn("my goal for 2026"), []); // not Goa
  assert.equal(canonCity("bengaluru, karnataka"), "Bengaluru");
  assert.equal(canonCity("Gurgaon"), "Gurugram");
  assert.equal(canonCity("Springfield"), null);
});

test("city mentions: the description, or 2+ titles (one Goa trip isn't a Goa channel)", () => {
  assert.deepEqual(cityMentions("Pune based food vlogger", ["Goa trip day 1", "Best misal"]), ["Pune"]);
  assert.deepEqual(cityMentions("", ["Goa trip day 1", "Goa trip day 2", "Delhi chaat"]), ["Goa"]);
});
