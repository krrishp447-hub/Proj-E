// Creator shape shared by the engine and the UI. Rows come from the live YouTube pipeline (src/server/creators.ts).

export type Platform = "YouTube" | "Instagram";

export type Creator = {
  id: number;
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
  // Audience demographics only exist once a creator connects their account (platform APIs don't
  // expose them to third parties), so live public-data creators carry empty geo/age and null male.
  geo: [string, number][];
  age: number[]; // 13-17, 18-24, 25-34, 35+
  male: number | null; // % male audience
  trend: number[]; // 12-month reach (K)
  collabs: number; // past brand collaborations
  language: string; // primary content language (spoken-audio setting, else detected from titles)
  auth: number; // authenticity score
  suspicious: number; // % suspicious followers
  campaigns: number; // campaigns completed on Scout
  repeat: number; // % brands that re-booked
  delivery: number; // delivered ÷ promised reach
  proven: boolean;
  verifiedDays: number; // data freshness
  source: "youtube";
};

export const NICHES = ["Tech", "Fitness", "Food", "Travel", "Fashion", "Beauty", "Finance", "Gaming", "Education", "Automotive", "Entertainment", "Parenting"];
export const AGE_BANDS = ["13–17", "18–24", "25–34", "35+"];

/** Colour only the outliers, so colour stays meaningful in a table of mostly-normal values. */
export const authTone = (auth: number) => (auth >= 82 ? "is-good" : auth <= 75 ? "is-warn" : "");
export const suspiciousTone = (pct: number) => (pct <= 5 ? "is-good" : pct >= 10 ? "is-warn" : "");
