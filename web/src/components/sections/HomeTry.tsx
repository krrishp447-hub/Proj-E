"use client";

import Link from "next/link";
import { useState } from "react";
import { youtubeUrl } from "@/lib/scout/contact";
import { fmt, type Match } from "@/lib/scout/engine";
import { HOME_RESULTS } from "@/lib/scout/search";
import "./hometry.css";

const EXAMPLES = ["Hindi tech reviewers under 1M subs", "Tamil food bloggers", "BGMI streamers in Hindi", "Fitness creators with strong engagement", "Finance youtubers with 100k+ avg views"];

export type HomeResult = { query: string; understood: string[]; fitCount: number; total: number; fits: Match[] };

/**
 * The homepage taste of ScoutBlack: one brief, the best few matches with why they ranked, then the way in
 * (pricing, or the full app with the same brief). The full product lives at /demo, not on the homepage.
 */
export function HomeTry({ initial }: { initial: HomeResult }) {
  const [draft, setDraft] = useState(initial.query);
  const [r, setR] = useState(initial);
  const [busy, setBusy] = useState(false);

  const run = async (q: string) => {
    if (!q.trim()) return;
    setDraft(q);
    setBusy(true);
    try {
      const res = await fetch(`/api/search?limit=${HOME_RESULTS}&q=${encodeURIComponent(q)}`);
      if (res.ok) setR(await res.json());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ht">
      <form className="ht-form" role="search" onSubmit={(e) => { e.preventDefault(); run(draft); }}>
        <label className="sr-only" htmlFor="ht-brief">Describe the creators you want</label>
        <input id="ht-brief" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={300} placeholder="Describe the creators you want, in plain English" />
        <button type="submit" disabled={busy}>{busy ? "Searching…" : "Find creators"}</button>
      </form>
      <div className="ht-examples" aria-label="Example briefs">
        {EXAMPLES.map((q) => <button key={q} type="button" onClick={() => run(q)}>{q}</button>)}
      </div>
      {r.understood.length > 0 && (
        <p className="ht-under"><span>Understood</span>{r.understood.map((u) => <i key={u}>{u}</i>)}</p>
      )}

      <ol className="ht-list" aria-busy={busy} aria-live="polite">
        {r.fits.slice(0, HOME_RESULTS).map((m, i) => {
          const c = m.creator;
          const why = m.signals.filter((s) => s.points > 0).sort((a, b) => b.points - a.points).slice(0, 2).map((s) => s.label);
          return (
            <li key={c.channelId}>
              <span className="ht-rank">{String(i + 1).padStart(2, "0")}</span>
              <span className="ht-who">
                <a href={youtubeUrl(c.channelId)} target="_blank" rel="noopener noreferrer">{c.name} <span aria-hidden="true">↗</span></a>
                <em>{c.niche} · {c.language} · {fmt(c.subs)} subs · {c.eng}% engagement</em>
                {why.length > 0 && <small>{why.join(" · ")}</small>}
              </span>
              <span className="ht-score" aria-label={`Match ${m.score} of 100`}><span><i style={{ width: `${m.score}%` }} /></span><b>{m.score}</b></span>
            </li>
          );
        })}
        {!r.fits.length && <li className="ht-none">No creator fits every part of that brief yet. Try a broader one.</li>}
      </ol>

      <div className="ht-gate">
        <p>
          {r.fitCount > HOME_RESULTS
            ? <>Showing {Math.min(HOME_RESULTS, r.fits.length)} of <b>{r.fitCount.toLocaleString("en-IN")}</b> creators that fit, out of {r.total.toLocaleString("en-IN")} tracked.</>
            : <>Every creator that fits, out of {r.total.toLocaleString("en-IN")} tracked.</>}
          {" "}The full app (every result, compare, audience overlap, offers) comes with every brand plan.
        </p>
        <div className="ht-ctas">
          <Link className="pbtn" href="/pricing">See pricing <span aria-hidden="true">→</span></Link>
          <Link className="pbtn ghost" href="/api/auth/google/start?role=brand">Start 4-day free trial</Link>
        </div>
      </div>
    </div>
  );
}
