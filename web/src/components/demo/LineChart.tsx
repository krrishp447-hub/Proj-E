import { fmt } from "@/lib/scout/engine";

/** Minimal labelled line chart (solid stroke, no gradients): y = 0..max, first/last dates on x. */
export function LineChart({ points, label }: { points: { day: string; views: number }[]; label: string }) {
  const w = 640, h = 180, pad = { l: 44, r: 12, t: 12, b: 24 };
  const max = Math.max(...points.map((p) => p.views), 1);
  const x = (i: number) => pad.l + (i / Math.max(points.length - 1, 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const line = points.map((p, i) => `${x(i)},${y(p.views)}`).join(" ");
  const last = points.at(-1);
  const short = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <svg className="d-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}: ${last ? fmt(last.views) : 0} by ${last ? short(last.day) : "today"}`}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={w - pad.r} y1={y(max * f)} y2={y(max * f)} className="d-chart-grid" />
          <text x={pad.l - 6} y={y(max * f) + 4} textAnchor="end" className="d-chart-tick">{fmt(Math.round(max * f))}</text>
        </g>
      ))}
      <polyline points={line} fill="none" className="d-chart-line" />
      {last && <circle cx={x(points.length - 1)} cy={y(last.views)} r="4" className="d-chart-dot" />}
      {points.length > 1 && (
        <>
          <text x={pad.l} y={h - 6} className="d-chart-tick">{short(points[0].day)}</text>
          <text x={w - pad.r} y={h - 6} textAnchor="end" className="d-chart-tick">{short(points[points.length - 1].day)}</text>
        </>
      )}
    </svg>
  );
}
