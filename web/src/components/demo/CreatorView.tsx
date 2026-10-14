"use client";

import { useMemo, useState } from "react";
import { authTone, type Creator } from "@/lib/scout/data";
import { contextualize, fmt, parseBrief, score } from "@/lib/scout/engine";
import type { Deal } from "@/lib/scout/campaigns";
import { DEMO_DEALS, DEMO_TODAY } from "@/lib/scout/campaign-demo";
import { DealsView } from "./DealsView";
import { DeliverablesView } from "./DeliverablesView";
import { Bar } from "./DetailPanel";

// Illustrative inbound requests per niche (generic advertisers — no real brands).
type Request = { from: string; ask: string; brief: string; budget: number };
const REQUESTS: Record<string, Request[]> = {
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

/** A creator's deals: the demo campaign deals, or inbound requests from their niche as Inbound/Negotiating deals. */
function initialDeals(c: Creator): Deal[] {
  const demo = c.source === "demo" ? DEMO_DEALS.filter((d) => d.creatorId === c.id) : [];
  if (demo.length) return demo;
  return (REQUESTS[c.niche] ?? []).map((r, i) => ({
    id: `req-${c.id}-${i}`, creatorId: c.id, brand: r.from, title: r.ask, stage: i === 1 ? "Negotiating" : "Inbound",
    requirements: [r.ask, `Brief: “${r.brief}”`],
    offers: [{ by: "brand", fee: r.budget, deliverables: r.ask, usage: "Organic only · 30 days", timeline: "Within 3 weeks", at: DEMO_TODAY }],
  }));
}

/** Rank of `me` among all creators that fit a brief (using a possibly edited profile). */
function rankFor(creators: Creator[], me: Creator, brief: string) {
  const b = contextualize(parseBrief(brief), creators);
  const pool = creators.map((c) => score(c.id === me.id ? me : c, b)).filter((m) => m.fits).sort((a, z) => z.score - a.score);
  const i = pool.findIndex((m) => m.creator.id === me.id);
  return { rank: i < 0 ? null : i + 1, of: pool.length, score: score(me, b).score };
}

export function CreatorView({ creators }: { creators: Creator[] }) {
  const [id, setId] = useState(0);
  const base = creators[id];
  const [tagsById, setTagsById] = useState<Record<number, string[]>>({});
  const [dealsById, setDealsById] = useState<Record<number, Deal[]>>({});
  const [tab, setTab] = useState<"overview" | "deals" | "deliverables">("overview");
  const [newTag, setNewTag] = useState("");

  const tags = tagsById[id] ?? base.tags;
  const me = useMemo(() => ({ ...base, tags }), [base, tags]);
  const requests = (REQUESTS[base.niche] ?? []).map((r, i) => ({ ...r, id: `${id}-${i}` }));
  const deals = dealsById[id] ?? initialDeals(base);
  const setDeals = (d: Deal[]) => setDealsById((x) => ({ ...x, [id]: d }));
  const quality = score(me, parseBrief("")).score; // fit-free quality: engagement, growth, authenticity, track record
  const open = deals.filter((d) => d.stage === "Inbound" || d.stage === "Negotiating").length;
  const contracted = deals.filter((d) => !["Inbound", "Negotiating"].includes(d.stage)).reduce((s, d) => s + d.offers.at(-1)!.fee, 0);

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
    { label: "Open deals", value: open, note: contracted ? `${inr(contracted)} contracted` : undefined },
  ];

  return (
    <>
      <div className="d-controls">
        <label className="d-viewas">
          <span className="d-lbl">Viewing as</span>
          <select value={id} onChange={(e) => setId(Number(e.target.value))}>
            {creators.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.niche}</option>)}
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

      <div className="d-tabs d-tabs-top" role="tablist" aria-label="Creator sections">
        <button role="tab" aria-selected={tab === "overview"} onClick={() => setTab("overview")}>Overview</button>
        <button role="tab" aria-selected={tab === "deals"} onClick={() => setTab("deals")}>Deals ({deals.length})</button>
        <button role="tab" aria-selected={tab === "deliverables"} onClick={() => setTab("deliverables")}>Deliverables</button>
      </div>

      {tab === "deals" && <DealsView key={id} creator={me} deals={deals} onChange={setDeals} />}
      {tab === "deliverables" && <DeliverablesView creatorId={id} deals={deals} />}
      {tab === "overview" && (
      <div className="d-main">
        <div className="d-stack">
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
                  const fit = rankFor(creators, me, r.brief);
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
      )}
    </>
  );
}
