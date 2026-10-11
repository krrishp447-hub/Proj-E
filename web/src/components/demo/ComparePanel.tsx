import { fmt, overlap, type Match } from "@/lib/scout/engine";
import { Bar } from "./DetailPanel";

type Row = { label: string; show: (m: Match) => string; value?: (m: Match) => number };
const ROWS: Row[] = [
  { label: "Match", show: (m) => `${m.score}`, value: (m) => m.score },
  { label: "Subscribers", show: (m) => fmt(m.creator.subs), value: (m) => m.creator.subs },
  { label: "Engagement", show: (m) => `${m.creator.eng}%`, value: (m) => m.creator.eng },
  { label: "Growth 90d", show: (m) => `+${m.creator.growth}%`, value: (m) => m.creator.growth },
  { label: "Authenticity", show: (m) => `${m.creator.auth}`, value: (m) => m.creator.auth },
  { label: "Suspicious", show: (m) => `${m.creator.suspicious}%`, value: (m) => -m.creator.suspicious },
  { label: "Repeat brands", show: (m) => `${m.creator.repeat}%`, value: (m) => m.creator.repeat },
  { label: "Delivered", show: (m) => `${m.creator.delivery}×`, value: (m) => m.creator.delivery },
  { label: "Top market", show: (m) => `${m.creator.geo[0][0]} ${m.creator.geo[0][1]}%` },
];

const first = (name: string) => name.split(" ")[0];

export function ComparePanel({ matches, onRemove }: { matches: Match[]; onRemove: (id: number) => void }) {
  const pairs = matches
    .flatMap((a, i) => matches.slice(i + 1).map((b) => ({ a, b, o: overlap(a.creator, b.creator) })))
    .sort((x, y) => y.o - x.o);
  const worst = pairs[0];

  return (
    <div className="d-compare">
      <div className="d-cmpscroll">
        <table className="d-cmp">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Metric</span></th>
              {matches.map((m) => (
                <th key={m.creator.id} scope="col">
                  {first(m.creator.name)}
                  <button type="button" className="d-x" onClick={() => onRemove(m.creator.id)} aria-label={`Remove ${m.creator.name}`}>×</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const vals = r.value ? matches.map(r.value) : [];
              const best = vals.length ? Math.max(...vals) : NaN;
              const unique = vals.filter((v) => v === best).length === 1;
              return (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {matches.map((m, i) => (
                    <td key={m.creator.id} className={`d-mono ${unique && vals[i] === best ? "is-best" : ""}`}>{r.show(m)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="d-legend">Best value per row highlighted.</p>

      <h3>Audience overlap</h3>
      {pairs.map(({ a, b, o }) => (
        <Bar key={`${a.creator.id}-${b.creator.id}`} label={`${first(a.creator.name)} × ${first(b.creator.name)}`} value={o} text={`${o}%`} tone={o >= 55 ? "bad" : "base"} />
      ))}
      <p className={`d-callout ${worst.o >= 55 ? "is-bad" : "is-good"}`}>
        {worst.o >= 55
          ? `${first(worst.a.creator.name)} and ${first(worst.b.creator.name)} share ~${worst.o}% of their audience — booking both pays twice for the same viewers.`
          : "Low overlap — this shortlist reaches largely different audiences."}
      </p>
    </div>
  );
}
