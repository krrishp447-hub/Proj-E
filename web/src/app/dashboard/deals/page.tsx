import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DealsBoard } from "@/components/account/DealsBoard";
import { fairRate } from "@/lib/scout/campaigns";
import { fmt } from "@/lib/scout/engine";
import { currentUser, type User } from "@/server/auth";
import { sql } from "@/server/db";
import { listDeals } from "@/server/deals";
import { openDealAction, runDealAction, saveChecklist, saveDue } from "./actions";
import "@/components/account/account.css";

export const metadata: Metadata = { title: "Deals — Scout", robots: { index: false } };

type Search = Promise<{ open?: string; new?: string; pitch?: string; error?: string }>;
const USAGE = ["Organic only · 30 days", "Organic only · 90 days", "Organic + paid ads · 30 days", "Organic + paid ads · 90 days"];

/** Who the new offer / pitch is for: a creator (brand side) or a brand (creator side). */
async function composeTarget(u: User, s: Awaited<Search>) {
  if (!sql) return null;
  if (u.role === "brand" && s.new) {
    const [c] = (await sql`select channel_id, name, niche, language, subs, avg_views, eng from creators where channel_id = ${s.new}`) as
      { channel_id: string; name: string; niche: string; language: string; subs: number; avg_views: number; eng: number }[];
    return c ? { id: c.channel_id, heading: `Offer to ${c.name}`, sub: `${c.niche} · ${c.language} · ${fmt(c.subs)} subs · ${fmt(c.avg_views)} avg views`, fair: fairRate(c.avg_views, c.eng) } : null;
  }
  if (u.role === "creator" && s.pitch && u.channelId) {
    const [b] = (await sql`select user_id::text as id, company, category, budget, brief from brand_profiles where user_id::text = ${s.pitch}`) as
      { id: string; company: string; category: string | null; budget: string | null; brief: string | null }[];
    const [me] = (await sql`select avg_views, eng from creators where channel_id = ${u.channelId}`) as { avg_views: number; eng: number }[];
    return b ? { id: b.id, heading: `Pitch ${b.company}`, sub: [b.category, b.budget, b.brief && `“${b.brief}”`].filter(Boolean).join(" · "), fair: me ? fairRate(me.avg_views, me.eng) : null } : null;
  }
  return null;
}

async function Workspace({ searchParams }: { searchParams: Search }) {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (!u.onboarded) redirect("/onboarding");
  const s = await searchParams;
  const [deals, target] = await Promise.all([listDeals(u), composeTarget(u, s)]);
  const side = u.role === "brand" ? "brand" : "creator";

  return (
    <>
      <div className="dash-head">
        <h1 className="disp big">Deals</h1>
        <nav aria-label="Account"><Link href="/dashboard">Dashboard</Link><Link href="/account">Settings</Link></nav>
      </div>

      {target && (
        <section className="acct-card deals-compose" aria-labelledby="compose-h">
          <h2 id="compose-h">{target.heading}</h2>
          <p className="acct-help">{target.sub}</p>
          {s.error && <p className="acct-alert is-bad" role="alert">Fill in a title, fee, deliverables, usage and timeline.</p>}
          <form action={openDealAction} className="acct-form deals-counter">
            <input type="hidden" name="target" value={target.id} />
            <label>Deal title<input type="text" name="title" required maxLength={120} placeholder={side === "brand" ? "Launch review + 2 Shorts" : "Dedicated review for your festive launch"} /></label>
            <div className="acct-row">
              <label>{side === "brand" ? "Your offer" : "Your rate"} (₹)
                <input type="number" name="fee" min={0} step={500} required defaultValue={target.fair?.low || undefined} />
              </label>
              <label>Timeline<input type="text" name="timeline" required maxLength={100} placeholder="Live within 3 weeks" /></label>
              <label>Due date<input type="date" name="due" /></label>
            </div>
            {target.fair && <p className="acct-help">Market guide: {`₹${target.fair.low.toLocaleString("en-IN")}–₹${target.fair.high.toLocaleString("en-IN")}`} per dedicated video, from {side === "brand" ? "this creator's" : "your"} real views and engagement.</p>}
            <label>Deliverables<input type="text" name="deliverables" required maxLength={200} placeholder="1 dedicated video (8–12 min) + 2 Shorts" /></label>
            <label>Usage rights<select name="usage">{USAGE.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>Checklist <span className="acct-help">One item per line: briefs, approvals, links, disclosures.</span>
              <textarea name="checklist" maxLength={2000} placeholder={"Share product brief\nScript approval\nTracking link in description\n#ad disclosure"} />
            </label>
            <label>Message<textarea name="note" maxLength={500} placeholder={side === "brand" ? "Why you, what we're launching, what success looks like" : "Why your audience fits, past results, ideas"} /></label>
            <div className="acct-actions">
              <button type="submit" className="acct-btn on-ink">{side === "brand" ? "Send offer" : "Send pitch"}</button>
              <Link className="acct-btn ghost" href="/dashboard/deals">Cancel</Link>
            </div>
          </form>
        </section>
      )}

      {deals.length ? (
        <DealsBoard deals={deals} side={side} openId={s.open ?? null} actions={{ run: runDealAction, checklist: saveChecklist, due: saveDue }} />
      ) : (
        <section className="acct-card">
          <h2>No deals yet</h2>
          <p className="acct-help">
            {side === "brand"
              ? "Send your first offer from the matches on your dashboard, or from any creator in Discover."
              : u.channelId
                ? "Brand offers land here. You can also pitch brands whose brief you match, from your dashboard."
                : "Connect your YouTube channel to receive brand offers."}
          </p>
          <Link className="acct-btn" href="/dashboard">Back to dashboard</Link>
        </section>
      )}
    </>
  );
}

export default function DealsPage({ searchParams }: { searchParams: Search }) {
  return (
    <main className="acct dash deals-page">
      <Suspense fallback={<p className="acct-lede">Loading deals…</p>}>
        <Workspace searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
