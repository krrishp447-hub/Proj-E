import type { LucideIcon } from "lucide-react";
import type { Creator } from "@/lib/scout/data";

/** Live numbers for a niche from the demo dataset, so the visuals show data rather than decoration. */
export function nicheStats(niche: string, creators: Creator[]) {
  const cs = creators.filter((c) => c.niche === niche);
  const avg = (f: (c: (typeof cs)[number]) => number) => (cs.length ? cs.reduce((s, c) => s + f(c), 0) / cs.length : 0);
  return { count: cs.length, eng: avg((c) => c.eng).toFixed(1), auth: Math.round(avg((c) => c.auth)) };
}

type Props = {
  icon: LucideIcon;
  bg: string; // solid CSS colour
  fg?: string;
  tag: string;
  title?: string;
  stats?: string;
  className?: string;
};

/** Flat vector card: solid pop colour, one icon, mono readouts. No imagery, no gradients. */
export function NichePanel({ icon: Icon, bg, fg = "var(--ink)", tag, title, stats, className = "" }: Props) {
  return (
    <div className={`npanel ${className}`} style={{ background: bg, color: fg }}>
      <span className="npanel-tag mono">{tag}</span>
      <Icon className="npanel-icon" strokeWidth={1.4} aria-hidden="true" />
      {(title || stats) && (
        <div className="npanel-foot">
          {title && <span className="npanel-title">{title}</span>}
          {stats && <span className="npanel-stats mono">{stats}</span>}
        </div>
      )}
    </div>
  );
}
