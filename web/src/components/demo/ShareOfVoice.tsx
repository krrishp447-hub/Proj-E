"use client";

import { useEffect, useState } from "react";
import { SovView } from "@/components/sov/SovView";
import type { SovResult } from "@/lib/scout/sov";

type Data = { title: string; category: string; result: SovResult | null };

/** Brand view: who owns the conversation in a category on YouTube, from real uploads (a fixed example set in the demo). */
export function ShareOfVoice() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/sov").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData, () => setFailed(true));
  }, []);

  return (
    <section className="d-tablewrap d-pad" aria-label="Share of voice" aria-busy={!data && !failed}>
      <h3 className="d-cardh">{data ? `${data.title} · ${data.category} creators · last 90 days` : "Share of voice"}</h3>
      {failed ? <p className="d-muted">Couldn&apos;t load share of voice. Try again in a moment.</p>
        : !data ? <p className="d-muted">Scanning tracked creators&apos; uploads for brand mentions…</p>
        : !data.result ? <p className="d-muted">Live share of voice needs the creator database.</p>
        : <SovView result={data.result} />}
      <p className="d-sub">A live example on real uploads. Brand accounts track their own brand and competitors from the dashboard, with the outreach list linked to offers.</p>
    </section>
  );
}
