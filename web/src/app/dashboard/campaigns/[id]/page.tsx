import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { LineChart } from "@/components/demo/LineChart";
import { fmt } from "@/lib/scout/engine";
import { currentUser } from "@/server/auth";
import { appAccess } from "@/server/billing";
import { campaignDetail } from "@/server/brand-campaigns";
import { decidePostAction } from "../actions";
import { CampaignForm } from "../CampaignForm";
import "@/components/account/account.css";

export const metadata: Metadata = { title: "Campaign — ScoutBlack", robots: { index: false } };

type Params = Promise<{ id: string }>;
type Search = Promise<{ saved?: string; error?: string }>;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const day = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

async function Detail({ params, searchParams }: { params: Params; searchParams: Search }) {
  const u = await currentUser();
  const access = await appAccess(u);
  if (!access.ok) redirect(access.reason === "signin" ? "/login" : access.reason === "creator" ? "/dashboard" : access.reason === "onboarding" ? "/onboarding" : `/pricing?app=${access.reason}`);
  const [{ id }, { saved, error }] = await Promise.all([params, searchParams]);
  const c = await campaignDetail(u!, id);
  if (!c) notFound();
  const s = c.stats;
  const review = c.posts.filter((p) => p.status === "review");
  const filed = c.posts.filter((p) => p.status === "filed");
  const organic = c.posts.filter((p) => p.status === "organic");

  return (
    <>
      <div className="dash-head">
        <div>
          <p className="acct-help">{c.phase} · {day(c.start)} – {day(c.end)}</p>
          <h1 className="disp big">{c.name}</h1>
        </div>
        <nav aria-label="Account"><Link href="/dashboard/campaigns">Campaigns</Link><Link href="/dashboard/deals">Deals</Link><Link href="/dashboard">Dashboard</Link></nav>
      </div>
      {saved && <p className="acct-alert" role="status">Saved. Posts were re-checked against the new rules.</p>}
      {error === "form" && <p className="acct-alert is-bad" role="alert">Give the campaign a name and dates (the end can&apos;t be before the start).</p>}

      <div className="dash-grid">
        <section className="acct-card dash-wide" aria-labelledby="kpi-h">
          <h2 id="kpi-h">Results</h2>
          <dl className="acct-stats">
            <div><dt>Posts</dt><dd>{s.posts}</dd></div>
            <div><dt>Views</dt><dd>{fmt(s.views)}</dd></div>
            <div><dt>Engagement</dt><dd>{s.engRate.toFixed(1)}%</dd></div>
            <div><dt>Spend (live)</dt><dd>{inr(s.spend)}</dd></div>
            <div><dt>Cost / 1K views</dt><dd>{s.views ? inr(s.cpv * 1000) : "—"}</dd></div>
            <div><dt>Delivered ÷ promised</dt><dd>{s.deliveredVsPromised ? `${s.deliveredVsPromised.toFixed(2)}×` : "—"}</dd></div>
            <div><dt>On time</dt><dd>{c.deliverables.some((d) => ["Live", "Approved", "Paid"].includes(d.status)) ? `${Math.round(s.onTime)}%` : "—"}</dd></div>
            <div><dt>Disclosed as ads</dt><dd>{s.posts ? `${Math.round(s.disclosed)}%` : "—"}</dd></div>
          </dl>
          {s.posts > 0 ? <LineChart points={s.daily} label="Campaign views" /> : (
            <p className="acct-help">No posts filed yet. Add deals to this campaign from the <Link className="deals-link" href="/dashboard/deals">deal board</Link>; each night ScoutBlack checks those creators&apos; new uploads against the rules below and files matching posts here.</p>
          )}
        </section>

        <section className="acct-card dash-wide" aria-labelledby="deliv-h">
          <h2 id="deliv-h">Deliverables</h2>
          {c.deliverables.length ? (
            <div className="deals-tablewrap">
              <table className="deals-table">
                <thead><tr><th>Creator</th><th>Deliverable</th><th>Due</th><th>Status</th><th>Fee</th><th>Draft</th><th>Video</th></tr></thead>
                <tbody>
                  {c.deliverables.map((d) => (
                    <tr key={d.id} className={d.late ? "is-late" : ""}>
                      <td>{d.creator}</td><td>{d.kind}</td><td>{day(d.due)}{d.late && <span className="deals-turn">Late</span>}</td>
                      <td><span className={`deals-pill s-${d.status.toLowerCase()}`}>{d.status}</span></td>
                      <td>{d.fee ? inr(d.fee) : "—"}</td>
                      <td>{d.draft ? <a className="deals-link" href={d.draft} target="_blank" rel="noopener noreferrer">Drive ↗</a> : "—"}</td>
                      <td>{d.url ? <a className="deals-link" href={d.url} target="_blank" rel="noopener noreferrer">Open ↗</a> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="acct-help">Deals you add to this campaign bring their agreed deliverables here.</p>}
        </section>

        {review.length > 0 && (
          <section className="acct-card dash-wide" aria-labelledby="review-h">
            <h2 id="review-h">Needs your review</h2>
            <p className="acct-help">Posts from your creators that partly match the rules (e.g. a keyword but no tracking link). File the ones that are part of this campaign.</p>
            <ul className="dash-list">
              {review.map((p) => (
                <li key={p.videoId}>
                  <span><a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a></span>
                  <span className="acct-actions">
                    <form action={decidePostAction.bind(null, c.id, p.videoId, "filed")}><button className="acct-btn on-ink" type="submit">File</button></form>
                    <form action={decidePostAction.bind(null, c.id, p.videoId, "rejected")}><button className="acct-btn" type="submit">Not this campaign</button></form>
                  </span>
                  <span className="dash-meta">{p.creator} · {fmt(p.views)} views · matched {p.reasons.join(", ")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="acct-card" aria-labelledby="posts-h">
          <h2 id="posts-h">Filed posts</h2>
          {filed.length ? (
            <ul className="dash-list">
              {filed.map((p) => (
                <li key={p.videoId}>
                  <span><a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a></span>
                  <span className="dash-num">{fmt(p.views)}</span>
                  <span className="dash-meta">{p.creator} · {day(p.publishedAt)}<span className="dash-tag">{p.disclosed ? "Ad" : "No disclosure"}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="acct-help">None yet.</p>}
        </section>

        <section className="acct-card" aria-labelledby="creators-h">
          <h2 id="creators-h">By creator</h2>
          {s.byCreator.length ? (
            <ul className="dash-list">
              {s.byCreator.map((r) => (
                <li key={r.creatorId}>
                  <span><b>{c.creators[r.creatorId]}</b></span>
                  <span className="dash-num">{fmt(r.views)}</span>
                  <span className="dash-meta">{r.posts} post{r.posts === 1 ? "" : "s"} · {r.engRate.toFixed(1)}% engagement{r.projected ? ` · projected ${fmt(r.projected)}` : ""}{r.fee ? ` · ${inr(r.fee)}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : <p className="acct-help">No creators yet.</p>}
          {organic.length > 0 && <p className="acct-help">Also: {organic.length} organic mention{organic.length === 1 ? "" : "s"} from creators outside this campaign matched its rules.</p>}
        </section>

        <section className="acct-card dash-wide" aria-labelledby="rules-h">
          <h2 id="rules-h">Name, dates and tracking rules</h2>
          <CampaignForm c={{ id: c.id, name: c.name, start: c.start, end: c.end, rules: c.rules }} />
        </section>
      </div>
    </>
  );
}

export default function CampaignPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  return (
    <main className="acct dash">
      <Suspense fallback={<p className="acct-help">Loading campaign…</p>}><Detail params={params} searchParams={searchParams} /></Suspense>
    </main>
  );
}
