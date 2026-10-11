import { ChefHat, Dumbbell, Gamepad2, Headphones, IndianRupee, Plane, Smartphone } from "lucide-react";
import { NichePanel, nicheStats } from "@/components/ui/NichePanel";
import { BriefTry } from "./BriefTry";
import { Showreel } from "./Showreel";

export function Manifesto() {
  return (
    <section id="manifesto" className="sec manifesto wipe" data-io>
      <span className="plus c-tl" /><span className="plus c-br" />
      <div className="edge">
        <div className="mono mb-[34px]">01 — THE THESIS / 1ST FEB /25</div>
        <p className="disp big" data-scrub>
          <span className="ln">WE DON&apos;T HELP BRANDS FIND</span>{" "}
          <span className="ln">MORE CREATORS. WE HELP THEM</span>{" "}
          <span className="ln">FIND <em className="hl">THE RIGHT ONES</em> — RANKED</span>{" "}
          <span className="ln">ON WHAT ACTUALLY WORKED.</span>
        </p>
        <Showreel />
      </div>
    </section>
  );
}

const pillars = [
  { title: "Search in plain English", desc: "DESCRIBE THE CAMPAIGN · NICHE · SUB-NICHE · AUDIENCE · SIZE · NO FILTER MAZES", more: "HOW IT PARSES →" },
  { title: "Ranked on eight signals", desc: "SUB-NICHE FIT · ENGAGEMENT · GROWTH · REACH · AUTHENTICITY · PROVEN RESULTS · NOT FOLLOWER COUNT", more: "THE SCORE MODEL →" },
  { title: "Verified, not inflated", desc: "AUTHENTICITY SCORES · SUSPICIOUS-FOLLOWER FLAGS · FRESHNESS STAMPS · AUDIENCE OVERLAP", more: "TRUST LAYER →" },
];

export function Pillars() {
  return (
    <section className="sec pillars" data-io>
      <div className="edge">
        <div className="dash-h mb-[60px]" />
        <div className="pcols">
          <div className="divV dash-v left-1/3" />
          <div className="divV dash-v left-2/3" />
          {pillars.map((p, i) => (
            <div key={p.title} className="pcol rev" style={{ "--d": `${i * 0.12}s` } as React.CSSProperties}>
              <div className="pnum" aria-hidden="true">0{i + 1}</div>
              <h2 className="ptitle">{p.title}</h2>
              <p className="desc">{p.desc}</p>
              <div className="mt-[22px]"><span className="arrow">{p.more}</span></div>
            </div>
          ))}
        </div>
        <BriefTry />
      </div>
    </section>
  );
}

// Solid pop colours only; each card is a niche with its live average engagement from the demo dataset.
const collage = [
  { par: 1.15, left: "2%", top: "30%", bg: "var(--signal)", tag: "YT · TECH", niche: "Tech", icon: Smartphone },
  { par: 0.85, left: "16%", top: "6%", bg: "var(--pop)", tag: "IG · FIT", niche: "Fitness", icon: Dumbbell },
  { par: 1.1, left: "31%", top: "40%", bg: "var(--data)", tag: "AUDIO", niche: "Tech", icon: Headphones },
  { par: 0.9, left: "46%", top: "12%", bg: "var(--sun)", tag: "FINANCE", niche: "Finance", icon: IndianRupee },
  { par: 1.2, left: "61%", top: "36%", bg: "var(--ink)", fg: "var(--paper)", tag: "GAMING", niche: "Gaming", icon: Gamepad2 },
  { par: 0.8, left: "75%", top: "4%", bg: "var(--tang)", tag: "FOOD", niche: "Food", icon: ChefHat },
  { par: 1.05, left: "86%", top: "38%", bg: "var(--signal)", tag: "TRAVEL", niche: "Travel", icon: Plane },
];

export function Collage() {
  return (
    <section className="sec collage" data-io>
      <span className="plus c-tl" /><span className="plus c-tr" />
      <div className="edge">
        <div className="cstrip" aria-hidden="true">
          {collage.map((c) => (
            <div key={c.tag} className="ccard" data-par={c.par} style={{ left: c.left, top: c.top }}>
              <NichePanel icon={c.icon} bg={c.bg} fg={c.fg} tag={c.tag} stats={`ENG ${nicheStats(c.niche).eng}%`} className="h-full" />
            </div>
          ))}
        </div>
        <h2 className="disp huge rev">ONE SEARCH.<br />THE RIGHT TEN.</h2>
      </div>
    </section>
  );
}
