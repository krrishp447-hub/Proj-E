import { ChefHat, Dumbbell, Gamepad2, Headphones, IndianRupee, Plane, Smartphone } from "lucide-react";
import { NichePanel, nicheStats } from "@/components/ui/NichePanel";
import { PillarExplorer } from "./PillarExplorer";
import { getCreators, getHomeCreators } from "@/server/creators";
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

export async function Pillars() {
  const { creators } = await getHomeCreators();
  return (
    <section className="sec pillars" data-io>
      <div className="edge">
        <div className="dash-h mb-[60px]" />
        <PillarExplorer creators={creators} />
      </div>
    </section>
  );
}

// Solid pop colours only; each card is a niche with its live average engagement from the demo dataset.
const collage = [
  { par: 1.15, left: "2%", top: "30%", bg: "var(--signal)", tag: "YT · TECH", niche: "Tech", icon: Smartphone },
  { par: 0.85, left: "16%", top: "6%", bg: "var(--pop)", tag: "YT · FIT", niche: "Fitness", icon: Dumbbell },
  { par: 1.1, left: "31%", top: "40%", bg: "var(--data)", tag: "AUDIO", niche: "Tech", icon: Headphones },
  { par: 0.9, left: "46%", top: "12%", bg: "var(--sun)", tag: "FINANCE", niche: "Finance", icon: IndianRupee },
  { par: 1.2, left: "61%", top: "36%", bg: "var(--ink)", fg: "var(--paper)", tag: "GAMING", niche: "Gaming", icon: Gamepad2 },
  { par: 0.8, left: "75%", top: "4%", bg: "var(--tang)", tag: "FOOD", niche: "Food", icon: ChefHat },
  { par: 1.05, left: "86%", top: "38%", bg: "var(--signal)", tag: "TRAVEL", niche: "Travel", icon: Plane },
];

export async function Collage() {
  const { creators } = await getCreators();
  return (
    <section className="sec collage" data-io>
      <span className="plus c-tl" /><span className="plus c-tr" />
      <div className="edge">
        <div className="cstrip" aria-hidden="true">
          {collage.map((c) => (
            <div key={c.tag} className="ccard" data-par={c.par} style={{ left: c.left, top: c.top }}>
              <NichePanel icon={c.icon} bg={c.bg} fg={c.fg} tag={c.tag} stats={`ENG ${nicheStats(c.niche, creators).eng}%`} className="h-full" />
            </div>
          ))}
        </div>
        <h2 className="disp huge rev">ONE SEARCH.<br />THE RIGHT TEN.</h2>
      </div>
    </section>
  );
}
