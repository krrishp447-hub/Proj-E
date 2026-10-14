"use client";

import { useMemo, useState } from "react";
import { CREATORS } from "@/lib/scout/data";
import { fmt } from "@/lib/scout/engine";
import { isLate, matchVideo, rollup, type Campaign, type TrackingRules } from "@/lib/scout/campaigns";
import { DEMO_CAMPAIGNS, DEMO_DELIVERABLES, DEMO_TODAY, DEMO_VIDEOS } from "@/lib/scout/campaign-demo";
import { LineChart } from "./LineChart";

const name = (id: number) => CREATORS[id]?.name ?? `Creator ${id}`;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const date = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const RULE_LABELS: Record<keyof TrackingRules, string> = { hashtags: "Hashtags", links: "Tracking links", mentions: "Brand mentions", keywords: "Product keywords" };

/** Brand view: campaigns whose creator uploads are filed automatically by tracking rules. */
export function CampaignsView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(DEMO_CAMPAIGNS);
  const [id, setId] = useState(DEMO_CAMPAIGNS[0].id);
  const [decisions, setDecisions] = useState<Record<string, "filed" | "rejected">>({}); // brand's calls on the review queue
  const c = campaigns.find((x) => x.id === id)!;

  const { filed, review, organic, r, deliverables } = useMemo(() => {
    const all = DEMO_VIDEOS.map((video) => ({ video, match: matchVideo(video, c) }));
    const decided = (v: { video: { id: string } }) => decisions[`${c.id}:${v.video.id}`];
    const filed = all.filter((x) => (x.match.status === "filed" && decided(x) !== "rejected") || (x.match.status === "review" && decided(x) === "filed"));
    const review = all.filter((x) => x.match.status === "review" && !decided(x));
    const organic = all.filter((x) => x.match.status === "organic");
    const deliverables = DEMO_DELIVERABLES.filter((d) => d.campaignId === c.id);
    return { filed, review, organic, deliverables, r: rollup(filed, deliverables, DEMO_TODAY) };
  }, [c, decisions]);

  const decide = (videoId: string, d: "filed" | "rejected") => setDecisions((x) => ({ ...x, [`${c.id}:${videoId}`]: d }));
  const setRules = (key: keyof TrackingRules, values: string[]) =>
    setCampaigns((cs) => cs.map((x) => (x.id === c.id ? { ...x, rules: { ...x.rules, [key]: values } } : x)));

  const kpis = [
    { label: "Views", value: fmt(r.views), note: `${r.posts} posts` },
    { label: "Engagement", value: `${r.engRate.toFixed(1)}%`, note: fmt(r.engagements) },
    { label: "Spend live", value: inr(r.spend) },
    { label: "Cost / view", value: r.views ? `₹${r.cpv.toFixed(2)}` : "—" },
    { label: "Delivered ÷ promised", value: r.deliveredVsPromised ? `${r.deliveredVsPromised.toFixed(2)}×` : "—", tone: r.deliveredVsPromised >= 1 ? "is-good" : r.deliveredVsPromised ? "is-warn" : "" },
    { label: "On time", value: r.posts ? `${Math.round(r.onTime)}%` : "—", tone: r.onTime < 80 && r.posts ? "is-warn" : "" },
    { label: "Disclosed", value: r.posts ? `${Math.round(r.disclosed)}%` : "—", tone: r.disclosed < 100 && r.posts ? "is-warn" : "is-good" },
  ];

  return (
    <div className="d-campaigns">
      <div className="d-controls">
        <div className="d-seg" role="radiogroup" aria-label="Campaign">
          {campaigns.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={x.id === id} onClick={() => setId(x.id)}>{x.name}</button>
          ))}
        </div>
        <span className="d-lbl">{c.brand} · {c.status} · {date(c.start)} – {date(c.end)} · {c.creatorIds.length} creators contracted</span>
      </div>

      <dl className="d-kpis d-kpis-7">
        {kpis.map((k) => (
          <div key={k.label}><dt>{k.label}</dt><dd className={k.tone}>{k.value}{k.note && <small> {k.note}</small>}</dd></div>
        ))}
      </dl>

      <div className="d-main">
        <div className="d-stack">
          <section className="d-tablewrap d-pad" aria-label="Views over time">
            <h3 className="d-cardh">Campaign views · cumulative</h3>
            {r.posts ? <LineChart points={r.daily} label="Cumulative campaign views" /> : <p className="d-empty">No posts filed yet — they appear here automatically when creators upload.</p>}
          </section>

          <section className="d-tablewrap" aria-label="Campaign folder">
            <h3 className="d-cardh">Campaign folder · filed automatically ({filed.length})</h3>
            {filed.length ? (
              <table className="d-table">
                <thead><tr><th scope="col">Post</th><th scope="col" className="d-c-opt">Matched by</th><th scope="col" className="d-num">Views</th><th scope="col" className="d-num d-c-opt">Eng.</th><th scope="col">Checks</th></tr></thead>
                <tbody>
                  {filed.map(({ video: v, match: m }) => (
                    <tr key={v.id} className="is-static">
                      <td className="d-wrap"><a className="d-postlink" href={v.url} target="_blank" rel="noreferrer">{v.title}</a><div className="d-sub">{name(v.creatorId)} · {v.platform === "YouTube" ? "YT" : "IG"} · {date(v.publishedAt)}</div></td>
                      <td className="d-c-opt"><span className="d-reasons">{m.reasons.map((x) => <span key={x}>{x}</span>)}</span></td>
                      <td className="d-num d-mono">{fmt(v.views)}</td>
                      <td className="d-num d-mono d-c-opt">{(((v.likes + v.comments) / v.views) * 100).toFixed(1)}%</td>
                      <td><span className={m.disclosed ? "is-good" : "is-warn"}>{m.disclosed ? "✓ #ad" : "⚠ no #ad"}</span>{" "}<span className={m.linked ? "is-good" : "d-muted"}>{m.linked ? "✓ link" : "– link"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="d-empty">Nothing filed yet.</p>}
          </section>

          {review.length > 0 && (
            <section className="d-tablewrap d-pad d-review" aria-label="Needs review">
              <h3 className="d-cardh">Needs review ({review.length}) · likely campaign posts without a tracking link or hashtag</h3>
              {review.map(({ video: v, match: m }) => (
                <div key={v.id} className="d-reviewrow">
                  <div>
                    <a className="d-postlink" href={v.url} target="_blank" rel="noreferrer">{v.title}</a>
                    <div className="d-sub">{name(v.creatorId)} · {fmt(v.views)} views · confidence {m.confidence} · {m.reasons.join(" + ")}{!m.disclosed && " · ⚠ no #ad"}</div>
                  </div>
                  <span className="d-actions">
                    <button type="button" className="d-mini" onClick={() => decide(v.id, "filed")}>File it</button>
                    <button type="button" className="d-mini ghost" onClick={() => decide(v.id, "rejected")}>Not this campaign</button>
                  </span>
                </div>
              ))}
            </section>
          )}

          <section className="d-tablewrap" aria-label="Deliverables">
            <h3 className="d-cardh">Deliverables by creator</h3>
            <table className="d-table">
              <thead><tr><th scope="col">Creator</th><th scope="col" className="d-c-opt">Deliverable</th><th scope="col">Due</th><th scope="col">Status</th><th scope="col" className="d-num">Views ÷ projected</th><th scope="col" className="d-num d-c-opt">Fee</th></tr></thead>
              <tbody>
                {deliverables.map((d) => {
                  const post = filed.find((f) => f.video.id === d.videoId)?.video;
                  const late = isLate(d, DEMO_TODAY) || (post && post.publishedAt.slice(0, 10) > d.due);
                  const ratio = post ? post.views / d.projectedViews : 0;
                  return (
                    <tr key={d.id} className="is-static">
                      <td><b>{name(d.creatorId)}</b></td>
                      <td className="d-c-opt">{d.kind}</td>
                      <td className="d-mono">{date(d.due)}</td>
                      <td><span className={`d-pill ${d.status === "Live" ? "is-good" : ""} ${late ? "is-late" : ""}`}>{d.status === "Live" && d.videoId && !post ? "Live · in review" : d.status}{late ? " · late" : ""}</span></td>
                      <td className="d-num d-c-match">
                        {post ? <><span className="d-meter" aria-hidden="true"><i className={ratio < 1 ? "t-warnbar" : ""} style={{ width: `${Math.min(ratio, 1.5) / 1.5 * 100}%` }} /></span><b className="d-mono">{ratio.toFixed(2)}×</b></> : <span className="d-muted">—</span>}
                      </td>
                      <td className="d-num d-mono d-c-opt">{d.fee ? inr(d.fee) : "incl."}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>

        <aside className="d-panel" aria-label="Tracking rules and organic mentions">
          <h3>Tracking rules</h3>
          <p className="d-sub">New uploads from contracted creators are checked against these every day. Tracking link or hashtag files a post automatically; product keywords alone send it to review.</p>
          {(Object.keys(RULE_LABELS) as (keyof TrackingRules)[]).map((k) => (
            <RuleEditor key={`${c.id}-${k}`} label={RULE_LABELS[k]} values={c.rules[k]} onChange={(v) => setRules(k, v)} />
          ))}

          <h3>Organic mentions ({organic.length})</h3>
          {organic.length ? organic.map(({ video: v }) => (
            <div key={v.id} className="d-organic">
              <a className="d-postlink" href={v.url} target="_blank" rel="noreferrer">{v.title}</a>
              <div className="d-sub">{name(v.creatorId)} · not contracted · {fmt(v.views)} views — earned media, a candidate for your next campaign</div>
            </div>
          )) : <p className="d-sub">None detected yet.</p>}
        </aside>
      </div>
    </div>
  );
}

function RuleEditor({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => { const t = draft.trim(); if (t && !values.includes(t)) onChange([...values, t]); setDraft(""); };
  return (
    <div className="d-rule">
      <span className="d-lbl">{label}</span>
      <div className="d-tags">
        {values.map((v) => (
          <button key={v} type="button" className="d-tagchip" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}>{v} <span aria-hidden="true">×</span></button>
        ))}
      </div>
      <form className="d-addtag" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add…" aria-label={`Add ${label.toLowerCase()}`} maxLength={60} />
        <button type="submit" className="d-btn">Add</button>
      </form>
    </div>
  );
}
