import { test } from "node:test";
import assert from "node:assert/strict";
import { mentionPattern, summarizeMentions } from "../src/lib/scout/mentions.ts";

const row = (videoId: string, title: string, description = "", views = 1000, handle = "@a") =>
  ({ videoId, title, description, views, url: "", publishedAt: "2026-10-01", creator: handle, handle });

test("mentions match whole brand terms and hashtags, not substrings", () => {
  const re = new RegExp(mentionPattern(["Noise", "#AcmeSound", "a"])!, "i");
  assert.ok(re.test("Noise Buds VS3 review"));
  assert.ok(re.test("Best ANC earbuds #AcmeSound"));
  assert.ok(!re.test("These earbuds make noises"));
  assert.ok(!re.test("#AcmeSoundcheck vlog"));
  assert.equal(mentionPattern(["", " "]), null);
});

test("stylized names match case-sensitively; '-phrase' exclusions can't trigger a match", () => {
  const boat = summarizeMentions([row("1", "boAt Airdopes 141 review"), row("2", "Life on a boat in Kerala"), row("3", "BOAT party vlog")], ["boAt"]);
  assert.deepEqual(boat.top.map((m) => m.videoId), ["1"]);
  const noise = summarizeMentions(
    [row("1", "Best active noise cancelling earbuds"), row("2", "Noise Buds VS102 review"), row("3", "Noise Buds vs others", "with noise cancelling")],
    ["Noise", "-noise cancelling"],
  );
  assert.deepEqual(noise.top.map((m) => m.videoId).sort(), ["2", "3"]);
});

test("summarizeMentions counts videos, views, creators and disclosed ads", () => {
  const s = summarizeMentions(
    [
      row("1", "Acme Buds review", "Sponsored by Acme #ad", 5000, "@x"),
      row("2", "Top 5 earbuds", "Acme Buds at #3", 3000, "@y"),
      row("3", "Unrelated vlog", "", 9000, "@x"),
      row("4", "acme buds long-term", "", 2000, "@x"),
    ],
    ["Acme Buds"],
  );
  assert.equal(s.videos, 3);
  assert.equal(s.views, 10_000);
  assert.equal(s.creators, 2);
  assert.equal(s.disclosedPct, 33);
  assert.deepEqual(s.top.map((m) => m.videoId), ["1", "2", "4"]);
  assert.equal(s.top[0].disclosed, true);
});
