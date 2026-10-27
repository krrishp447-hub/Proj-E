import { useEffect, useRef, type ReactNode } from "react";
import { fairRate } from "@/lib/scout/campaigns";
import { AGE_BANDS } from "@/lib/scout/data";
import { audienceVerified, fmt, overlap, type Match } from "@/lib/scout/engine";
import { Bar } from "./DetailPanel";

type Row = { label: string; show: (m: Match) => string; value?: (m: Match) => number; has?: (m: Match) => boolean };
const inr = (n: number) => (n >= 1e5 ? `₹${(n / 1e5).toFixed(1).replace(".0", "")}L` : `₹${Math.round(n / 1000)}K`);
const rate = (m: Match) => fairRate(m.creator.views, m.creator.eng);
const ageIdx = (m: Match) => m.creator.age.indexOf(Math.max(...m.creator.age));

// `value`: higher is better (best per row is highlighted). `has`: hide the row when no creator has the data,
// e.g. campaign history before anyone has run a campaign on ScoutBlack.
const ROWS: Row[] = [
  { label: "Match", show: (m) => `${m.score}`, value: (m) => m.score },
  { label: "Subscribers", show: (m) => fmt(m.creator.subs), value: (m) => m.creator.subs },
  { label: "Avg views", show: (m) => fmt(m.creator.views), value: (m) => m.creator.views },
  { label: "Views ÷ subs", show: (m) => `${m.creator.subs ? Math.round((m.creator.views / m.creator.subs) * 100) : 0}%`, value: (m) => (m.creator.subs ? m.creator.views / m.creator.subs : 0) },
  { label: "Engagement", show: (m) => `${m.creator.eng}%`, value: (m) => m.creator.eng },
  { label: "Consistency", show: (m) => `${m.creator.consistency}`, value: (m) => m.creator.consistency },
  { label: "Growth 90d", show: (m) => `+${m.creator.growth}%`, value: (m) => m.creator.growth, has: (m) => m.creator.growth !== 0 },
  { label: "Authenticity", show: (m) => `${m.creator.auth}`, value: (m) => m.creator.auth },
  { label: "Suspicious", show: (m) => `${m.creator.suspicious}%`, value: (m) => -m.creator.suspicious },
  { label: "Last upload", show: (m) => (m.creator.lastUploadDays == null ? "—" : m.creator.lastUploadDays === 0 ? "today" : `${m.creator.lastUploadDays}d ago`), value: (m) => -(m.creator.lastUploadDays ?? Infinity), has: (m) => m.creator.lastUploadDays != null },
  { label: "Sponsored uploads", show: (m) => (m.creator.sponsoredPct == null ? "—" : `${m.creator.sponsoredPct}%`), has: (m) => m.creator.sponsoredPct != null },
  { label: "Brand safety", show: (m) => (m.creator.safety.length ? `⚠ ${m.creator.safety.join(", ")}` : "✓ Clean"), value: (m) => -m.creator.safety.length, has: (m) => m.creator.lastUploadDays != null },
  { label: "Language", show: (m) => m.creator.language },
  { label: "Niche", show: (m) => m.creator.niche },
  // cost is compared per 1,000 views (a cheaper flat rate usually just means a smaller channel)
  { label: "Market rate / video", show: (m) => `${inr(rate(m).low)}–${inr(rate(m).high)}` },
  { label: "Cost per 1K views", show: (m) => (m.creator.views ? `₹${Math.round(rate(m).low / (m.creator.views / 1000))}` : "—"), value: (m) => (m.creator.views ? -rate(m).low / m.creator.views : -Infinity) },
  { label: "Verified audience", show: (m) => (audienceVerified(m.creator) ? "✓ Yes" : "—"), has: (m) => audienceVerified(m.creator) },
  { label: "Top market", show: (m) => (m.creator.geo[0] ? `${m.creator.geo[0][0]} ${m.creator.geo[0][1]}%` : "—"), has: (m) => m.creator.geo.length > 0 },
  { label: "Largest age group", show: (m) => (m.creator.age.length ? `${AGE_BANDS[ageIdx(m)]} · ${m.creator.age[ageIdx(m)]}%` : "—"), has: (m) => m.creator.age.length > 0 },
  { label: "Male audience", show: (m) => (m.creator.male !== null ? `${m.creator.male}%` : "—"), has: (m) => m.creator.male !== null },
  { label: "Campaigns on ScoutBlack", show: (m) => `${m.creator.campaigns}`, value: (m) => m.creator.campaigns, has: (m) => m.creator.campaigns > 0 },
  { label: "Repeat brands", show: (m) => `${m.creator.repeat}%`, value: (m) => m.creator.repeat, has: (m) => m.creator.repeat > 0 },
  { label: "Delivered ÷ promised", show: (m) => `${m.creator.delivery}×`, value: (m) => m.creator.delivery, has: (m) => m.creator.campaigns > 0 },
];

// Short column label: first two words, capped ("MR. INDIAN HACKER" → "MR. INDIAN", not "MR.")
const first = (name: string) => {
  const two = name.split(/\s+/).slice(0, 2).join(" ");
  return two.length > 16 ? `${two.slice(0, 15)}…` : two;
};

/** One-line read of the shortlist: who wins on fit, on reach, on cost. */
function verdict(matches: Match[]) {
  const top = (f: (m: Match) => number) => matches.reduce((a, b) => (f(b) > f(a) ? b : a));
  const fit = top((m) => m.score), reach = top((m) => m.creator.views), value = top((m) => (m.creator.views ? -rate(m).low / m.creator.views : -Infinity));
  const parts = [`Best fit: ${fit.creator.name} (${fit.score})`];
  if (reach !== fit) parts.push(`most reach: ${reach.creator.name} (${fmt(reach.creator.views)} avg views)`);
  if (value !== fit && value !== reach) parts.push(`cheapest per view: ${value.creator.name}`);
  return parts.join(" · ");
}

export function ComparePanel({ matches, onRemove }: { matches: Match[]; onRemove: (channelId: string) => void }) {
  const pairs = matches
    .flatMap((a, i) => matches.slice(i + 1).map((b) => ({ a, b, o: overlap(a.creator, b.creator), verified: audienceVerified(a.creator) && audienceVerified(b.creator) })))
    .sort((x, y) => y.o - x.o);
  const worstVerified = pairs.find((p) => p.verified);
  const rows = ROWS.filter((r) => !r.has || matches.some(r.has));
  const hidden = ROWS.length - rows.length;

  return (
    <div className="d-compare">
      <p className="d-callout is-good">{verdict(matches)}</p>
      <div className="d-cmpscroll">
        <table className="d-cmp">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Metric</span></th>
              {matches.map((m) => (
                <th key={m.creator.channelId} scope="col" title={m.creator.name}>
                  {first(m.creator.name)}
                  <button type="button" className="d-x" onClick={() => onRemove(m.creator.channelId)} aria-label={`Remove ${m.creator.name}`}>×</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const vals = r.value ? matches.map(r.value) : [];
              const best = vals.length ? Math.max(...vals) : NaN;
              const unique = vals.filter((v) => v === best).length === 1;
              return (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {matches.map((m, i) => (
                    <td key={m.creator.channelId} className={`d-mono ${unique && vals[i] === best ? "is-best" : ""}`}>{r.show(m)}</td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <th scope="row"><span className="sr-only">Actions</span></th>
              {matches.map((m) => (
                <td key={m.creator.channelId}>{m.creator.claimed ? <a className="d-link" href={`/dashboard/offers/new?to=${encodeURIComponent(m.creator.channelId)}`}>Offer →</a> : <span className="d-sub">Not on ScoutBlack yet</span>}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {matches.some((m) => m.creator.claimed) && <a className="d-btn d-cmpgo" href={`/dashboard/offers/new?to=${matches.filter((m) => m.creator.claimed).map((m) => encodeURIComponent(m.creator.channelId)).join(",")}`}>
        Send offer to {matches.every((m) => m.creator.claimed) ? `all ${matches.length}` : `the ${matches.filter((m) => m.creator.claimed).length} on ScoutBlack`} <span className="arw">→</span>
      </a>}
      <p className="d-legend">
        Best value per row highlighted. Market rate is ₹400–₹900 per 1,000 views, adjusted for engagement.
        {hidden > 0 && ` ${hidden} rows hidden: no creator here has that data yet (campaign history, connected audience).`}
      </p>

      <h3>Audience overlap</h3>
      {pairs.map(({ a, b, o, verified }) => (
        <Bar
          key={`${a.creator.channelId}-${b.creator.channelId}`}
          label={`${first(a.creator.name)} × ${first(b.creator.name)}${verified ? "" : " (est.)"}`}
          value={o}
          text={`${o}%`}
          tone={verified && o >= 55 ? "bad" : "base"}
        />
      ))}
      {worstVerified && worstVerified.o >= 55 ? (
        <p className="d-callout is-bad">
          {first(worstVerified.a.creator.name)} and {first(worstVerified.b.creator.name)} share ~{worstVerified.o}% of their verified audience: booking both pays twice for the same viewers.
        </p>
      ) : pairs.some((p) => !p.verified) ? (
        <p className="d-hint">
          “est.” pairs are estimated from niche, country and platform only, because at least one creator hasn&apos;t connected their
          audience. Treat them as a rough guide; verified pairs use real age, gender and country data.
        </p>
      ) : (
        <p className="d-callout is-good">Low overlap on verified audiences: this shortlist reaches largely different viewers.</p>
      )}
    </div>
  );
}

/** Compare opens full screen (a modal dialog): Esc or "Back to results" closes it; focus returns to the page. */
export function CompareDialog({ count, onClose, children }: { count: number; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} className="d-cmpdlg" aria-label={`Compare ${count} creators`} onClose={onClose} data-lenis-prevent>
      <div className="d-cmpdlg-head">
        <h2>Compare {count} creators</h2>
        <button type="button" className="d-btn ghost" onClick={onClose}>← Back to results</button>
      </div>
      {children}
    </dialog>
  );
}
