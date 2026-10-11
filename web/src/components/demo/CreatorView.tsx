"use client";

import { useMemo, useState } from "react";
import { CREATORS, authTone, type Creator } from "@/lib/scout/data";
import { fmt, parseBrief, score } from "@/lib/scout/engine";
import { Bar } from "./DetailPanel";

// Illustrative inbound requests per niche (generic advertisers — no real brands).
type Status = "New" | "Negotiating" | "Accepted" | "Declined";
type Request = { id: string; from: string; ask: string; brief: string; budget: number; status: Status };
const REQUESTS: Record<string, Omit<Request, "id" | "status">[]> = {
  Tech: [
    { from: "Audio D2C brand", ask: "TWS launch · dedicated review", brief: "Indian YouTube tech creators who review earbuds, 50K–500K", budget: 85000 },
    { from: "Smartphone maker", ask: "Unboxing · 2 shorts", brief: "Indian tech creators smartphone reviews", budget: 60000 },
    { from: "Headphone startup", ask: "ANC comparison video", brief: "YouTube audio reviewers ANC headphones India", budget: 45000 },
  ],
  Fitness: [
    { from: "Nutrition brand", ask: "30-day series · 4 reels", brief: "Instagram fitness creators in India, nutrition", budget: 70000 },
    { from: "Smartwatch brand", ask: "Workout integration", brief: "fitness creators India workout, high engagement", budget: 50000 },
  ],
  Finance: [{ from: "Investing app", ask: "Explainer · 1 video", brief: "YouTube finance creators in India investing", budget: 90000 }],
  Gaming: [{ from: "Peripherals brand", ask: "Setup tour feature", brief: "YouTube gaming creators India setup", budget: 65000 }],
  Fashion: [{ from: "Apparel label", ask: "Haul · 3 reels", brief: "Instagram fashion creators India", budget: 55000 }],
  Food: [{ from: "Cookware brand", ask: "Recipe integration", brief: "YouTube cooking creators India recipes", budget: 75000 }],
  Travel: [{ from: "Luggage brand", ask: "Trip vlog feature", brief: "Instagram travel creators India", budget: 60000 }],
};
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Rank of `me` among all creators that fit a brief (using a possibly edited profile). */
function rankFor(me: Creator, brief: string) {
  const b = parseBrief(brief);
  const pool = CREATORS.map((c) => score(c.id === me.id ? me : c, b)).filter((m) => m.fits).sort((a, z) => z.score - a.score);
  const i = pool.findIndex((m) => m.creator.id === me.id);
  return { rank: i < 0 ? null : i + 1, of: pool.length, score: score(me, b).score };
}

export function CreatorView() {
  const [id, setId] = useState(0);
  const base = CREATORS[id];
  const [tagsById, setTagsById] = useState<Record<number, string[]>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [newTag, setNewTag] = useState("");

  const tags = tagsById[id] ?? base.tags;
  const me = useMemo(() => ({ ...base, tags }), [base, tags]);
  const requests: Request[] = (REQUESTS[base.niche] ?? []).map((r, i) => {
    const rid = `${id}-${i}`;
    return { ...r, id: rid, status: status[rid] ?? (i === 0 ? "New" : i === 1 ? "Negotiating" : "New") };
  });
  const quality = score(me, parseBrief("")).score; // fit-free quality: engagement, growth, authenticity, track record
  const open = requests.filter((r) => r.status === "New" || r.status === "Negotiating").length;
  const accepted = requests.filter((r) => r.status === "Accepted").reduce((s, r) => s + r.budget, 0);

  const setTags = (next: string[]) => setTagsById((t) => ({ ...t, [id]: next }));
  const addTag = () => {
    const t = newTag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setNewTag("");
  };

  const kpis = [
    { label: "Scout quality", value: quality, note: "/100" },
    { label: "Subscribers", value: fmt(base.subs) },
    { label: "Engagement", value: `${base.eng}%` },
    { label: "Authenticity", value: base.auth, tone: authTone(base.auth) },
    { label: "Open requests", value: open, note: accepted ? `${inr(accepted)} accepted` : undefined },
  ];

  return (
    <>
      <div className="d-controls">
        <label className="d-viewas">
          <span className="d-lbl">Viewing as</span>
          <select value={id} onChange={(e) => setId(Number(e.target.value))}>
            {CREATORS.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.niche}</option>)}
          </select>
        </label>
        <span className="d-lbl">{base.handle} · {base.platform} · {base.country} · data verified {base.verifiedDays}d ago</span>
      </div>

      <dl className="d-kpis">
        {kpis.map((k) => (
          <div key={k.label}>
            <dt>{k.label}</dt>
            <dd className={k.tone}>{k.value}{k.note && <small> {k.note}</small>}</dd>
          </div>
        ))}
      </dl>

      <div className="d-main">
        <div className="d-stack">
          <section className="d-tablewrap" aria-label="Brand requests">
            <h3 className="d-cardh">Brand requests</h3>
            {requests.length ? (
              <table className="d-table">
                <thead>
                  <tr>
                    <th scope="col">From</th>
                    <th scope="col" className="d-c-opt">Brief</th>
                    <th scope="col" className="d-num">Budget</th>
                    <th scope="col" className="d-num">Your fit</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const fit = rankFor(me, r.brief);
                    const decided = r.status === "Accepted" || r.status === "Declined";
                    return (
                      <tr key={r.id} className="is-static">
                        <td><b>{r.from}</b><div className="d-sub">{r.ask}</div></td>
                        <td className="d-c-opt d-sub d-wrap">“{r.brief}”</td>
                        <td className="d-num d-mono">{inr(r.budget)}</td>
                        <td className="d-num d-c-match">
                          <span className="d-meter" aria-hidden="true"><i style={{ width: `${fit.score}%` }} /></span>
                          <b className="d-mono">{fit.score}</b>
                        </td>
                        <td>
                          {decided ? (
                            <span className={`d-pill ${r.status === "Accepted" ? "is-good" : "d-muted"}`}>{r.status}</span>
                          ) : (
                            <span className="d-actions">
                              <span className="d-pill">{r.status}</span>
                              <button type="button" className="d-mini" onClick={() => setStatus((s) => ({ ...s, [r.id]: "Accepted" }))}>Accept</button>
                              <button type="button" className="d-mini ghost" onClick={() => setStatus((s) => ({ ...s, [r.id]: "Declined" }))}>Decline</button>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="d-empty">No requests yet for this niche.</p>
            )}
          </section>

          <section className="d-tablewrap" aria-label="Where you rank">
            <h3 className="d-cardh">Where you rank</h3>
            <table className="d-table">
              <thead>
                <tr>
                  <th scope="col">Brands searching for</th>
                  <th scope="col" className="d-num">Rank</th>
                  <th scope="col" className="d-num">Match</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const fit = rankFor(me, r.brief);
                  return (
                    <tr key={r.id} className="is-static">
                      <td className="d-wrap">{r.brief}</td>
                      <td className="d-num d-mono">{fit.rank ? <><b>#{fit.rank}</b> <span className="d-muted">of {fit.of}</span></> : <span className="d-muted">not shown</span>}</td>
                      <td className="d-num d-mono">{fit.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>

        <aside className="d-panel" aria-label="Improve your match">
          <h3>Improve your match</h3>
          <p className="d-sub">Sub-niche tags are what brand briefs match against. Add or remove one and watch your fit and rank update.</p>
          <div className="d-tags">
            {tags.map((t) => (
              <button key={t} type="button" className="d-tagchip" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`}>
                {t} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
          <form className="d-addtag" onSubmit={(e) => { e.preventDefault(); addTag(); }}>
            <label htmlFor="newtag" className="sr-only">Add a sub-niche tag</label>
            <input id="newtag" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="e.g. anc, budget, smartphone" maxLength={24} />
            <button type="submit" className="d-btn">Add</button>
          </form>
          {tagsById[id] && <button type="button" className="d-link" onClick={() => setTagsById((t) => { const n = { ...t }; delete n[id]; return n; })}>Reset tags</button>}

          <h3>Audience brands see</h3>
          {base.geo.map(([g, v]) => <Bar key={g} label={g} value={v} text={`${v}%`} />)}

          <h3>Track record</h3>
          <dl className="d-grid">
            <div><dt>Campaigns</dt><dd>{base.campaigns}</dd></div>
            <div><dt>Repeat brands</dt><dd>{base.repeat}%</dd></div>
            <div><dt>Delivered</dt><dd className={base.delivery >= 1 ? "is-good" : "is-warn"}>{base.delivery}×</dd></div>
          </dl>
          <p className="d-hint">{base.proven ? "◆ Proven on-platform record — brands see this badge in search." : "Complete more campaigns on Scout to earn the ◆ Proven badge."}</p>
        </aside>
      </div>
    </>
  );
}
