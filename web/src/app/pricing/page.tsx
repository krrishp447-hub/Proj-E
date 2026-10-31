import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PricingPlans, SavingsCalculator } from "@/components/pricing/PricingPlans";
import { site } from "@/config/site";
import "@/components/account/account.css";
import "@/components/pricing/pricing.css";

export const metadata: Metadata = {
  title: "Pricing — ScoutBlack",
  description: "Free for creators, forever. Brands and agencies pay for seats and depth, never per search.",
  alternates: { canonical: "/pricing" },
};

const FAQ = [
  { q: "Why is ScoutBlack free for creators?", a: "Because a database you pay to be in stops being a fair one. If creators paid to be listed, brands would see who paid, not who fits. Every creator is ranked on the same public and verified signals." },
  { q: "Can creators pay to rank higher?", a: "No. Rankings come only from fit and performance. If we ever offer promoted listings, they will be labelled “Promoted” and shown apart from search results, never mixed into them." },
  { q: "Do brands pay per search?", a: "No. Search, shortlists and compare are unlimited on every plan, so your team can explore freely. Plans differ by seats, outreach volume and how deep the tracking goes." },
  { q: "Does ScoutBlack take a cut of deals?", a: "Not today: 0% commission. Later, when contracts and payments run through ScoutBlack, we may charge a small fee on deals paid through the platform, and only on those. We'll announce it well before it applies." },
  { q: "Where does the data come from?", a: "Public YouTube data through the official YouTube API, refreshed every few days (daily for channels in a deal or campaign), plus audience data that creators choose to share by connecting their channel. No scraping behind logins." },
  { q: "Is there a free trial for brands?", a: "Yes, 4 days on any brand plan, from the day you set up your brand profile. Sign in with Google and use the full app on live data. We'll contact you before any billing starts; nothing is charged automatically." },
];

/** Arriving from the app without a plan: say why, and what to do. */
async function AppNotice({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  const { app } = await searchParams;
  if (app === "expired") return <p className="acct-alert" role="status">Your free trial has ended. Pick a plan below and we&apos;ll switch your team back on; nothing is charged automatically.</p>;
  if (app === "signin") return <p className="acct-alert" role="status">The full app is part of every brand plan. Start a 4-day free trial: sign in with Google as a brand.</p>;
  return null;
}

export default function PricingPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  return (
    <main className="acct pr">
      <Link href="/" className="acct-back">← ScoutBlack</Link>
      <h1 className="disp big">Pricing</h1>
      <Suspense fallback={null}><AppNotice searchParams={searchParams} /></Suspense>
      <p className="acct-lede">
        Creators never pay to be found. Brands and agencies pay for seats and depth, never per search. Prices in INR.
      </p>

      <PricingPlans />

      <section className="pr-section" aria-labelledby="value-h">
        <h2 id="value-h" className="pr-h2">What a shortlist costs you today</h2>
        <SavingsCalculator />
      </section>

      <section className="pr-section pr-principles" aria-labelledby="promise-h">
        <h2 id="promise-h" className="pr-h2">What we won&apos;t do</h2>
        <div className="pr-grid">
          <article className="pr-card"><h3>Charge to be listed</h3><p>Every creator is in the index for free. Paying to exist would bias who brands see.</p></article>
          <article className="pr-card"><h3>Sell ranking</h3><p>Results are ranked by fit and performance only. Anything promoted is labelled and kept apart.</p></article>
          <article className="pr-card"><h3>Meter search</h3><p>Explore as much as you need. Searching is how good shortlists happen.</p></article>
          <article className="pr-card"><h3>Take a hidden cut</h3><p>0% commission on deals today. Any future fee applies only to deals paid through ScoutBlack, and we&apos;ll say so first.</p></article>
        </div>
      </section>

      <section className="pr-section" aria-labelledby="faq-h">
        <h2 id="faq-h" className="pr-h2">Questions</h2>
        <div className="pr-faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
        <p className="acct-help">Something else? <a href={`mailto:${site.email}`}>{site.email}</a></p>
      </section>
    </main>
  );
}
