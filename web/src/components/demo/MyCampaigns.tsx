"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fmt } from "@/lib/scout/engine";
import type { CampaignSummary } from "@/server/brand-campaigns";

const day = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** The app's Campaigns tab: the brand's real campaigns, managed on /dashboard/campaigns. */
export function MyCampaigns() {
  const [list, setList] = useState<CampaignSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/campaigns").then((r) => (r.ok ? r.json() : Promise.reject())).then((d: { campaigns: CampaignSummary[] }) => setList(d.campaigns), () => setFailed(true));
  }, []);

  return (
    <section className="d-tablewrap d-pad" aria-label="Your campaigns" aria-busy={!list && !failed}>
      <h3 className="d-cardh">Your campaigns</h3>
      {failed ? <p className="d-muted">Couldn&apos;t load campaigns. Try again in a moment.</p>
        : !list ? <p className="d-muted">Loading…</p>
        : !list.length ? <p className="d-muted">No campaigns yet. Create one, add deals to it, and Scout files the creators&apos; posts and tracks views, cost and delivery.</p>
        : (
          <ul className="d-camplist">
            {list.map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard/campaigns/${c.id}`}>{c.name}</Link>
                <span className="d-sub">{c.phase} · {day(c.start)} – {day(c.end)} · {c.deals} deals · {c.posts} posts · {fmt(c.views)} views{c.review ? ` · ${c.review} to review` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      <Link className="d-btn" href="/dashboard/campaigns">{list?.length ? "Manage campaigns" : "Create a campaign"} <span className="arw">→</span></Link>
    </section>
  );
}
