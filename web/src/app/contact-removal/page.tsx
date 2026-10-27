import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LegalPage } from "@/components/layout/LegalPage";
import { removeContact } from "@/server/contact";
import "@/components/account/account.css";

export const metadata: Metadata = { title: "Remove my contact — ScoutBlack", alternates: { canonical: "/contact-removal" } };

async function remove(fd: FormData) {
  "use server";
  const id = await removeContact(String(fd.get("channel") ?? "").slice(0, 300));
  redirect(`/contact-removal?done=${id ? "1" : "0"}`);
}

async function Status({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  if (done === "1") return <p className="acct-alert" role="status">Done. ScoutBlack no longer shows a contact email for that channel.</p>;
  if (done === "0") return <p className="acct-alert is-bad" role="alert">We couldn&apos;t find that channel on ScoutBlack, so there&apos;s nothing to remove.</p>;
  return null;
}

export default function ContactRemovalPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  return (
    <LegalPage title="Remove my contact" updated="23 October 2026">
      <p>
        If you run a YouTube channel and wrote a business email in your channel or video description, ScoutBlack may show that
        address to signed-in brands, labelled as coming from your public description. Paste your channel link or @handle
        below and we&apos;ll stop showing it, now and after future updates. If you claim your channel on ScoutBlack, brands
        contact you through ScoutBlack instead and the email is never shown.
      </p>
      <Suspense fallback={null}><Status searchParams={searchParams} /></Suspense>
      <form action={remove} className="acct-form">
        <label>Channel link or @handle
          <input name="channel" required maxLength={300} placeholder="https://www.youtube.com/@yourchannel" />
        </label>
        <button className="acct-btn" type="submit">Remove my contact</button>
      </form>
    </LegalPage>
  );
}
