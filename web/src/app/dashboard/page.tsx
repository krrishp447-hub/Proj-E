import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChannelCard } from "@/components/account/Audience";
import { LineChart } from "@/components/demo/LineChart";
import type { Creator } from "@/lib/scout/data";
import { contextualize, fmt, parseBrief, score } from "@/lib/scout/engine";
import { getBrandProfile, getCreatorProfile, getMyChannel } from "@/server/accounts";
import { currentUser, type User } from "@/server/auth";
import { getCreators } from "@/server/creators";
import { brandBriefs, brandMentions, channelActivity } from "@/server/dashboard";
import { dealSummary, listDeals } from "@/server/deals";
import { getShareOfVoice } from "@/server/sov";
import { SovView } from "@/components/sov/SovView";
import type { BrandProfile } from "@/server/accounts";
import "@/components/account/account.css";

export const metadata: Metadata = { title: "Dashboard — Scout", robots: { index: false } };

// "7 Oct" this year, "14 Dec 2025" otherwise
const day = (d: string) => {
  const t = new Date(d);
  return t.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(t.getFullYear() !== new Date().getFullYear() && { year: "numeric" }) });
};
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function DealsCard({ s, side }: { s: ReturnType<typeof dealSummary>; side: "brand" | "creator" }) {
  return (
    <section className="acct-card" aria-labelledby="deals-h">
      <h2 id="deals-h">Deals</h2>
      <dl className="acct-stats">
        <div><dt>{side === "brand" ? "New pitches" : "New offers"}</dt><dd>{s.incoming}</dd></div>
        <div><dt>Needs your reply</dt><dd>{s.needsReply}</dd></div>
        <div><dt>Active</dt><dd>{s.active}</dd></div>
        <div><dt>Contracted</dt><dd>{inr(s.contractedValue)}</dd></div>
        {s.unread > 0 && <div><dt>Unread messages</dt><dd>{s.unread}</dd></div>}
      </dl>
      <Link className="acct-btn" href="/dashboard/deals">Open deal board{s.needsReply ? ` · ${s.needsReply} waiting` : ""}{s.unread ? ` · ${s.unread} new message${s.unread === 1 ? "" : "s"}` : ""}</Link>
    </section>
  );
}

/** Fitting creators for a brief, best first. */
function matches(creators: Creator[], brief: string) {
  const b = contextualize(parseBrief(brief), creators);
  return creators.map((c) => score(c, b)).filter((m) => m.fits).sort((a, z) => z.score - a.score);
}

/** Your brand against the competitors in your profile, over tracked creators' uploads (streams in: the first scan is slow). */
async function ShareOfVoiceCard({ p }: { p: BrandProfile }) {
  const you = { name: p.company, terms: p.tracked };
  const result = p.tracked.length && p.competitors.length
    ? await getShareOfVoice([you, ...p.competitors], p.category && p.category !== "Other" ? p.category : null, 90)
    : null;
  if (!result) {
    return (
      <p className="acct-help">
        Add {p.tracked.length ? "" : "your brand names and "}competitors in <Link href="/onboarding">your profile</Link> to see your share of
        YouTube conversation, paid vs earned, and the creators talking about competitors but not you.
      </p>
    );
  }
  return <SovView result={result} you={p.company} offers />;
}

async function BrandDashboard({ user }: { user: User }) {
  const p = await getBrandProfile(user.id);
  if (!p) redirect("/onboarding");
  const [{ creators }, mentions, deals] = await Promise.all([getCreators(), brandMentions(p.tracked, p.category && p.category !== "Other" ? p.category : null), listDeals(user)]);
  const top = p.brief ? matches(creators, p.brief) : [];

  return (
    <>
      <div className="dash-head">
        <h1 className="disp big">{p.company}</h1>
        <nav aria-label="Account"><Link href="/dashboard/deals">Deals</Link><Link href="/dashboard/campaigns">Campaigns</Link><Link href="/demo">Discover</Link><Link href="/account">Settings</Link></nav>
      </div>
      <div className="dash-grid">
        <section className="acct-card dash-wide" aria-labelledby="find-h">
          <h2 id="find-h">Find creators</h2>
          <form action="/demo" className="dash-search">
            <input name="q" aria-label="Brief" defaultValue={p.brief ?? ""} placeholder="Hindi tech YouTubers reviewing earbuds, 100K–1M subs" maxLength={300} />
            <button className="acct-btn" type="submit">Search</button>
          </form>
        </section>

        <DealsCard s={dealSummary(deals)} side="brand" />

        <section className="acct-card dash-wide" aria-labelledby="sov-h">
          <h2 id="sov-h">Share of voice</h2>
          <Suspense fallback={<p className="acct-help">Scanning tracked creators&apos; uploads for you and your competitors…</p>}>
            <ShareOfVoiceCard p={p} />
          </Suspense>
        </section>

        <section className="acct-card" aria-labelledby="mentions-h">
          <h2 id="mentions-h">Your brand on YouTube</h2>
          {!mentions ? (
            <p className="acct-help">Add your brand names and hashtags in <Link href="/onboarding">your profile</Link> to see which creators already talk about you.</p>
          ) : (
            <>
              <p className="acct-help">Last 90 days · uploads naming {p.tracked.filter((t) => !t.startsWith("-")).join(", ")} from {p.category && p.category !== "Other" ? `${p.category} creators` : "all tracked creators"}. False hits? Add an exclusion like “-noise cancelling” in <Link href="/onboarding">your profile</Link>.</p>
              <dl className="acct-stats">
                <div><dt>Videos</dt><dd>{mentions.videos}</dd></div>
                <div><dt>Views</dt><dd>{fmt(mentions.views)}</dd></div>
                <div><dt>Creators</dt><dd>{mentions.creators}</dd></div>
                <div><dt>Disclosed ads</dt><dd>{mentions.disclosedPct}%</dd></div>
              </dl>
              {mentions.top.length ? (
                <ul className="dash-list">
                  {mentions.top.map((m) => (
                    <li key={m.videoId}>
                      <a href={m.url} target="_blank" rel="noopener noreferrer">{m.title}</a>
                      <span className="dash-num">{fmt(m.views)}</span>
                      <span className="dash-meta">{m.creator} · {day(m.publishedAt)}<span className="dash-tag">{m.disclosed ? "Ad" : "Organic"}</span></span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="acct-help">No mentions yet. Organic mentions are the cheapest creators to approach: they already like you.</p>
              )}
            </>
          )}
        </section>

        <section className="acct-card" aria-labelledby="matches-h">
          <h2 id="matches-h">Best matches for your brief</h2>
          {p.brief ? (
            <>
              <p className="acct-help">“{p.brief}” · {top.length} creators fit</p>
              <ul className="dash-list">
                {top.slice(0, 6).map(({ creator: c, score: s }) => (
                  <li key={c.handle}>
                    <span><b>{c.name}</b></span>
                    <span className="dash-num">{s}</span>
                    <span className="dash-meta">{c.niche} · {c.language} · {fmt(c.subs)} subs · {c.eng}% eng{c.geo.length ? " · ✓ verified audience" : ""} · {c.claimed ? <Link href={`/dashboard/offers/new?to=${encodeURIComponent(c.channelId)}`}>Send offer →</Link> : "not on Scout yet"}</span>
                  </li>
                ))}
              </ul>
              <div className="acct-actions">
                <Link className="acct-btn" href={`/demo?q=${encodeURIComponent(p.brief)}`}>Open full shortlist</Link>
                {top.slice(0, 6).some((m) => m.creator.claimed) && <Link className="acct-btn ghost" href={`/dashboard/offers/new?to=${top.slice(0, 6).filter((m) => m.creator.claimed).map((m) => encodeURIComponent(m.creator.channelId)).join(",")}`}>Offer to those on Scout</Link>}
              </div>
            </>
          ) : (
            <p className="acct-help">Save a brief in <Link href="/onboarding">your profile</Link> and your best matches show here.</p>
          )}
        </section>
      </div>
    </>
  );
}

async function CreatorDashboard({ user }: { user: User }) {
  const [p, ch] = await Promise.all([getCreatorProfile(user.id), user.channelId ? getMyChannel(user.channelId) : null]);
  if (!p) redirect("/onboarding");
  const [{ creators }, activity, briefs, deals] = await Promise.all([
    getCreators(),
    user.channelId ? channelActivity(user.channelId) : null,
    brandBriefs(),
    listDeals(user),
  ]);
  const me = ch?.handle ? creators.find((c) => c.handle === ch.handle) : undefined;
  const niche = me ? matches(creators, `${me.niche} ${me.language === "English" ? "" : me.language} creators`) : [];
  const rank = me ? niche.findIndex((m) => m.creator.id === me.id) + 1 : 0;
  const fitBrands = me ? briefs.filter((b) => score(me, contextualize(parseBrief(b.brief), creators)).fits) : [];
  const briefHits = fitBrands.length;
  // Quality as a percentile within the niche: absolute scores are low for everyone until campaign history exists.
  const blank = parseBrief("");
  const peers = me ? creators.filter((c) => c.niche === me.niche).map((c) => score(c, blank).score) : [];
  const mine = me ? score(me, blank).score : 0;
  const topPct = peers.length ? Math.max(1, Math.ceil((peers.filter((s) => s >= mine).length / peers.length) * 100)) : null;
  const checklist = [
    { done: !!ch, label: "Connect your YouTube channel", href: "/api/auth/google/start?role=creator" },
    { done: !!ch?.synced_at, label: "Verified audience synced", href: "/account" },
    { done: p.focus.length > 0 && p.languages.length > 0, label: "Content focus and languages", href: "/onboarding" },
    { done: !!(p.rateVideo || p.rateShort), label: "Rates set", href: "/onboarding" },
  ];

  return (
    <>
      <div className="dash-head">
        <h1 className="disp big">{ch?.name ?? user.name ?? "Dashboard"}</h1>
        <nav aria-label="Account"><Link href="/dashboard/deals">Deals</Link><Link href="/onboarding">Edit profile</Link><Link href="/account">Settings</Link></nav>
      </div>
      <div className="dash-grid">
        <section className="acct-card" aria-labelledby="seen-h">
          <h2 id="seen-h">How brands find you</h2>
          {me ? (
            <dl className="acct-stats">
              <div><dt>Quality in {me.niche}</dt><dd>Top {topPct}%</dd></div>
              <div><dt>Rank · {me.niche}{me.language !== "English" ? ` · ${me.language}` : ""}</dt><dd>{rank ? `#${rank} of ${niche.length}` : "—"}</dd></div>
              <div><dt>Brand briefs you match</dt><dd>{briefHits} of {briefs.length}</dd></div>
              <div><dt>Collabs</dt><dd>{p.openToCollabs ? "Open" : "Closed"}</dd></div>
            </dl>
          ) : (
            <p className="acct-help">Your public stats appear after the next data refresh (within a day of connecting).</p>
          )}
          <p className="acct-help">Quality blends engagement, reach, growth and authenticity. Rank is your position when a brand searches your niche{me && me.language !== "English" ? " and language" : ""}.</p>
        </section>

        <DealsCard s={dealSummary(deals)} side="creator" />

        <section className="acct-card" aria-labelledby="brands-h">
          <h2 id="brands-h">Brands looking for creators like you</h2>
          {fitBrands.some((b) => b.pitchable) ? (
            <ul className="dash-list">
              {fitBrands.filter((b) => b.pitchable).slice(0, 6).map((b) => (
                <li key={b.id}>
                  <span><b>{b.company}</b></span>
                  <span className="dash-meta">{b.category ? `${b.category} · ` : ""}“{b.brief}” · <Link href={`/dashboard/offers/new?to=${b.id}`}>Pitch →</Link></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="acct-help">No brand briefs on Scout match your channel yet. Brands that do show up here, and you can pitch them directly.</p>
          )}
        </section>

        <section className="acct-card" aria-labelledby="todo-h">
          <h2 id="todo-h">Profile checklist</h2>
          <ul className="dash-check">
            {checklist.map((c) => (
              <li key={c.label} className={c.done ? "is-done" : ""}>{c.done ? c.label : <a href={c.href}>{c.label}</a>}</li>
            ))}
          </ul>
          <dl className="acct-stats">
            <div><dt>Per video</dt><dd>{p.rateVideo ? inr(p.rateVideo) : "—"}</dd></div>
            <div><dt>Per Short</dt><dd>{p.rateShort ? inr(p.rateShort) : "—"}</dd></div>
          </dl>
        </section>

        {ch && (
          <section className="acct-card dash-wide" aria-labelledby="ch-h">
            <h2 id="ch-h">Your channel</h2>
            <ChannelCard c={{
              name: ch.name, handle: ch.handle, niche: ch.niche, language: ch.language, subs: ch.subs, avgViews: ch.avg_views, eng: ch.eng,
              age: ch.age, male: ch.male, geo: ch.geo, avgViewPct: ch.avg_view_pct, synced: !!ch.synced_at,
            }} />
          </section>
        )}

        {activity && activity.trend.length > 1 && (
          <section className="acct-card" aria-labelledby="trend-h">
            <h2 id="trend-h">Subscribers</h2>
            <LineChart points={activity.trend} label="Subscribers" />
            <p className="acct-help">Daily since Scout started tracking your channel. 90-day growth appears after a month of history.</p>
          </section>
        )}

        {activity && activity.uploads.length > 0 && (
          <section className="acct-card" aria-labelledby="up-h">
            <h2 id="up-h">Recent uploads</h2>
            <ul className="dash-list">
              {activity.uploads.map((v) => (
                <li key={v.video_id}>
                  <a href={v.url} target="_blank" rel="noopener noreferrer">{v.title}</a>
                  <span className="dash-num">{fmt(v.views)}</span>
                  <span className="dash-meta">{day(v.published)} · {v.views ? (((v.likes + v.comments) / v.views) * 100).toFixed(1) : 0}% engagement</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");
  return user.role === "brand" ? <BrandDashboard user={user} /> : <CreatorDashboard user={user} />;
}

export default function DashboardPage() {
  return (
    <main className="acct dash">
      <Suspense fallback={<p className="acct-lede">Loading your dashboard…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
