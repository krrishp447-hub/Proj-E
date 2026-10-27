import { LOGO } from "./logo-data";

// The ScoutBlack wordmark. Letters and disc take currentColor; the dot takes --logo-dot (defaults to the signal blue).
// aspect-ratio gives the svg an intrinsic width, so `height: Npx; width: auto` works inside shrink-to-fit grid/flex cells.
const [, , vbW, vbH] = LOGO.viewBox.split(" ");

export function Logo({ className, title = "ScoutBlack" }: { className?: string; title?: string }) {
  return (
    <svg className={className} style={{ aspectRatio: `${vbW} / ${vbH}` }} viewBox={LOGO.viewBox} role="img" aria-label={title} fill="currentColor">
      {LOGO.letters.map((l) => <path key={l.x} transform={`translate(${l.x} 0)`} d={l.d} />)}
      <circle cx={LOGO.disc.cx} cy={LOGO.disc.cy} r={LOGO.disc.r} />
      <circle cx={LOGO.dot.cx} cy={LOGO.dot.cy} r={LOGO.dot.r} fill="var(--logo-dot, var(--signal))" />
    </svg>
  );
}
