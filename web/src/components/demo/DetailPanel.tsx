import { AGE_BANDS, authTone, suspiciousTone } from "@/lib/scout/data";
import { fmt, type Match } from "@/lib/scout/engine";

/** Labelled horizontal bar; value is 0–100 unless max is given. */
export function Bar({ label, value, max = 100, text, tone = "base" }: { label: string; value: number; max?: number; text?: string; tone?: "base" | "good" | "bad" }) {
  return (
    <div className="d-bar">
      <span>{label}</span>
      <span className="d-track"><i className={`t-${tone}`} style={{ width: `${(Math.abs(value) / max) * 100}%` }} /></span>
      <b className="d-mono">{text ?? value}</b>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const w = 300, h = 56, lo = Math.min(...data), span = Math.max(...data) - lo || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 4 - ((v - lo) / span) * (h - 8)}`).join(" ");
  return (
    <svg className="d-spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Reach over 12 months: ${data[0]}K to ${data.at(-1)}K`}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function DetailPanel({ m, inShortlist, onToggle }: { m: Match; inShortlist: boolean; onToggle: () => void }) {
  const c = m.creator;
  const top = Math.max(...m.signals.map((s) => Math.abs(s.points)), 1);
  return (
    <div className="d-detail">
      <div className="d-head">
        <div>
          <h2>{c.name}</h2>
          <p className="d-sub">{c.handle} · {c.platform} · {c.country} · {c.niche}</p>
        </div>
        <div className={`d-score ${m.fits ? "" : "is-miss"}`}><b className="d-mono">{m.score}</b><span>match</span></div>
      </div>
      <button type="button" className={`d-btn ${inShortlist ? "is-on" : "ghost"}`} onClick={onToggle}>
        {inShortlist ? "✓ Shortlisted" : "+ Shortlist"}
      </button>

      <dl className="d-grid">
        <div><dt>Subscribers</dt><dd>{fmt(c.subs)}</dd></div>
        <div><dt>Engagement</dt><dd>{c.eng}%</dd></div>
        <div><dt>Avg views</dt><dd>{fmt(c.views)}</dd></div>
        <div><dt>Authenticity</dt><dd className={authTone(c.auth)}>{c.auth}</dd></div>
        <div><dt>Suspicious</dt><dd className={suspiciousTone(c.suspicious)}>{c.suspicious}%</dd></div>
        <div><dt>Repeat brands</dt><dd>{c.repeat}%</dd></div>
      </dl>

      <h3>Why this score</h3>
      {m.signals.map((s) => (
        <Bar key={s.label} label={s.label} value={s.points} max={top} text={`${s.points > 0 ? "+" : ""}${s.points}`} tone={s.points >= 0 ? "good" : "bad"} />
      ))}

      <h3>Track record</h3>
      <dl className="d-grid">
        <div><dt>Campaigns</dt><dd>{c.campaigns}</dd></div>
        <div><dt>Delivered ÷ promised</dt><dd className={c.delivery >= 1 ? "is-good" : "is-warn"}>{c.delivery}×</dd></div>
        <div><dt>Data verified</dt><dd>{c.verifiedDays}d ago</dd></div>
      </dl>

      <h3>Audience</h3>
      {c.geo.map(([g, v]) => <Bar key={g} label={g} value={v} text={`${v}%`} />)}
      <div className="d-gap" />
      {c.age.map((v, i) => <Bar key={AGE_BANDS[i]} label={AGE_BANDS[i]} value={v} text={`${v}%`} />)}
      <Bar label="Male / female" value={c.male} text={`${c.male} / ${100 - c.male}`} />

      <h3>Reach · 12 months</h3>
      <Sparkline data={c.trend} />
    </div>
  );
}
