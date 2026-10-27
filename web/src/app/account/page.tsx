import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChannelCard } from "@/components/account/Audience";
import { getBrandProfile, getCreatorProfile, getMyChannel } from "@/server/accounts";
import { currentUser } from "@/server/auth";
import "@/components/account/account.css";

export const metadata: Metadata = { title: "Account — ScoutBlack", robots: { index: false } };

const inr = (n: number | null) => (n ? `₹${n.toLocaleString("en-IN")}` : "—");
const DONE: Record<string, string> = { onboarded: "You're all set.", disconnected: "YouTube disconnected. Your private audience data was deleted." };

type Search = Promise<{ done?: string }>;

async function Account({ searchParams }: { searchParams: Search }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");
  const { done } = await searchParams;

  const body = user.role === "brand" ? await (async () => {
    const p = await getBrandProfile(user.id);
    return (
      <>
        <dl className="acct-stats">
          <div><dt>Company</dt><dd>{p?.company}</dd></div>
          <div><dt>Type</dt><dd>{p?.kind === "agency" ? "Agency" : "Brand"}</dd></div>
          <div><dt>Category</dt><dd>{p?.category ?? "—"}</dd></div>
          <div><dt>Budget</dt><dd>{p?.budget ?? "—"}</dd></div>
        </dl>
        {p?.tracked.length ? <p className="acct-section">Tracking: {p.tracked.join(", ")}</p> : null}
        <div className="acct-actions">
          <Link className="acct-btn on-ink" href={p?.brief ? `/demo?q=${encodeURIComponent(p.brief)}` : "/demo"}>Find creators</Link>
          <Link className="acct-btn ghost" href="/onboarding">Edit profile</Link>
        </div>
      </>
    );
  })() : await (async () => {
    const [ch, p] = await Promise.all([user.channelId ? getMyChannel(user.channelId) : null, getCreatorProfile(user.id)]);
    return (
      <>
        {ch ? (
          <ChannelCard c={{
            name: ch.name, handle: ch.handle, niche: ch.niche, language: ch.language, subs: ch.subs, avgViews: ch.avg_views, eng: ch.eng,
            age: ch.age, male: ch.male, geo: ch.geo, avgViewPct: ch.avg_view_pct, synced: !!ch.synced_at,
          }} />
        ) : (
          <p className="acct-help">No channel connected. <a href="/api/auth/google/start?role=creator">Connect YouTube</a> to show brands your verified audience.</p>
        )}
        <dl className="acct-stats acct-section">
          <div><dt>Focus</dt><dd>{p?.focus.join(", ") || "—"}</dd></div>
          <div><dt>Languages</dt><dd>{p?.languages.join(", ") || "—"}</dd></div>
          <div><dt>Per video</dt><dd>{inr(p?.rateVideo ?? null)}</dd></div>
          <div><dt>Per Short</dt><dd>{inr(p?.rateShort ?? null)}</dd></div>
          <div><dt>Collabs</dt><dd>{p?.openToCollabs ? "Open" : "Closed"}</dd></div>
        </dl>
        <div className="acct-actions">
          <Link className="acct-btn on-ink" href="/onboarding">Edit profile</Link>
          {ch && (
            <form action="/api/auth/disconnect" method="post">
              <button className="acct-btn ghost" type="submit">Disconnect YouTube</button>
            </form>
          )}
        </div>
      </>
    );
  })();

  return (
    <>
      <h1 className="disp big">{user.role === "brand" ? "Brand account" : "Creator account"}</h1>
      <p className="acct-lede">{user.name ? `${user.name} · ` : ""}{user.email}</p>
      {done && DONE[done] && <p className="acct-alert" role="status">{DONE[done]}</p>}
      <section className="acct-card">{body}</section>
      <div className="acct-actions">
        <form action="/api/auth/signout" method="post"><button className="acct-btn ghost" type="submit">Sign out</button></form>
        <details>
          <summary className="acct-btn danger">Delete account</summary>
          <form action="/api/auth/delete" method="post" className="acct-section">
            <p className="acct-help">Deletes your account and profile{user.role === "creator" ? ", disconnects YouTube and erases your private audience data" : ""}. This can&apos;t be undone.</p>
            <button className="acct-btn danger" type="submit">Yes, delete everything</button>
          </form>
        </details>
      </div>
    </>
  );
}

export default function AccountPage({ searchParams }: { searchParams: Search }) {
  return (
    <main className="acct">
      <Link href="/dashboard" className="acct-back">← Dashboard</Link>
      <Suspense fallback={<p className="acct-lede">Loading…</p>}>
        <Account searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
