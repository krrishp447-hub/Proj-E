"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Creator } from "@/lib/scout/data";
import { contextualize, fmt, parseBrief, score } from "@/lib/scout/engine";

const BRIEF = "Indian YouTube tech creators who review earbuds, 50K–500K subs, strong engagement";

type Step = { label: string; keep: (c: Creator) => boolean };

/** Median engagement of creators with known engagement — the "strong engagement" bar adapts to the data. */
const medianEng = (cs: Creator[]) => {
  const xs = cs.map((c) => c.eng).filter((e) => e > 0).sort((a, b) => a - b);
  return xs.length ? Math.round(xs[Math.floor(xs.length / 2)] * 10) / 10 : 0;
};

// Each step is one filter ScoutBlack applies; toggling them shows how the field narrows.
function steps(creators: Creator[]): Step[] {
  const eng = medianEng(creators.filter((c) => c.niche === "Tech"));
  return [
    { label: "Tech niche", keep: (c) => c.niche === "Tech" },
    { label: "YouTube", keep: (c) => c.platform === "YouTube" },
    { label: "India audience", keep: (c) => c.country === "India" },
    { label: "50K–500K subs", keep: (c) => c.subs >= 50_000 && c.subs <= 500_000 },
    { label: `Engagement ≥ ${eng}% (median)`, keep: (c) => c.eng >= eng },
    { label: "Authenticity ≥ 75", keep: (c) => c.auth >= 75 },
  ];
}

/** Live "from many to the right few": toggle ScoutBlack's filters and watch the shortlist narrow. */
export function ResultsFunnel({ creators }: { creators: Creator[] }) {
  const STEPS = useMemo(() => steps(creators), [creators]);
  const [on, setOn] = useState(() => STEPS.map(() => true));
  const brief = useMemo(() => contextualize(parseBrief(BRIEF), creators), [creators]);

  const { counts, rows } = useMemo(() => {
    // cumulative: each step filters what the previous steps left
    let pool = creators;
    const counts: number[] = [];
    for (let i = 0; i < STEPS.length; i++) {
      if (on[i]) pool = pool.filter(STEPS[i].keep);
      counts.push(pool.length);
    }
    const rows = pool.map((c) => score(c, brief)).sort((a, z) => z.score - a.score);
    return { counts, rows };
  }, [on, brief, creators, STEPS]);

  return (
    <>
      <div className="funnel" role="group" aria-label="ScoutBlack's filters">
        <span className="funnel-start mono">{creators.length} creators</span>
        {STEPS.map((s, i) => (
          <button key={s.label} type="button" className="funnel-step" aria-pressed={on[i]} onClick={() => setOn((o) => o.map((v, k) => (k === i ? !v : v)))}>
            <span>{s.label}</span>
            <b className="mono">{counts[i]}</b>
          </button>
        ))}
      </div>
      <p className="funnel-note mono" aria-live="polite">
        {rows.length} left · ranked by match for “{BRIEF}” · toggle any filter
      </p>

      <div className="lgrid">
        {rows.slice(0, 9).map(({ creator: c, score: s }) => (
          <Link key={c.id} href={`/demo?q=${encodeURIComponent(BRIEF)}`} className="lcell lcell-live">
            <div className="lab">{c.platform === "YouTube" ? "YT" : "IG"} · {c.country} · {c.niche}</div>
            <h3 className="lname">{c.name}</h3>
            <div className="met">
              <b>{s}</b> MATCH · {fmt(c.subs)} SUBS · ENG {c.eng}%
            </div>
            <span className="lmeter" aria-hidden="true"><i style={{ width: `${s}%` }} /></span>
          </Link>
        ))}
        {!rows.length && <p className="funnel-empty">Every creator filtered out — switch a filter back on.</p>}
      </div>
    </>
  );
}
