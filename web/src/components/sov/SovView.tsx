"use client";

import { useState } from "react";
import { youtubeUrl } from "@/lib/scout/contact";
import { fmt } from "@/lib/scout/engine";
import { opportunities, type SovResult } from "@/lib/scout/sov";
import "./sov.css";

const TREND_WEEKS = 8;

function Trend({ weekly }: { weekly: number[] }) {
  const w = weekly.slice(-TREND_WEEKS), top = Math.max(...w, 1);
  return (
    <span className="sov-trend" aria-label={`Views per week, last ${w.length} weeks: ${w.map(fmt).join(", ")}`}>
      {w.map((v, i) => <i key={i} style={{ height: `${Math.max(4, (v / top) * 100)}%` }} />)}
    </span>
  );
}

/**
 * Share of voice from real uploads: each brand's share of brand-naming views, paid vs earned, the weekly trend, and
 * the outreach list (creators who named a competitor but never you). `you` fixed (dashboard) or picked (demo).
 */
export function SovView({ result, you: fixedYou, offers = false }: { result: SovResult; you?: string; offers?: boolean }) {
  const [picked, setPicked] = useState(result.brands[result.brands.length - 1]?.name ?? "");
  const you = fixedYou ?? picked;
  const opps = you ? opportunities(result, you, 10) : [];
  const total = result.brands.reduce((s, b) => s + b.views, 0);
  if (!total) return <p className="sov-note">No uploads from tracked creators named these brands in the last {result.days} days.</p>;

  return (
    <div className="sov">
      {!fixedYou && (
        <label className="sov-pick">See it as
          <select value={picked} onChange={(e) => setPicked(e.target.value)}>
            {result.brands.map((b) => <option key={b.name}>{b.name}</option>)}
          </select>
        </label>
      )}
      <div className="sov-rows" role="table" aria-label="Share of voice by brand">
        <div className="sov-row sov-headrow" role="row">
          <span role="columnheader">Brand</span><span role="columnheader">Share of views</span><span role="columnheader">Paid</span><span role="columnheader">Last {TREND_WEEKS} weeks</span>
        </div>
        {result.brands.map((b) => (
          <div key={b.name} className={`sov-row ${b.name === you ? "is-you" : ""}`} role="row">
            <span role="cell"><b>{b.name}</b>{b.name === you && <small> you</small>}<em>{b.videos} videos · {b.creators} creators · {fmt(b.views)} views</em></span>
            <span role="cell" className="sov-share"><span className="sov-bar"><i style={{ width: `${b.share}%` }} /></span><b>{b.share}%</b></span>
            <span role="cell" className="sov-num">{b.views ? Math.round((b.paidViews / b.views) * 100) : 0}%</span>
            <span role="cell"><Trend weekly={b.weekly} /></span>
          </div>
        ))}
      </div>
      <p className="sov-note">
        Last {result.days} days · uploads by Scout&apos;s tracked creators that name each brand (a video naming two counts for both).
        Paid = carries an ad disclosure; the rest is earned. Weekly bars undercount older weeks for daily uploaders (Scout keeps each
        channel&apos;s latest ~20 uploads).
      </p>

      {you && (
        <section className="sov-sec">
          <h3>Talking about competitors, not {you}</h3>
          {opps.length ? (
            <ul className="sov-list">
              {opps.map((c) => (
                <li key={c.channelId}>
                  <span><b>{c.creator}</b><em>{c.competitors.join(", ")} · {fmt(c.competitorViews)} views</em></span>
                  <span className="sov-links">
                    <a href={youtubeUrl(c.channelId)} target="_blank" rel="noopener noreferrer">YouTube ↗</a>
                    {offers && <a href={`/dashboard/offers/new?to=${encodeURIComponent(c.channelId)}`}>Send offer →</a>}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="sov-note">Every creator naming a competitor has named {you} too.</p>}
        </section>
      )}

      <section className="sov-sec">
        <h3>Biggest videos behind the numbers</h3>
        <ul className="sov-list">
          {result.posts.slice(0, 8).map((p) => (
            <li key={p.videoId}>
              <span><a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a><em>{p.creator} · {p.brands.join(", ")} · {p.disclosed ? "Ad" : "Organic"}</em></span>
              <span className="sov-num">{fmt(p.views)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
