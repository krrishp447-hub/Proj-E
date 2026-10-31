// Illustrative creators from the Scout demo dataset (fictional people; shown as product UI, not results).
export type Creator = {
  name: string;
  meta: string;
  subs: string;
  eng: string;
  score: number;
  color: string;
  proven?: boolean;
};

export const TOP10: Creator[] = [
  { name: "Tech With Arjun", meta: "YouTube · India · Tech", subs: "312K", eng: "5.8%", score: 95, color: "#3B5BDB", proven: true },
  { name: "EarbudExpert", meta: "YouTube · India · Audio", subs: "132K", eng: "7.9%", score: 91, color: "#0E8F6B", proven: true },
  { name: "GadgetGirl Priya", meta: "YouTube · India · Tech", subs: "189K", eng: "6.9%", score: 87, color: "#B7791F" },
  { name: "Kiran Tech Tamil", meta: "YouTube · India · TWS", subs: "98K", eng: "9.1%", score: 84, color: "#6741B5" },
  { name: "Neha Unboxed", meta: "Instagram · India · Tech", subs: "240K", eng: "7.4%", score: 82, color: "#1E7FA8", proven: true },
  { name: "AudioPhile Akash", meta: "YouTube · India · Audio", subs: "74K", eng: "8.3%", score: 80, color: "#8E44AD" },
  { name: "TechSavvy Sam", meta: "YouTube · US · ANC", subs: "275K", eng: "5.0%", score: 74, color: "#596273" },
  { name: "Rohit Reviews", meta: "YouTube · India · Budget", subs: "468K", eng: "4.1%", score: 71, color: "#C05621", proven: true },
  { name: "Dev Codes", meta: "YouTube · India · Dev", subs: "410K", eng: "6.6%", score: 68, color: "#4152B5" },
  { name: "Tech Talk Tara", meta: "YouTube · India · Tech", subs: "156K", eng: "6.1%", score: 66, color: "#2F8F5B" },
];

export const initials = (n: string) =>
  n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// Results panel geometry (px, 1920×1080). Field.tsx aims the ten chosen points at the ring centres.
export const PANEL = { left: 880, width: 900, top: 196, rowH: 74 };
export const RING = { r: 24, stroke: 5 };
export const ringCenter = (i: number) => ({
  x: PANEL.left + PANEL.width - 28, // ring sits in the last 56px grid column
  y: PANEL.top + PANEL.rowH / 2 + i * PANEL.rowH,
});
