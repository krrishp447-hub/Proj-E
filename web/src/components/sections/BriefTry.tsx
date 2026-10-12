"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Creator } from "@/lib/scout/data";
import { describe, parseBrief, score } from "@/lib/scout/engine";

/** Live version of pillar 01: type a brief, see what Scout understood and how many creators fit. */
export function BriefTry({ creators }: { creators: Creator[] }) {
  const [text, setText] = useState("Fast-growing Instagram fitness creators in India");
  const { tokens, fits, top } = useMemo(() => {
    const b = parseBrief(text);
    const ranked = creators.map((c) => score(c, b)).filter((m) => m.fits).sort((a, z) => z.score - a.score);
    return { tokens: describe(b), fits: ranked.length, top: ranked[0] };
  }, [text, creators]);

  return (
    <div className="brief rev">
      <label htmlFor="brief-try" className="mono brief-label">Try it — describe a campaign</label>
      <div className="brief-row">
        <input id="brief-try" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} autoComplete="off" />
        <Link className="pbtn" href={`/demo?q=${encodeURIComponent(text)}`}>Rank them →</Link>
      </div>
      <div className="brief-out" aria-live="polite">
        <span className="mono brief-k">Understood</span>
        {tokens.length ? tokens.map((t) => <span key={t} className="brief-token">{t}</span>) : <span className="brief-none">nothing yet — try a niche, platform or size</span>}
        <span className="mono brief-count">
          {fits} fit{fits === 1 ? "" : "s"}{top ? ` · top match ${top.score}` : ""}
        </span>
      </div>
    </div>
  );
}
