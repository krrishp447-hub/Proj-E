import { test } from "node:test";
import assert from "node:assert/strict";
import { segment } from "../src/lib/scout/segment.ts";

test("uploads outvote a stray word in the description", () => {
  const s = segment({
    name: "Rahul Cricket Talks",
    about: "Cricket analysis. Business enquiries for tech brands welcome.",
    titles: ["IPL 2026 auction analysis", "India vs Australia match highlights", "Kabaddi league preview", "Cricket world cup squad", "IPL playoffs"],
  });
  assert.equal(s.niche, "Sports");
  assert.ok(s.confidence >= 0.8, `confidence ${s.confidence}`);
});

test("a creator who makes two things gets a primary and a secondary niche", () => {
  const s = segment({
    name: "TechPlay",
    about: "Smartphone reviews and mobile gaming",
    titles: ["Best gaming phone under 20000", "BGMI on this smartphone", "iPhone 17 unboxing", "Free Fire max settings", "BGMI 90fps test", "Laptop review"],
  });
  assert.equal(s.niche, "Tech");
  assert.equal(s.secondary, "Gaming");
  assert.ok(s.confidence > 0.5 && s.confidence < 0.9);
});

test("music releases are Music; kids' rhymes are Kids; nothing matching is Other", () => {
  assert.equal(segment({ name: "MC STAN", titles: ["911 Porsche (Official Music Video)", "NUMB (Official Visualiser)", "Kider Manzil | Official Audio"] }).niche, "Music");
  assert.equal(segment({ name: "ChuChuTV", about: "Nursery rhymes and kids songs", titles: ["Wheels on the bus | nursery rhymes", "Baby shark kids song"] }).niche, "Kids");
  const none = segment({ name: "Ravi", titles: ["my weekend", "random thoughts"] });
  assert.deepEqual([none.niche, none.confidence, none.secondary], ["Other", 0, null]);
});

test("a keyword-stuffed description can't win alone against what the channel uploads", () => {
  const s = segment({
    name: "Daily Recipes",
    about: "tech tech tech gadget smartphone laptop camera unboxing review", // SEO stuffing, capped
    titles: Array.from({ length: 12 }, (_, i) => `Paneer recipe ${i} | easy cooking`),
  });
  assert.equal(s.niche, "Food");
});
