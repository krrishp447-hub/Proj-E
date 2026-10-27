"use client";

import { useState } from "react";
import { ANNUAL_DISCOUNT, BRAND_PLANS, CREATOR_PLANS, manualCost, priceFor, type Plan } from "@/lib/scout/pricing";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function PlanCard({ p, annual }: { p: Plan; annual: boolean }) {
  return (
    <article className={`pr-card ${p.featured ? "is-featured" : ""}`} aria-labelledby={`${p.id}-h`}>
      {p.featured && <span className="pr-flag">Most teams</span>}
      <h3 id={`${p.id}-h`}>{p.name}</h3>
      <p className="pr-price">
        {p.monthly === null ? <>Custom</> : p.monthly === 0 ? <>Free</> : <><span key={priceFor(p.monthly, annual)} className="roll">{inr(priceFor(p.monthly, annual))}</span><small>/month</small></>}
      </p>
      <p className="pr-billing">{p.monthly ? (annual ? "billed yearly, GST extra" : "billed monthly, GST extra") : p.monthly === 0 ? "forever" : "billed yearly"}</p>
      <p className="pr-blurb">{p.blurb}</p>
      <a className={`acct-btn ${p.featured ? "on-ink" : ""}`} href={p.cta.href}>{p.cta.label}</a>
      <ul className="pr-feats">
        {p.features.map((f) => <li key={f.text}>{f.text}{f.soon && <span className="pr-soon">Soon</span>}</li>)}
      </ul>
    </article>
  );
}

export function PricingPlans() {
  const [annual, setAnnual] = useState(true);
  const [side, setSide] = useState<"brand" | "creator">("brand");
  return (
    <>
      <div className="pr-controls">
        <div className="deals-seg" role="group" aria-label="Plans for">
          <button type="button" aria-pressed={side === "brand"} onClick={() => setSide("brand")}>Brands &amp; agencies</button>
          <button type="button" aria-pressed={side === "creator"} onClick={() => setSide("creator")}>Creators</button>
        </div>
        <div className="deals-seg" role="group" aria-label="Billing">
          <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</button>
          <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>Yearly · save {ANNUAL_DISCOUNT * 100}%</button>
        </div>
      </div>
      <div className={`pr-grid ${side === "creator" ? "is-two" : ""}`}>
        {(side === "brand" ? BRAND_PLANS : CREATOR_PLANS).map((p) => <PlanCard key={p.id} p={p} annual={annual} />)}
      </div>
    </>
  );
}

/** Anchor on time saved per shortlist, not "database access" (DECISIONS.md §4). All inputs adjustable. */
export function SavingsCalculator() {
  const [lists, setLists] = useState(4);
  const [hours, setHours] = useState(12);
  const [rate, setRate] = useState(800);
  const { hoursSaved, rupees } = manualCost(lists, hours, rate);
  const starter = priceFor(BRAND_PLANS[0].monthly ?? 0, true);
  const field = (label: string, value: number, set: (n: number) => void, min: number, max: number, step: number, show: string) => (
    <label className="pr-range">
      <span>{label} <b>{show}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} />
    </label>
  );
  return (
    <div className="pr-calc">
      <div className="pr-calc-in">
        {field("Shortlists a month", lists, setLists, 1, 30, 1, String(lists))}
        {field("Hours per shortlist by hand", hours, setHours, 2, 40, 1, `${hours} h`)}
        {field("Team cost per hour", rate, setRate, 300, 3000, 100, inr(rate))}
        <p className="acct-help">By hand: searching, opening every channel, checking engagement and fake followers, comparing. With ScoutBlack, about 30 minutes.</p>
      </div>
      <div className="pr-calc-out" aria-live="polite">
        <p>Time saved</p>
        <b>{hoursSaved.toLocaleString("en-IN")} hours</b>
        <p>a month, worth</p>
        <b>{inr(rupees)}</b>
        <p className="acct-help">{rupees > starter ? `More than Starter costs (${inr(starter)}/month, yearly).` : `Starter is ${inr(starter)}/month, yearly; at this volume, start with the free trial.`}</p>
      </div>
    </div>
  );
}
