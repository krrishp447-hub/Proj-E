// Illustrative demo dataset: fictional creators. Outcome metrics are derived deterministically
// (see DECISIONS.md §9) and stand in for real campaign-outcome pipelines.

export type Platform = "YouTube" | "Instagram";

type Raw = {
  name: string;
  handle: string;
  platform: Platform;
  country: string;
  niche: string;
  tags: string[];
  subs: number;
  eng: number; // engagement rate %
  views: number; // avg views
  growth: number; // 90-day follower growth %
  consistency: number; // 0–100 posting consistency
  geo: [string, number][];
  age: number[]; // 13-17, 18-24, 25-34, 35+
  male: number; // % male audience
  trend: number[]; // 12-month reach (K)
  collabs: number; // past brand collaborations
};

export type Creator = Raw & {
  id: number;
  auth: number; // authenticity score
  suspicious: number; // % suspicious followers
  campaigns: number; // campaigns completed on Scout
  repeat: number; // % brands that re-booked
  delivery: number; // delivered ÷ promised reach
  proven: boolean;
  verifiedDays: number; // data freshness
};

const RAW: Raw[] = [
  { name: "Tech With Arjun", handle: "@techwitharjun", platform: "YouTube", country: "India", niche: "Tech", tags: ["tws", "earbuds", "audio", "reviews"], subs: 312000, eng: 5.8, views: 148000, growth: 7.2, consistency: 92, geo: [["India", 74], ["US", 9], ["UAE", 6], ["Other", 11]], age: [31, 47, 15, 7], male: 68, trend: [40, 52, 48, 61, 70, 66, 82, 88, 95, 90, 104, 112], collabs: 4 },
  { name: "GadgetGirl Priya", handle: "@gadgetgirlpriya", platform: "YouTube", country: "India", niche: "Tech", tags: ["smartphones", "earbuds", "tws", "gadgets"], subs: 189000, eng: 6.9, views: 96000, growth: 11.4, consistency: 88, geo: [["India", 81], ["US", 6], ["UK", 4], ["Other", 9]], age: [38, 42, 14, 6], male: 41, trend: [22, 30, 35, 33, 41, 48, 55, 52, 63, 71, 78, 84], collabs: 3 },
  { name: "AudioPhile Akash", handle: "@audiophileakash", platform: "YouTube", country: "India", niche: "Tech", tags: ["audio", "tws", "headphones", "hifi", "earbuds"], subs: 74000, eng: 8.3, views: 41000, growth: 14.0, consistency: 79, geo: [["India", 69], ["US", 12], ["SG", 5], ["Other", 14]], age: [18, 54, 22, 6], male: 88, trend: [9, 12, 15, 14, 19, 24, 28, 31, 38, 44, 49, 58], collabs: 3 },
  { name: "Rohit Reviews", handle: "@rohitreviews", platform: "YouTube", country: "India", niche: "Tech", tags: ["tws", "earbuds", "budget", "reviews", "gadgets"], subs: 468000, eng: 4.1, views: 210000, growth: 3.1, consistency: 95, geo: [["India", 77], ["BD", 6], ["US", 5], ["Other", 12]], age: [29, 44, 20, 7], male: 72, trend: [160, 158, 171, 165, 180, 176, 188, 190, 195, 201, 205, 210], collabs: 4 },
  { name: "Neha Unboxed", handle: "@nehaunboxed", platform: "Instagram", country: "India", niche: "Tech", tags: ["tws", "lifestyle", "gadgets", "unboxing"], subs: 240000, eng: 7.4, views: 120000, growth: 9.8, consistency: 85, geo: [["India", 83], ["US", 5], ["UAE", 4], ["Other", 8]], age: [44, 40, 12, 4], male: 52, trend: [30, 41, 50, 55, 60, 66, 72, 80, 88, 97, 110, 120], collabs: 3 },
  { name: "Tech Verse Desi", handle: "@techversedesi", platform: "YouTube", country: "India", niche: "Tech", tags: ["smartphones", "laptops", "tech news"], subs: 920000, eng: 3.4, views: 380000, growth: 2.2, consistency: 97, geo: [["India", 70], ["US", 11], ["UK", 6], ["Other", 13]], age: [24, 46, 24, 6], male: 79, trend: [350, 352, 360, 355, 366, 370, 372, 375, 378, 379, 380, 380], collabs: 4 },
  { name: "EarbudExpert", handle: "@earbudexpert", platform: "YouTube", country: "India", niche: "Tech", tags: ["tws", "earbuds", "anc", "comparison", "audio"], subs: 132000, eng: 7.9, views: 71000, growth: 16.5, consistency: 82, geo: [["India", 79], ["US", 7], ["PH", 5], ["Other", 9]], age: [36, 45, 15, 4], male: 70, trend: [18, 25, 30, 38, 44, 51, 60, 68, 79, 91, 108, 124], collabs: 3 },
  { name: "Fit With Kabir", handle: "@fitwithkabir", platform: "Instagram", country: "India", niche: "Fitness", tags: ["fitness", "workout", "nutrition"], subs: 540000, eng: 6.2, views: 200000, growth: 8.0, consistency: 90, geo: [["India", 85], ["US", 4], ["UAE", 5], ["Other", 6]], age: [40, 43, 13, 4], male: 58, trend: [120, 130, 140, 145, 155, 160, 170, 178, 185, 190, 196, 200], collabs: 3 },
  { name: "Simran Cooks", handle: "@simrancooks", platform: "YouTube", country: "India", niche: "Food", tags: ["food", "recipes", "cooking", "vegetarian"], subs: 1200000, eng: 5.1, views: 420000, growth: 4.5, consistency: 93, geo: [["India", 76], ["US", 8], ["UK", 6], ["Other", 10]], age: [20, 41, 29, 10], male: 34, trend: [380, 385, 390, 395, 400, 405, 410, 414, 418, 420, 420, 421], collabs: 3 },
  { name: "Dev Codes", handle: "@devcodes", platform: "YouTube", country: "India", niche: "Tech", tags: ["programming", "coding", "dev", "software"], subs: 410000, eng: 6.6, views: 160000, growth: 12.0, consistency: 86, geo: [["India", 72], ["US", 10], ["DE", 4], ["Other", 14]], age: [48, 44, 6, 2], male: 83, trend: [100, 110, 118, 125, 133, 140, 146, 150, 154, 157, 159, 160], collabs: 3 },
  { name: "Ananya Travels", handle: "@ananyatravels", platform: "Instagram", country: "India", niche: "Travel", tags: ["travel", "lifestyle", "vlog"], subs: 680000, eng: 5.5, views: 250000, growth: 6.0, consistency: 80, geo: [["India", 80], ["US", 6], ["UAE", 5], ["Other", 9]], age: [42, 44, 10, 4], male: 47, trend: [200, 210, 220, 228, 235, 240, 244, 247, 249, 250, 250, 251], collabs: 3 },
  { name: "Kiran Tech Tamil", handle: "@kirantechtamil", platform: "YouTube", country: "India", niche: "Tech", tags: ["tws", "earbuds", "tech", "tamil", "reviews"], subs: 98000, eng: 9.1, views: 58000, growth: 19.2, consistency: 77, geo: [["India", 91], ["SG", 3], ["MY", 3], ["Other", 3]], age: [41, 43, 12, 4], male: 74, trend: [10, 14, 18, 22, 29, 36, 44, 53, 65, 78, 95, 112], collabs: 2 },
  { name: "Style By Meera", handle: "@stylebymeera", platform: "Instagram", country: "India", niche: "Fashion", tags: ["fashion", "beauty", "lifestyle"], subs: 830000, eng: 4.8, views: 300000, growth: 5.2, consistency: 88, geo: [["India", 78], ["US", 7], ["UK", 5], ["Other", 10]], age: [45, 42, 10, 3], male: 22, trend: [260, 268, 275, 282, 288, 292, 296, 298, 300, 300, 301, 302], collabs: 3 },
  { name: "TechSavvy Sam", handle: "@techsavvysam", platform: "YouTube", country: "US", niche: "Tech", tags: ["tws", "earbuds", "audio", "reviews", "anc"], subs: 275000, eng: 5.0, views: 130000, growth: 5.5, consistency: 90, geo: [["US", 71], ["CA", 9], ["UK", 7], ["Other", 13]], age: [27, 43, 24, 6], male: 66, trend: [110, 114, 118, 120, 123, 125, 127, 128, 129, 130, 130, 131], collabs: 3 },
  { name: "MintMoney Ria", handle: "@mintmoneyria", platform: "YouTube", country: "India", niche: "Finance", tags: ["finance", "investing", "money", "stocks"], subs: 520000, eng: 6.0, views: 190000, growth: 10.5, consistency: 91, geo: [["India", 82], ["US", 6], ["UAE", 5], ["Other", 7]], age: [22, 51, 22, 5], male: 64, trend: [140, 150, 158, 165, 172, 178, 183, 186, 188, 189, 190, 190], collabs: 3 },
  { name: "Play With Vivaan", handle: "@playwithvivaan", platform: "YouTube", country: "India", niche: "Gaming", tags: ["gaming", "esports", "tech", "setup"], subs: 760000, eng: 7.1, views: 290000, growth: 9.0, consistency: 84, geo: [["India", 84], ["BD", 5], ["PK", 4], ["Other", 7]], age: [33, 52, 13, 2], male: 81, trend: [230, 240, 250, 258, 266, 272, 278, 282, 286, 288, 290, 291], collabs: 3 },
];

export const CREATORS: Creator[] = RAW.map((c, id) => {
  const j = ((id * 37) % 11) - 5;
  const auth = Math.max(68, Math.min(98, Math.round(60 + c.eng * 2.4 + (c.consistency - 80) * 0.5 + j)));
  const campaigns = c.collabs * 3 + ((id * 13) % 7);
  const repeat = Math.max(20, Math.min(92, Math.round(c.consistency * 0.6 + c.eng * 2.5 + j)));
  const delivery = Math.round((0.85 + c.eng / 18 + (auth - 80) / 120) * 100) / 100;
  return {
    ...c,
    id,
    auth,
    suspicious: Math.max(1, Math.round((100 - auth) * 0.4)),
    campaigns,
    repeat,
    delivery,
    proven: campaigns >= 12 && repeat >= 65 && delivery >= 1.1,
    verifiedDays: 1 + ((id * 29) % 9),
  };
});

export const NICHES = ["Tech", "Fitness", "Food", "Travel", "Fashion", "Finance", "Gaming"];
export const AGE_BANDS = ["13–17", "18–24", "25–34", "35+"];

/** Colour only the outliers, so colour stays meaningful in a table of mostly-normal values. */
export const authTone = (auth: number) => (auth >= 82 ? "is-good" : auth <= 75 ? "is-warn" : "");
export const suspiciousTone = (pct: number) => (pct <= 5 ? "is-good" : pct >= 10 ? "is-warn" : "");
