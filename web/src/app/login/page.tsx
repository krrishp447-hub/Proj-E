import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentUser } from "@/server/auth";
import "@/components/account/account.css";

export const metadata: Metadata = {
  title: "Log in — ScoutBlack",
  description: "Sign in to ScoutBlack as a brand or agency, or claim your creator channel.",
  alternates: { canonical: "/login" },
};

const ERRORS: Record<string, string> = {
  denied: "Sign-in was cancelled on Google. Nothing was shared.",
  expired: "That sign-in link expired. Please try again.",
  scopes: "ScoutBlack needs both YouTube permissions to verify your channel. Please tick both boxes on Google's screen.",
  "no-channel": "That Google account doesn't own a YouTube channel. Sign in with the account that owns your channel.",
  taken: "That channel is already claimed by another ScoutBlack account. Contact us if this is your channel.",
  "no-refresh": "Google didn't grant ongoing access. Remove ScoutBlack at myaccount.google.com/permissions and try again.",
  failed: "Something went wrong signing you in. Please try again.",
  config: "Sign-in isn't set up on this server yet.",
};

type Search = Promise<{ error?: string }>;

// Request-time parts (cookie, ?error) live under Suspense so the page shell stays static.
async function Status({ searchParams }: { searchParams: Search }) {
  if (await currentUser()) redirect("/dashboard");
  const { error } = await searchParams;
  return error && ERRORS[error] ? <p className="acct-alert is-bad" role="alert">{ERRORS[error]}</p> : null;
}

export default function LoginPage({ searchParams }: { searchParams: Search }) {
  return (
    <main className="acct">
      <Link href="/" className="acct-back">← ScoutBlack</Link>
      <h1 className="disp big">Log in</h1>
      <p className="acct-lede">One sign-in with Google. Pick your side; you&apos;ll set up your account in under two minutes.</p>
      <Suspense fallback={null}>
        <Status searchParams={searchParams} />
      </Suspense>

      <div className="acct-roles">
        <section className="acct-card" aria-labelledby="brand-h">
          <h2 id="brand-h">Brand / agency</h2>
          <ul>
            <li>Search creators in plain English</li>
            <li>Ranked on engagement, reach, growth and authenticity</li>
            <li>Track campaigns and share of voice</li>
          </ul>
          <p className="acct-fine">ScoutBlack gets your name and email from Google. Nothing else.</p>
          <a className="acct-btn" href="/api/auth/google/start?role=brand">Continue with Google</a>
        </section>

        <section className="acct-card" aria-labelledby="creator-h">
          <h2 id="creator-h">Creator</h2>
          <ul>
            <li>Claim your YouTube channel</li>
            <li>Show brands your verified audience</li>
            <li>Set your rates and manage deals</li>
          </ul>
          <p className="acct-fine">
            ScoutBlack asks Google for <b>read-only</b> YouTube access to confirm the channel is yours and read its audience (age,
            gender, countries, retention). Brands on ScoutBlack see that audience summary. Disconnect anytime from your account. See{" "}
            <Link href="/privacy">Privacy</Link>.
          </p>
          <a className="acct-btn" href="/api/auth/google/start?role=creator">Continue with Google</a>
        </section>
      </div>
    </main>
  );
}
