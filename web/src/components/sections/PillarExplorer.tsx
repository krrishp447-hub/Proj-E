"use client";

import { useRef, useState } from "react";
import { authTone, suspiciousTone, type Creator } from "@/lib/scout/data";
import { overlap, contextualize, parseBrief, score } from "@/lib/scout/engine";
import { BriefTry } from "./BriefTry";

const PILLARS = [
  { title: "Search in plain English", desc: "DESCRIBE THE CAMPAIGN · NICHE · SUB-NICHE · AUDIENCE · SIZE · NO FILTER MAZES", more: "HOW IT PARSES" },
  { title: "Ranked on eight signals", desc: "SUB-NICHE FIT · ENGAGEMENT · GROWTH · REACH · AUTHENTICITY · PROVEN RESULTS · NOT FOLLOWER COUNT", more: "THE SCORE MODEL" },
  { title: "Verified, not inflated", desc: "AUTHENTICITY SCORES · SUSPICIOUS-FOLLOWER FLAGS · FRESHNESS STAMPS · AUDIENCE OVERLAP", more: "TRUST LAYER" },
];

const BRIEFS = [
  "Indian YouTube tech creators who review earbuds, 50K–500K subs",
  "Fast-growing Instagram fitness creators in India",
  "YouTube finance creators in India, high engagement",
];

/** Pillar columns whose arrows open a live, engine-backed explainer underneath. */
export function PillarExplorer({ creators }: { creators: Creator[] }) {
  const [tab, setTab] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const open = (i: number) => {
    setTab(i);
    panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <>
      <div className="pcols">
        <div className="divV dash-v left-1/3" />
        <div className="divV dash-v left-2/3" />
        {PILLARS.map((p, i) => (
          <div key={p.title} className="pcol rev" style={{ "--d": `${i * 0.12}s` } as React.CSSProperties}>
            <div className="pnum" aria-hidden="true">0{i + 1}</div>
            <h2 className="ptitle">{p.title}</h2>
            <p className="desc">{p.desc}</p>
            <div className="mt-[22px]">
              <button type="button" className={`arrow pbtn-arrow ${tab === i ? "is-on" : ""}`} aria-controls="pillar-panel" aria-expanded={tab === i} onClick={() => open(i)}>
                {p.more} {tab === i ? "↓" : "→"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div ref={panel} id="pillar-panel" className="xpl rev" role="region" aria-label={PILLARS[tab].more}>
        <div className="xpl-tabs" role="tablist">
          {PILLARS.map((p, i) => (
            <button key={p.more} type="button" role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>
              0{i + 1} · {p.more}
            </button>
          ))}
        </div>
        {tab === 0 && <BriefTry creators={creators} />}
        {tab === 1 && <ScoreModel creators={creators} />}
        {tab === 2 && <TrustLayer creators={creators} />}
      </div>
    </>
  );
}

function ScoreModel({ creators }: { creators: Creator[] }) {
  const [brief, setBrief] = useState(BRIEFS[0]);
  const [id, setId] = useState(0);
  const b = contextualize(parseBrief(brief), creators);
  const m = score(creators[id], b);
  const top = Math.max(...m.signals.map((s) => Math.abs(s.points)), 1);
  // the creators worth comparing for this brief: best fits first
  const pool = creators.map((c) => score(c, b)).sort((a, z) => z.score - a.score).slice(0, 6).map((x) => x.creator);
  const pick = (q: string) => {
    setBrief(q);
    setId(creators.map((c) => score(c, contextualize(parseBrief(q), creators))).sort((a, z) => z.score - a.score)[0].creator.id);
  };

  return (
    <div className="xpl-body">
      <div className="xpl-controls">
        <span className="mono xpl-k">Brief</span>
        <div className="xpl-chips">
          {BRIEFS.map((q) => <button key={q} type="button" aria-pressed={q === brief} onClick={() => pick(q)}>{q}</button>)}
        </div>
        <span className="mono xpl-k">Creator</span>
        <div className="xpl-chips">
          {pool.map((c) => <button key={c.id} type="button" aria-pressed={c.id === id} onClick={() => setId(c.id)}>{c.name}</button>)}
        </div>
      </div>
      <div className="xpl-result">
        <div className="xpl-bars">
          {m.signals.map((s) => (
            <div key={s.label} className="xbar">
              <span>{s.label}</span>
              <span className="xbar-track"><i className={s.points < 0 ? "neg" : ""} style={{ width: `${(Math.abs(s.points) / top) * 100}%` }} /></span>
              <b>{s.points > 0 ? "+" : ""}{s.points}</b>
            </div>
          ))}
        </div>
        <div className="xpl-total">
          <span className="mono">Match</span>
          <b className={m.fits ? "" : "is-miss"}>{m.score}</b>
          <span className="mono">{m.fits ? "fits the brief" : "near miss — fails a hard filter"}</span>
        </div>
      </div>
    </div>
  );
}

function TrustLayer({ creators }: { creators: Creator[] }) {
  const [a, setA] = useState(0); // Tech With Arjun
  const [b, setB] = useState(Math.min(6, creators.length - 1)); // demo: EarbudExpert — a high-overlap pair worth showing first
  const A = creators[a], B = creators[b];
  const o = a === b ? 100 : overlap(A, B);
  const select = (v: number, set: (n: number) => void, label: string) => (
    <label className="xpl-select">
      <span className="mono xpl-k">{label}</span>
      <select value={v} onChange={(e) => set(Number(e.target.value))}>
        {creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );

  return (
    <div className="xpl-body">
      <div className="xpl-pair">
        {select(a, setA, "Creator A")}
        {select(b, setB, "Creator B")}
      </div>
      <table className="xpl-table">
        <thead><tr><th scope="col"><span className="sr-only">Check</span></th><th scope="col">{A.name}</th><th scope="col">{B.name}</th></tr></thead>
        <tbody>
          <tr><th scope="row">Authenticity</th><td className={authTone(A.auth)}>{A.auth}</td><td className={authTone(B.auth)}>{B.auth}</td></tr>
          <tr><th scope="row">Suspicious followers</th><td className={suspiciousTone(A.suspicious)}>{A.suspicious}%</td><td className={suspiciousTone(B.suspicious)}>{B.suspicious}%</td></tr>
          <tr><th scope="row">Data verified</th><td>{A.verifiedDays}d ago</td><td>{B.verifiedDays}d ago</td></tr>
          <tr><th scope="row">Proven record</th><td>{A.proven ? "◆ Yes" : "Building"}</td><td>{B.proven ? "◆ Yes" : "Building"}</td></tr>
        </tbody>
      </table>
      <div className="xpl-overlap">
        <span className="mono xpl-k">Audience overlap</span>
        <span className="xbar-track big"><i className={o >= 55 ? "neg" : ""} style={{ width: `${o}%` }} /></span>
        <b>{o}%</b>
      </div>
      <p className={`xpl-verdict ${o >= 55 ? "is-bad" : "is-good"}`}>
        {a === b
          ? "Same creator — pick two different ones."
          : o >= 55
            ? `Book one, not both: ${A.name} and ${B.name} reach largely the same viewers.`
            : `Good pair: ${A.name} and ${B.name} reach mostly different audiences.`}
      </p>
    </div>
  );
}
