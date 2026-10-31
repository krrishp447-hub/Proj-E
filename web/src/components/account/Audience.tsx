import { AGE_BANDS } from "@/lib/scout/data";
import { fmt } from "@/lib/scout/engine";

export type ChannelSummary = {
  name: string | null; handle: string | null; niche: string | null; language: string | null;
  subs: number | null; avgViews: number | null; eng: number | null;
  age: number[]; male: number | null; geo: [string, number][]; avgViewPct: number | null; synced: boolean;
  cities?: [string, number][]; // top audience cities (brands planning city launches search by them)
};

const Bar = ({ label, value, text }: { label: string; value: number; text: string }) => (
  <div className="acct-bar"><span>{label}</span><span><i style={{ width: `${value}%` }} /></span><span>{text}</span></div>
);

/** A connected channel: public stats, then the verified (owner-only) audience. */
export function ChannelCard({ c }: { c: ChannelSummary }) {
  return (
    <>
      <p><b>{c.name ?? "Your channel"}</b>{c.handle ? ` · ${c.handle}` : ""}{c.niche ? ` · ${c.niche}` : ""}{c.language ? ` · ${c.language}` : ""}</p>
      {c.subs !== null && (
        <dl className="acct-stats">
          <div><dt>Subscribers</dt><dd>{fmt(c.subs)}</dd></div>
          <div><dt>Avg views</dt><dd>{fmt(c.avgViews ?? 0)}</dd></div>
          <div><dt>Engagement</dt><dd>{c.eng ?? 0}%</dd></div>
          {c.avgViewPct !== null && <div><dt>Avg % watched</dt><dd>{c.avgViewPct}%</dd></div>}
        </dl>
      )}
      {c.synced && c.geo.length ? (
        <div className="acct-bars acct-section">
          <span className="acct-badge">✓ Verified audience · YouTube Analytics, last 90 days</span>
          {c.geo.map(([g, v]) => <Bar key={g} label={g} value={v} text={`${v}%`} />)}
          {c.cities?.map(([city, v]) => <Bar key={`city-${city}`} label={city} value={v} text={`${v}%`} />)}
          {c.age.map((v, i) => <Bar key={AGE_BANDS[i]} label={AGE_BANDS[i]} value={v} text={`${v}%`} />)}
          {c.male !== null && <Bar label="Male" value={c.male} text={`${c.male}%`} />}
        </div>
      ) : (
        <p className="acct-help">Your verified audience appears here after the first sync (usually right away; channels with very few views may have none yet).</p>
      )}
    </>
  );
}
