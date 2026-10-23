"use client";

import { useMemo, useState } from "react";
import { fmt } from "@/lib/scout/engine";
import { shareOfVoice } from "@/lib/scout/campaigns";
import { DEMO_CREATOR_NAMES, DEMO_VIDEOS, SOV_BRANDS } from "@/lib/scout/campaign-demo";

const YOU = "Kestrel Audio";

/** Brand view: who owns the conversation in a category on YouTube, by views and by mentions. */
export function ShareOfVoice() {
  const [metric, setMetric] = useState<"views" | "mentions">("views");
  // YouTube is Scout's only source for now: one platform, conquered properly, before adding others.
  const rows = useMemo(() => shareOfVoice(DEMO_VIDEOS, SOV_BRANDS, "YouTube"), []);
  const total = rows.reduce((s, r) => s + r[metric], 0) || 1;
  const sorted = [...rows].sort((a, b) => b[metric] - a[metric]);
  const posts = DEMO_VIDEOS
    .filter((p) => p.platform === "YouTube")
    .map((p) => ({ p, brands: Object.entries(SOV_BRANDS).filter(([, t]) => t.some((x) => `${p.title} ${p.description}`.toLowerCase().includes(x))).map(([b]) => b) }))
    .filter((x) => x.brands.length)
    .sort((a, b) => b.p.views - a.p.views);

  return (
    <div>
      <div className="d-controls">
        <div className="d-seg" role="radiogroup" aria-label="Measure">
          <button type="button" role="radio" aria-checked={metric === "views"} onClick={() => setMetric("views")}>By views</button>
          <button type="button" role="radio" aria-checked={metric === "mentions"} onClick={() => setMetric("mentions")}>By mentions</button>
        </div>
      </div>

      <div className="d-main">
        <section className="d-tablewrap d-pad" aria-label="Share of voice">
          <h3 className="d-cardh">TWS earbuds · last 30 days · tracked creators</h3>
          <div className="d-sov">
            {sorted.map((r) => {
              const share = (r[metric] / total) * 100;
              return (
                <div key={r.brand} className={`d-sovrow ${r.brand === YOU ? "is-you" : ""}`}>
                  <span className="d-sovname">{r.brand}{r.brand === YOU && <small> you</small>}</span>
                  <span className="d-track d-track-lg"><i style={{ width: `${share}%` }} /></span>
                  <b className="d-mono">{share.toFixed(0)}%</b>
                  <span className="d-sub d-mono">{fmt(r.views)} views · {r.mentions} posts</span>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="d-panel" aria-label="Posts behind the numbers">
          <h3>Posts behind the numbers</h3>
          {posts.map(({ p, brands }) => (
            <div key={p.id} className="d-organic">
              <a className="d-postlink" href={p.url} target="_blank" rel="noreferrer">{p.title}</a>
              <div className="d-sub">{DEMO_CREATOR_NAMES[p.creatorId]} · {p.platform === "YouTube" ? "YT" : "IG"} · {fmt(p.views)} views · {brands.join(", ")}</div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
