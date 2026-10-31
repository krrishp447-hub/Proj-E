// Export per-niche stats from the site's demo dataset → src/niches.json (read by the niche reels).
//   node scripts/make-niches.ts
import { writeFileSync } from "node:fs";
import { CREATORS } from "../../../web/src/lib/scout/data.ts";

const NICHES = [
  { slug: "tech", name: "Tech & Audio", niche: "Tech", icon: "Headphones", bg: "#4D74FF", fg: "#0C0D0B" },
  { slug: "fitness", name: "Fitness", niche: "Fitness", icon: "Dumbbell", bg: "#FF3DA6", fg: "#0C0D0B" },
  { slug: "finance", name: "Finance", niche: "Finance", icon: "IndianRupee", bg: "#16C98D", fg: "#0C0D0B" },
  { slug: "gaming", name: "Gaming", niche: "Gaming", icon: "Gamepad2", bg: "#FFC53D", fg: "#0C0D0B" },
  { slug: "fashion", name: "Fashion", niche: "Fashion", icon: "Shirt", bg: "#FF6A3D", fg: "#0C0D0B" },
];
const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

const out = NICHES.map((n, i) => {
  const cs = CREATORS.filter((c) => c.niche === n.niche);
  return {
    ...n,
    index: i + 1,
    count: cs.length,
    eng: +avg(cs.map((c) => c.eng)).toFixed(1),
    auth: Math.round(avg(cs.map((c) => c.auth))),
    growth: +avg(cs.map((c) => c.growth)).toFixed(1),
    top: [...cs].sort((a, b) => b.eng - a.eng).slice(0, 3).map((c) => ({ name: c.name, platform: c.platform, eng: c.eng })),
  };
});
writeFileSync(new URL("../src/niches.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(out.map((n) => `${n.slug}: ${n.count} creators, eng ${n.eng}%, auth ${n.auth}`).join("\n"));
