import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { fmt } from "@/lib/scout/engine";
import { currentUser } from "@/server/auth";
import { appAccess } from "@/server/billing";
import { listCampaigns } from "@/server/brand-campaigns";
import { CampaignForm } from "./CampaignForm";
import "@/components/account/account.css";

export const metadata: Metadata = { title: "Campaigns — ScoutBlack", robots: { index: false } };

const day = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

async function Campaigns({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const u = await currentUser();
  const access = await appAccess(u);
  if (!access.ok) redirect(access.reason === "signin" ? "/login" : access.reason === "creator" ? "/dashboard" : access.reason === "onboarding" ? "/onboarding" : `/pricing?app=${access.reason}`);
  const [campaigns, { error }] = await Promise.all([listCampaigns(u!), searchParams]);
  return (
    <>
      <div className="dash-head">
        <h1 className="disp big">Campaigns</h1>
        <nav aria-label="Account"><Link href="/dashboard">Dashboard</Link><Link href="/dashboard/deals">Deals</Link><Link href="/discover">Discover</Link></nav>
      </div>
      <div className="dash-grid">
        <section className="acct-card dash-wide" aria-labelledby="list-h">
          <h2 id="list-h">Your campaigns</h2>
          {campaigns.length ? (
            <ul className="dash-list">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <span><Link className="deals-link" href={`/dashboard/campaigns/${c.id}`}>{c.name}</Link></span>
                  <span className="dash-num">{fmt(c.views)} views</span>
                  <span className="dash-meta">{c.phase} · {day(c.start)} – {day(c.end)} · {c.deals} deal{c.deals === 1 ? "" : "s"} · {c.posts} post{c.posts === 1 ? "" : "s"}{c.review ? ` · ${c.review} to review` : ""}</span>
                </li>
              ))}
            </ul>
          ) : <p className="acct-help">No campaigns yet. Create one, then add deals to it from the deal board: ScoutBlack files the creators&apos; posts into it automatically and tracks views, cost and delivery.</p>}
        </section>
        <section className="acct-card dash-wide" aria-labelledby="new-h">
          <h2 id="new-h">New campaign</h2>
          {error === "form" && <p className="acct-alert is-bad" role="alert">Give the campaign a name and dates (the end can&apos;t be before the start).</p>}
          <CampaignForm />
        </section>
      </div>
    </>
  );
}

export default function CampaignsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="acct dash">
      <Suspense fallback={<p className="acct-help">Loading campaigns…</p>}><Campaigns searchParams={searchParams} /></Suspense>
    </main>
  );
}
