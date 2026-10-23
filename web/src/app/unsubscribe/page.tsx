import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LegalPage } from "@/components/layout/LegalPage";
import { unsubscribe } from "@/server/contact";
import "@/components/account/account.css";

export const metadata: Metadata = { title: "Unsubscribe — Scout", robots: { index: false } };

type Params = Promise<{ e?: string; t?: string; done?: string }>;

// A button, not a link that unsubscribes on open: mail scanners prefetch links.
async function confirm(fd: FormData) {
  "use server";
  const ok = await unsubscribe(String(fd.get("e") ?? ""), String(fd.get("t") ?? ""));
  redirect(`/unsubscribe?done=${ok ? "1" : "0"}`);
}

async function Body({ searchParams }: { searchParams: Params }) {
  const { e = "", t = "", done } = await searchParams;
  if (done === "1") return <p className="acct-alert" role="status">You&apos;re unsubscribed. Scout won&apos;t email this address again.</p>;
  if (done === "0" || !e || !t) return <p className="acct-alert is-bad" role="alert">This unsubscribe link isn&apos;t valid. Use the link from the email.</p>;
  return (
    <form action={confirm} className="acct-form">
      <p>Stop all Scout emails to <b>{e}</b>?</p>
      <input type="hidden" name="e" value={e} />
      <input type="hidden" name="t" value={t} />
      <button className="acct-btn" type="submit">Unsubscribe</button>
    </form>
  );
}

export default function UnsubscribePage({ searchParams }: { searchParams: Params }) {
  return (
    <LegalPage title="Unsubscribe" updated="23 October 2026">
      <Suspense fallback={null}><Body searchParams={searchParams} /></Suspense>
    </LegalPage>
  );
}
