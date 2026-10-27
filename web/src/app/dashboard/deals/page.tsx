import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DealsBoard } from "@/components/account/DealsBoard";
import { currentUser } from "@/server/auth";
import { listDeals } from "@/server/deals";
import { listCampaigns } from "@/server/brand-campaigns";
import { addDeliverableItem, removeDeliverableItem, runDealAction, saveChecklist, saveDraftLink, saveDue, setDealCampaign, setDeliveryStatus, submitDeliverableLink } from "./actions";
import "@/components/account/account.css";

export const metadata: Metadata = { title: "Deals — ScoutBlack", robots: { index: false } };

type Search = Promise<{ open?: string; new?: string; pitch?: string; sent?: string }>;

async function Workspace({ searchParams }: { searchParams: Search }) {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (!u.onboarded) redirect("/onboarding");
  const s = await searchParams;
  // old composer links (?new= / ?pitch=) now open the send-offer page
  const target = s.new ?? s.pitch;
  if (target) redirect(`/dashboard/offers/new?to=${encodeURIComponent(target)}`);
  const [deals, campaigns] = await Promise.all([listDeals(u), u.role === "brand" ? listCampaigns(u) : []]);
  const side = u.role === "brand" ? "brand" : "creator";
  const sent = Number(s.sent) || 0;

  return (
    <>
      <div className="dash-head">
        <h1 className="disp big">Deals</h1>
        <nav aria-label="Account"><Link href="/dashboard">Dashboard</Link>{side === "brand" && <Link href="/dashboard/campaigns">Campaigns</Link>}<Link href="/account">Settings</Link></nav>
      </div>
      <div className="acct-actions deals-top">
        {(side === "brand" || u.channelId) && (
          <Link className="acct-btn on-ink" href="/dashboard/offers/new">{side === "brand" ? "New offer" : "Pitch a brand"} <span className="arw">→</span></Link>
        )}
      </div>
      {sent > 0 && <p className="acct-alert" role="status">{side === "brand" ? `Sent ${sent} offer${sent > 1 ? "s" : ""}.` : "Pitch sent."} They&apos;re in Inbound until the other side replies.</p>}

      {deals.length ? (
        <DealsBoard deals={deals} side={side} openId={s.open ?? null} actions={{ run: runDealAction, checklist: saveChecklist, due: saveDue, submit: submitDeliverableLink, draft: saveDraftLink, status: setDeliveryStatus, addItem: addDeliverableItem, removeItem: removeDeliverableItem, campaign: setDealCampaign }}
          campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))} />
      ) : (
        <section className="acct-card">
          <h2>No deals yet</h2>
          <p className="acct-help">
            {side === "brand"
              ? "Send your first offer: pick creators, set fees against their market rate, and send."
              : u.channelId
                ? "Brand offers land here. You can also pitch brands whose brief you match."
                : "Connect your YouTube channel to receive brand offers."}
          </p>
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
