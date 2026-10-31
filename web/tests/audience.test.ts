import { test } from "node:test";
import assert from "node:assert/strict";
import { audienceFrom } from "../src/lib/scout/audience.ts";

test("audienceFrom folds YouTube Analytics reports into ScoutBlack's bands, gender split and top markets", () => {
  const a = audienceFrom(
    { rows: [["age13-17", "male", 10], ["age18-24", "male", 30], ["age18-24", "female", 20], ["age25-34", "female", 15], ["age35-44", "male", 15], ["age55-64", "female", 10]] },
    { rows: [["US", 100], ["IN", 700], ["AE", 100], ["GB", 50], ["SG", 50]] },
    { rows: [[42.37]] },
  );
  assert.deepEqual(a.age, [10, 50, 15, 25]); // 35–44 and 55–64 fold into 35+
  assert.equal(a.male, 55);
  assert.deepEqual(a.geo, [["India", 70], ["US", 10], ["UAE", 10], ["Other", 10]]);
  assert.equal(a.avgViewPct, 42.4);
});

test("audienceFrom with no data (a brand-new channel) claims nothing", () => {
  assert.deepEqual(audienceFrom({}, { rows: [] }, {}), { age: [], male: null, geo: [], avgViewPct: null, cities: [] });
});

test("audience cities: share of ALL views, ScoutBlack's city names, merged spellings, top 5", () => {
  const countries = { rows: [["IN", 9000], ["US", 1000]] }; // 10,000 views in all
  const cities = { rows: [["Mumbai", 1800], ["Bangalore", 700], ["Bengaluru", 300], ["Springfield", 200], ["12345", 99]] };
  const a = audienceFrom({}, countries, {}, cities);
  assert.deepEqual(a.cities, [["Mumbai", 18], ["Bengaluru", 10], ["Springfield", 2]]); // ids dropped, unknown names kept
});
