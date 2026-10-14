"use client";

import { useState } from "react";
import type { Creator } from "@/lib/scout/data";
import { CPM_BAND, STAGES, fairRate, nextStage, type Deal, type Offer } from "@/lib/scout/campaigns";
import { DEMO_TODAY } from "@/lib/scout/campaign-demo";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const date = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const USAGE = ["Organic only · 30 days", "Organic only · 90 days", "Organic + paid ads · 30 days", "Organic + paid ads · 90 days"];

/** Creator view: every brand deal on one board, with a transparent offer thread and counter-offers. */
export function DealsView({ creator, deals, onChange }: { creator: Creator; deals: Deal[]; onChange: (d: Deal[]) => void }) {
  const [openId, setOpenId] = useState<string | null>(deals[0]?.id ?? null);
  const open = deals.find((d) => d.id === openId) ?? null;
  const update = (d: Deal) => onChange(deals.map((x) => (x.id === d.id ? d : x)));

  return (
    <div className="d-main">
      <section className="d-board" aria-label="Deal pipeline">
        {STAGES.map((s) => {
          const col = deals.filter((d) => d.stage === s);
          return (
            <div key={s} className="d-col">
              <h3 className="d-colh">{s} <span className="d-mono">{col.length}</span></h3>
              {col.map((d) => {
                const latest = d.offers.at(-1)!;
                return (
                  <button key={d.id} type="button" className={`d-card ${d.id === openId ? "is-open" : ""}`} onClick={() => setOpenId(d.id)}>
                    <b>{d.brand}</b>
                    <span>{d.title}</span>
                    <span className="d-mono">{inr(latest.fee)} · {latest.by === "creator" ? "your offer" : "their offer"}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </section>

      <aside className="d-panel" aria-label="Deal details">
        {open ? <DealDetail key={open.id} creator={creator} deal={open} onUpdate={update} onDecline={() => { onChange(deals.filter((x) => x.id !== open.id)); setOpenId(null); }} /> : <p className="d-sub d-pad0">Select a deal to see its terms and history.</p>}
      </aside>
    </div>
  );
}

function DealDetail({ creator, deal, onUpdate, onDecline }: { creator: Creator; deal: Deal; onUpdate: (d: Deal) => void; onDecline: () => void }) {
  const latest = deal.offers.at(-1)!;
  const fair = fairRate(creator.views, creator.eng);
  const negotiable = deal.stage === "Inbound" || deal.stage === "Negotiating";
  const [draft, setDraft] = useState<Offer>({ ...latest, by: "creator", fee: Math.max(latest.fee, fair.low), at: DEMO_TODAY, note: "" });
  const below = latest.fee < fair.low;

  const counter = () => onUpdate({ ...deal, stage: "Negotiating", offers: [...deal.offers, { ...draft, by: "creator", at: DEMO_TODAY }] });
  const accept = () => onUpdate({ ...deal, stage: "Contracted" });

  return (
    <div className="d-deal">
      <h3>{deal.brand}</h3>
      <p className="d-dealtitle">{deal.title}</p>
      <p className="d-sub">Stage: <b>{deal.stage}</b>{deal.campaignId && " · part of a tracked campaign — your posts are filed for the brand automatically"}</p>

      <h3>Requirements</h3>
      <ul className="d-req">{deal.requirements.map((r) => <li key={r}>{r}</li>)}</ul>

      <h3>Fair range for you</h3>
      <div className="d-fair">
        <b className="d-mono">{inr(fair.low)} – {inr(fair.high)}</b>
        <span className="d-sub">per dedicated video: avg views {Math.round(creator.views / 1000)}K × ₹{CPM_BAND.low}–{CPM_BAND.high} per 1,000 views × engagement factor {fair.engFactor.toFixed(2)} (your {creator.eng}% vs 5% baseline). The same formula is shown to the brand.</span>
        {negotiable && below && <span className="d-pill is-late">Current offer {inr(latest.fee)} is below your range</span>}
      </div>

      <h3>Negotiation · both sides see this thread</h3>
      <ol className="d-thread">
        {deal.offers.map((o, i) => (
          <li key={i} className={o.by === "creator" ? "is-me" : ""}>
            <span className="d-lbl">{o.by === "creator" ? "You" : deal.brand} · {date(o.at)}</span>
            <b className="d-mono">{inr(o.fee)}</b>
            <span>{o.deliverables} · {o.usage} · {o.timeline}</span>
            {o.note && <em>“{o.note}”</em>}
          </li>
        ))}
      </ol>

      {negotiable ? (
        <form className="d-offer" onSubmit={(e) => { e.preventDefault(); counter(); }}>
          <h3>Make a counter-offer</h3>
          <label>Fee (₹)<input type="number" min={0} step={1000} required value={draft.fee} onChange={(e) => setDraft({ ...draft, fee: Number(e.target.value) })} /></label>
          <label>Deliverables<input value={draft.deliverables} onChange={(e) => setDraft({ ...draft, deliverables: e.target.value })} required maxLength={120} /></label>
          <label>Usage rights
            <select value={draft.usage} onChange={(e) => setDraft({ ...draft, usage: e.target.value })}>
              {[...new Set([latest.usage, ...USAGE])].map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
          <label>Timeline<input value={draft.timeline} onChange={(e) => setDraft({ ...draft, timeline: e.target.value })} required maxLength={60} /></label>
          <label>Note to brand<input value={draft.note ?? ""} onChange={(e) => setDraft({ ...draft, note: e.target.value })} maxLength={200} placeholder="Why this price — e.g. recent average views" /></label>
          <div className="d-actions">
            <button type="submit" className="d-btn">Send counter-offer</button>
            {latest.by === "brand" && <button type="button" className="d-btn ghost" onClick={accept}>Accept {inr(latest.fee)}</button>}
            <button type="button" className="d-btn ghost" onClick={onDecline}>Decline</button>
          </div>
        </form>
      ) : deal.stage !== "Paid" ? (
        <button type="button" className="d-btn" onClick={() => onUpdate({ ...deal, stage: nextStage(deal.stage) })}>Mark as {nextStage(deal.stage)}</button>
      ) : (
        <p className="d-hint">Paid · closed.</p>
      )}
    </div>
  );
}
