import { test } from "node:test";
import assert from "node:assert/strict";
import type { Creator } from "../src/lib/scout/data.ts";
import { audienceVerified, contextualize, describe, overlap, parseBrief, score, understoodNothing } from "../src/lib/scout/engine.ts";

// Test fixtures: a strong Indian tech/earbuds YouTuber and an off-niche food creator.
const base: Creator = {
  id: 0, channelId: "UC_fixture_tech", name: "Fixture Tech", secondaryNiche: null, nicheConfidence: 0.9, handle: "@fixturetech", platform: "YouTube", country: "India", niche: "Tech",
  tags: ["tws", "earbuds", "audio", "reviews"], topics: ["earbud", "tws", "anc", "review", "boat"], subs: 312_000, eng: 5.8, views: 148_000, growth: 7.2, consistency: 92,
  geo: [["India", 74], ["US", 9]], age: [31, 47, 15, 7], male: 68, trend: [], collabs: 4, language: "English",
  auth: 88, suspicious: 5, campaigns: 14, repeat: 72, delivery: 1.2, proven: true, verifiedDays: 1, lastUploadDays: 3, sponsoredPct: 20, safety: [], claimed: false, hasEmail: false, source: "youtube",
};
const CREATORS: Creator[] = [
  base,
  { ...base, id: 1, name: "Fixture Food", handle: "@fixturefood", niche: "Food", tags: ["recipes", "cooking"], topics: ["recipe", "cook", "paneer"], subs: 1_200_000, eng: 5.1, views: 420_000, male: 34 },
];

test("parseBrief reads niche, platform, country, sub-niche, size and intent", () => {
  const b = parseBrief("Indian YouTube tech creators who review TWS/earbuds, 50K–500K subs, strong engagement");
  assert.deepEqual(b.niches, ["Tech"]);
  assert.equal(b.platform, "YouTube");
  assert.equal(b.country, "India");
  assert.deepEqual(b.terms, ["review", "tws", "earbud"]);
  assert.equal(b.minSubs, 50_000);
  assert.equal(b.maxSubs, 500_000);
  assert.equal(b.wantEng, true);
});

test("market: India by default, an unset country is missing data (never a mismatch), other countries when named", () => {
  const brief = (q: string) => contextualize(parseBrief(q), CREATORS);
  const unknownHindi = { ...base, country: "Unknown", language: "Hindi" };
  const uk = { ...base, country: "UK" };
  assert.equal(score(unknownHindi, brief("Indian tech creators")).fits, true);
  assert.ok(score(unknownHindi, brief("Indian tech creators")).signals.some((s) => s.label.startsWith("Audience · likely India")));
  assert.equal(score({ ...base, country: "Unknown" }, brief("Indian tech creators")).fits, true); // English, country not set
  assert.equal(score(uk, brief("tech creators")).fits, false); // no country named → India
  assert.ok(score(uk, brief("tech creators")).signals.some((s) => s.label === "Outside India · UK"));
  assert.equal(score({ ...base, country: "US" }, brief("US tech creators")).fits, true);
  assert.equal(score(base, brief("US tech creators")).fits, false);
});

test("brand briefs: filler isn't content, lakh/crore sizes, money isn't size, numbers don't eat words", () => {
  const b = parseBrief("Looking for 20 micro influencers for a skincare launch");
  assert.deepEqual(b.terms, ["skincare"]); // not "look", "icro" (20 m-icro) or "launch"
  assert.equal(b.tier, "micro");
  assert.deepEqual([parseBrief("food creators with 10 lakh+ subscribers").minSubs, parseBrief("food creators with 10 lakh+ subscribers").maxSubs], [1e6, Infinity]);
  assert.deepEqual([parseBrief("tech between 1 lakh to 5 lakh subs").minSubs, parseBrief("tech between 1 lakh to 5 lakh subs").maxSubs], [1e5, 5e5]);
  assert.equal(parseBrief("1 crore+ subs").minSubs, 1e7);
  const money = parseBrief("budget 2 lakh, 5 creators for a fitness app");
  assert.equal(money.minSubs, undefined); // 2 lakh is the budget, not a size
  assert.ok(!money.terms.includes("budget") && !money.terms.includes("lakh"));
  assert.ok(parseBrief("budget phone reviewers").terms.includes("budget")); // the content word survives
  assert.ok(!parseBrief("₹50k per creator, hindi tech").terms.some((t) => /50|creator/.test(t)));
});

test("asks ScoutBlack can't serve are named, not silently dropped; brand-deal experience is a preference", () => {
  assert.ok(parseBrief("female beauty creators").unsupported.includes("Creator gender isn't tracked"));
  assert.ok(parseBrief("fitness for women creators").unsupported.length === 1); // only the creator's gender, and once
  assert.equal(understoodNothing(contextualize(parseBrief("creators in Mumbai"), CREATORS)), false);
  const deals = contextualize(parseBrief("tech creators who have done brand collabs"), CREATORS);
  assert.equal(deals.wantBrandReady, true);
  assert.ok(!deals.terms.includes("collab"));
  const sponsored = score({ ...base, sponsoredPct: 20 }, deals).score, never = score({ ...base, sponsoredPct: 0 }, deals).score;
  assert.ok(sponsored > never);
  assert.deepEqual(parseBrief("mom bloggers").niches, ["Parenting"]);
});

test("city: ranks a verified audience there, then a base, then mentions; never filters; spellings and topics", () => {
  const b = contextualize(parseBrief("food creators in Bombay"), CREATORS);
  assert.equal(b.city, "Mumbai");
  assert.ok(!b.terms.includes("bombay") && !b.terms.includes("mumbai"));
  assert.match(describe(b).join(" | "), /Mumbai audience or base/);
  const food = { ...base, niche: "Food" };
  const s = (c: Partial<typeof base>) => score({ ...food, ...c }, b).score;
  const aud = s({ audCities: [["Mumbai", 22]] }), based = s({ basedIn: "Mumbai" }), mentions = s({ cityMentions: ["Mumbai"] }), none = s({});
  assert.ok(aud > based && based > mentions && mentions > none);
  assert.equal(score(food, b).fits, true); // no city data is not a mismatch
  assert.equal(parseBrief("creators in Navi Mumbai").city, "Navi Mumbai");
});

test("format: Shorts / long videos from video length; a requirement when known, neutral when not; views per format", () => {
  const shorts = contextualize(parseBrief("travel creators who post shorts"), CREATORS);
  assert.equal(shorts.format, "shorts");
  assert.equal(score({ ...base, niche: "Travel", shortsPct: 80 }, shorts).fits, true);
  assert.equal(score({ ...base, niche: "Travel", shortsPct: 5 }, shorts).fits, false); // mostly long videos
  assert.equal(score({ ...base, niche: "Travel", shortsPct: null }, shorts).fits, true); // not known yet
  assert.equal(parseBrief("long-form tech reviewers").format, "long");
  assert.equal(parseBrief("short film makers").format, undefined); // content, not the format
  // "100K+ views" is checked on the format asked for: a Shorts channel's long videos don't count
  const views = contextualize(parseBrief("tech shorts with 100k views"), CREATORS);
  assert.equal(score({ ...base, shortsPct: 90, views: 20_000, viewsShort: 150_000 }, views).fits, true);
  assert.equal(score({ ...base, shortsPct: 90, views: 150_000, viewsShort: 20_000 }, views).fits, false);
});

test("an inactive channel (no upload in 90+ days) is a near miss, not a fit", () => {
  const b = contextualize(parseBrief("tech creators"), CREATORS);
  assert.equal(score({ ...base, lastUploadDays: 120 }, b).fits, false);
  assert.equal(score({ ...base, lastUploadDays: 30 }, b).fits, true);
});

test("size phrasing: M units, under, over, plus", () => {
  assert.deepEqual([parseBrief("1m-2m").minSubs, parseBrief("1m-2m").maxSubs], [1e6, 2e6]);
  assert.deepEqual([parseBrief("under 100k").minSubs, parseBrief("under 100k").maxSubs], [1_000, 1e5]); // still a bookable channel
  assert.equal(parseBrief("over 1.5m").minSubs, 1.5e6);
  assert.equal(parseBrief("500k+").minSubs, 5e5);
  assert.deepEqual(describe(parseBrief("under 100k")), ["under 100K"]);
});

test("no false hits: 'us' inside words, 'tech' inside 'fintech'", () => {
  assert.equal(parseBrief("business creators").country, undefined);
  assert.deepEqual(parseBrief("fintech founders").niches, []);
});

test("score is absolute: a perfect-fit creator scores high, a mismatch scores low", () => {
  const b = parseBrief("Indian YouTube tech earbuds 50k-500k strong engagement");
  const arjun = score(CREATORS[0], b);
  const simran = score(CREATORS[1], b);
  assert.ok(arjun.fits && arjun.score >= 70, `fit scored ${arjun.score}`);
  assert.ok(!simran.fits && simran.score < 30, `mismatch scored ${simran.score}`);
  for (const c of CREATORS) {
    const s = score(c, b).score;
    assert.ok(s >= 0 && s <= 100);
  }
});

test("overlap is symmetric and bounded", () => {
  const [a, b] = CREATORS;
  assert.equal(overlap(a, b), overlap(b, a));
  assert.ok(overlap(a, a) <= 93);
});

test("niche synonyms: cooking → Food, gym → Fitness", () => {
  assert.deepEqual(parseBrief("home cooking channels").niches, ["Food"]);
  assert.deepEqual(parseBrief("gym creators").niches, ["Fitness"]);
});

test("content terms skip filter words and niche names", () => {
  assert.deepEqual(parseBrief("YouTube finance creators").terms, []);
  assert.deepEqual(parseBrief("ANC earbuds").terms, ["anc", "earbud"]);
});

test("no size in the brief → creators under 10K are excluded; asking for small creators includes them (from 1K)", () => {
  const small = { ...CREATORS[0], subs: 2_000, views: 300, eng: 40 };
  assert.equal(score(small, parseBrief("tech creators")).fits, false);
  assert.equal(score(small, parseBrief("tech creators under 5k")).fits, true);
  assert.equal(score({ ...small, subs: 232 }, parseBrief("tech creators under 5k")).fits, false); // not a bookable channel
});

test("engagement on few views earns partial credit only", () => {
  const b = parseBrief("tech");
  const big = score({ ...CREATORS[0], views: 50_000, eng: 8 }, b).score;
  const small = score({ ...CREATORS[0], views: 500, eng: 8 }, b).score;
  assert.ok(big > small);
});

test("headphones / ANC briefs resolve to the Tech niche", () => {
  assert.deepEqual(parseBrief("ANC headphones review").niches, ["Tech"]);
});

test("reach: more average views ranks higher, all else equal", () => {
  const b = parseBrief("tech");
  assert.ok(score({ ...CREATORS[0], views: 90_000 }, b).score > score({ ...CREATORS[0], views: 2_000 }, b).score);
});

test("language in a brief is a hard filter", () => {
  const b = parseBrief("Tamil tech reviewers");
  assert.deepEqual(b.languages, ["Tamil"]);
  assert.equal(score({ ...CREATORS[0], language: "Tamil" }, b).fits, true);
  assert.equal(score({ ...CREATORS[0], language: "English" }, b).fits, false);
  assert.deepEqual(parseBrief("bangla unboxing").languages, ["Bengali"]);
});

test("'strong engagement' bar is the niche median, not a fixed 6.5%", async () => {
  const { contextualize } = await import("../src/lib/scout/engine.ts");
  const pool = [2, 3, 4, 5, 9].map((eng, i) => ({ ...CREATORS[0], id: i, eng }));
  const b = contextualize(parseBrief("tech creators with strong engagement"), pool);
  assert.equal(b.engBar, 4);
  assert.ok(score({ ...CREATORS[0], eng: 4.5 }, b).signals.some((s) => s.label.startsWith("High engagement") && s.points > 0));
});

test("overlap: verified audiences that differ score lower than the niche+country fallback", () => {
  const unverified = { ...CREATORS[0], geo: [] as [string, number][], age: [] as number[], male: null };
  assert.equal(audienceVerified(unverified), false);
  assert.equal(audienceVerified(CREATORS[0]), true);
  const teen = { ...CREATORS[0], age: [70, 25, 5, 0], male: 20 };
  const older = { ...CREATORS[0], id: 9, age: [0, 10, 40, 50], male: 85 };
  assert.ok(overlap(teen, older) < overlap(unverified, { ...unverified, id: 9 }));
});

test("upgraded parsing: the briefs the old parser got wrong", () => {
  const notHindi = parseBrief("beauty creators but not hindi");
  assert.deepEqual([notHindi.niches, notHindi.languages, notHindi.excludeLanguages], [["Beauty"], [], ["Hindi"]]);
  assert.deepEqual(parseBrief("travel vloggers over 500k with camera gear").niches, ["Travel"]); // named niche beats "camera" → Tech
  const views = parseBrief("finance youtubers with 100k+ avg views");
  assert.deepEqual([views.minViews, views.minSubs], [100_000, undefined]); // views, not subscribers
  assert.deepEqual(parseBrief("tech or gaming creators in Tamil").niches, ["Tech", "Gaming"]);
  assert.deepEqual(parseBrief("South Indian food bloggers").languages, ["Tamil", "Telugu", "Kannada", "Malayalam"]);
  assert.deepEqual(parseBrief("stock market for beginners hinglish").languages, ["Hindi"]);
  assert.deepEqual(parseBrief("stock market for beginners hinglish").terms, ["stock", "market", "beginner"]); // a language, not a topic
  const micro = parseBrief("micro influencers in fitness");
  assert.deepEqual([micro.tier, micro.minSubs, micro.maxSubs], ["micro", 10_000, 100_000]);
  assert.equal(parseBrief("tech creators with engagement above 5%").minEng, 5);
  assert.deepEqual(parseBrief("BGMI streamers in Hindi").niches, ["Gaming"]);
  assert.ok(parseBrief("MSI laptop reviewers").terms.includes("msi"));
  assert.equal(parseBrief("creators like Technical Guruji, under 1m").likeName, "Technical Guruji");
});

test("topics rank who actually makes the content; exclusions and lookalikes apply", () => {
  const all = CREATORS.map((c, i) => ({ ...c, id: i }));
  const b = contextualize(parseBrief("boat earbuds review"), all);
  assert.ok(score(all[0], b).score > score(all[1], b).score);
  assert.ok(score(all[0], b).signals.some((s) => s.label.startsWith("Topics ·")));
  assert.equal(score(all[1], contextualize(parseBrief("creators, no paneer"), all)).fits, false);
  const like = contextualize(parseBrief("creators like Fixture Tech"), all);
  assert.equal(like.like?.name, "Fixture Tech");
  assert.deepEqual(like.niches, ["Tech"]); // inherits the named creator's niche
  assert.equal(score(all[0], like).fits, false); // not themselves
});

test("a platform with no tracked creators says so instead of returning nothing", () => {
  const all = CREATORS.map((c, i) => ({ ...c, id: i })); // YouTube only
  const b = contextualize(parseBrief("Instagram fitness creators in India"), all);
  assert.equal(b.platform, undefined);
  assert.equal(b.platformMissing, "Instagram");
  assert.ok(describe(b).includes("Instagram not tracked yet"));
});

test("secondary niche: a Tech channel that also makes Gaming fits a gaming brief, below a primary gamer", () => {
  const gamer = { ...CREATORS[0], id: 5, channelId: "UC_g", niche: "Gaming", secondaryNiche: null, nicheConfidence: 0.95 };
  const hybrid = { ...CREATORS[0], id: 6, channelId: "UC_h", niche: "Tech", secondaryNiche: "Gaming", nicheConfidence: 0.6 };
  const b = parseBrief("gaming creators");
  const g = score(gamer, b), h = score(hybrid, b), t = score({ ...CREATORS[0], secondaryNiche: null }, b);
  assert.ok(g.fits && h.fits && !t.fits);
  assert.ok(g.score > h.score);
  assert.ok(h.signals.some((s) => s.label.startsWith("Also makes Gaming")));
});

test("excluding a niche keyword drops that topic, not the whole niche ('gaming but not bgmi' stays Gaming)", () => {
  const b = parseBrief("gaming creators but not bgmi");
  assert.deepEqual([b.niches, b.excludeNiches, b.excludeTerms], [["Gaming"], [], ["bgmi"]]);
  assert.deepEqual(parseBrief("creators, not gaming").excludeNiches, ["Gaming"]);
});

test("phrasing: Hindi script, everyday synonyms and typos read like the plain-English brief", () => {
  const hi = parseBrief("टेक रिव्यू हिंदी");
  assert.deepEqual([hi.niches, hi.languages, hi.terms], [["Tech"], ["Hindi"], ["review"]]);
  assert.deepEqual(parseBrief("affordable mobile").terms, ["budget", "phone"]);
  const pool = [0, 1, 2, 3].map((i) => ({ ...base, id: i, channelId: `UC_${i}` }));
  const typo = contextualize(parseBrief("ernbuds reveiw"), pool);
  assert.deepEqual(typo.terms, ["earbud", "review"]);
  assert.ok(describe(typo).includes("“ernbuds” → earbud"));
  assert.deepEqual(contextualize(parseBrief("fitnes creators"), pool).niches, ["Fitness"]);
  assert.equal(contextualize(parseBrief("creators like Fixtur Tech"), pool).corrected, undefined); // names aren't typos
});

test("brand signals: active, lightly sponsored and clean channels rank up; 'brand safe' briefs drop flagged ones", () => {
  const b = parseBrief("tech creators");
  const now = score(base, b).score;
  assert.ok(score({ ...base, lastUploadDays: 200 }, b).score < now); // inactive
  assert.ok(score({ ...base, sponsoredPct: 80 }, b).score < now); // ad-heavy
  const flagged = { ...base, safety: ["profanity"] };
  assert.ok(score(flagged, b).fits && score(flagged, b).score < now);
  const safe = parseBrief("brand safe tech creators");
  assert.equal(safe.safeOnly, true);
  assert.deepEqual(safe.terms, []);
  assert.equal(score(flagged, safe).fits, false);
  assert.equal(score({ ...base, lastUploadDays: null, sponsoredPct: null }, b).signals.some((s) => /Active|sponsor/.test(s.label)), false); // unknown = neutral
});

test("Indian scripts and Hinglish map to known words; a brief with nothing recognisable is flagged", () => {
  const pool = [0, 1, 2, 3].map((i) => ({ ...base, id: i, channelId: `UC_${i}` }));
  assert.deepEqual(parseBrief("குழந்தை பாடல்கள்").niches, ["Kids"]);
  assert.deepEqual(parseBrief("రుచికరమైన వంటలు").niches, ["Food"]);
  assert.deepEqual(parseBrief("paisa kaise bachaye").niches, ["Finance"]);
  assert.equal(contextualize(parseBrief("paisa kaise bachaye"), pool).corrected, undefined); // mapped words are not typos
  assert.deepEqual(parseBrief("gaane sunao").niches, ["Music"]);
  assert.deepEqual(parseBrief("রান্না").niches, ["Food"]);
  assert.equal(understoodNothing(contextualize(parseBrief("zxqv plorb"), pool)), true);
  assert.equal(understoodNothing(contextualize(parseBrief("earbud"), pool)), false);
});
