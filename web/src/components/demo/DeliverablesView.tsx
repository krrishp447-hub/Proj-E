import { fmt } from "@/lib/scout/engine";
import { isLate, type Deal } from "@/lib/scout/campaigns";
import { DEMO_DELIVERABLES, DEMO_TODAY, DEMO_VIDEOS } from "@/lib/scout/campaign-demo";
import { LineChart } from "./LineChart";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const date = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Creator view: every deliverable across deals — due dates, live posts and how each is performing vs. the projection. */
export function DeliverablesView({ creatorId, deals }: { creatorId: number; deals: Deal[] }) {
  const mine = DEMO_DELIVERABLES.filter((d) => d.creatorId === creatorId && deals.some((x) => x.id === d.dealId));
  if (!mine.length) return <p className="d-empty">No deliverables yet — they appear here once a deal is contracted.</p>;
  const best = mine.map((d) => DEMO_VIDEOS.find((v) => v.id === d.videoId)).filter((v) => v).sort((a, b) => b!.views - a!.views)[0];

  return (
    <div className="d-stack">
      <section className="d-tablewrap" aria-label="Deliverables">
        <table className="d-table">
          <thead><tr><th scope="col">Deliverable</th><th scope="col">Due</th><th scope="col">Status</th><th scope="col" className="d-num">Views ÷ projected</th><th scope="col" className="d-num d-c-opt">Eng.</th><th scope="col" className="d-num d-c-opt">Fee</th></tr></thead>
          <tbody>
            {mine.map((d) => {
              const deal = deals.find((x) => x.id === d.dealId)!;
              const post = DEMO_VIDEOS.find((v) => v.id === d.videoId);
              const late = isLate(d, DEMO_TODAY) || (post && post.publishedAt.slice(0, 10) > d.due);
              const ratio = post ? post.views / d.projectedViews : 0;
              return (
                <tr key={d.id} className="is-static">
                  <td className="d-wrap"><b>{d.kind}</b><div className="d-sub">{deal.brand} · {deal.title}</div>{post && <a className="d-postlink" href={post.url} target="_blank" rel="noreferrer">{post.title}</a>}</td>
                  <td className="d-mono">{date(d.due)}</td>
                  <td><span className={`d-pill ${d.status === "Live" ? "is-good" : ""} ${late ? "is-late" : ""}`}>{d.status}{late ? (d.status === "Live" ? " · posted late" : " · overdue") : ""}</span></td>
                  <td className="d-num d-c-match">
                    {post ? <><span className="d-meter" aria-hidden="true"><i className={ratio < 1 ? "t-warnbar" : ""} style={{ width: `${(Math.min(ratio, 1.5) / 1.5) * 100}%` }} /></span><b className="d-mono">{fmt(post.views)} · {ratio.toFixed(2)}×</b></> : <span className="d-muted">—</span>}
                  </td>
                  <td className="d-num d-mono d-c-opt">{post ? `${(((post.likes + post.comments) / post.views) * 100).toFixed(1)}%` : "—"}</td>
                  <td className="d-num d-mono d-c-opt">{d.fee ? inr(d.fee) : "incl."}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      {best && (
        <section className="d-tablewrap d-pad" aria-label="Best post">
          <h3 className="d-cardh">Views since posting · {best.title}</h3>
          <LineChart points={best.daily.map((v, i) => ({ day: new Date(new Date(best.publishedAt.slice(0, 10)).getTime() + i * 86_400_000).toISOString().slice(0, 10), views: v }))} label="Views since posting" />
        </section>
      )}
    </div>
  );
}
