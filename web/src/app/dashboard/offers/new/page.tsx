import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OfferComposer } from "@/components/account/OfferComposer";
import { contextualize, parseBrief, score } from "@/lib/scout/engine";
import { getMyChannel } from "@/server/accounts";
import { currentUser } from "@/server/auth";
import { getCreators } from "@/server/creators";
import { creatorCards, pitchableBrands } from "@/server/offers";
import { creatorsByIds, findCreators, sendOffers } from "./actions";
import "@/components/account/account.css";

export const metadata: Metadata = { title: "Send offer — Scout", robots: { index: false } };

type Search = Promise<{ to?: string; error?: string }>;

async function Composer({ searchParams }: { searchParams: Search }) {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (!u.onboarded) redirect("/onboarding");
  const s = await searchParams;
  const to = (s.to ?? "").split(",").filter(Boolean);
  const actions = { send: sendOffers, find: findCreators, byIds: creatorsByIds };

  if (u.role === "brand") {
    const initial = await creatorCards(to); // claimed channels only
    const notOnScout = to.length - initial.length;
    return (
      <>
        <h1 className="disp big">Send offers</h1>
        <p className="acct-lede">Pick creators, set each fee against their market rate, and send. Each creator gets their own deal on the board.</p>
        <p className="acct-help">Offers go to creators who&apos;ve claimed their channel on Scout. For anyone else, use <b>Invite to Scout</b> on their profile in the app; you can send the offer once they join.</p>
        {notOnScout > 0 && <p className="acct-alert" role="status">{notOnScout} of the creators you picked {notOnScout === 1 ? "isn’t" : "aren’t"} on Scout yet, so {notOnScout === 1 ? "it was" : "they were"} left out. Invite them from the app first.</p>}
        <OfferComposer side="brand" initial={initial} brands={[]} myRate={null} initialBrand={null} error={!!s.error} actions={actions} />
      </>
    );
  }

  if (!u.channelId) redirect("/dashboard");
  const [brands, ch, { creators }] = await Promise.all([pitchableBrands(), getMyChannel(u.channelId), getCreators()]);
  const me = ch?.handle ? creators.find((c) => c.handle === ch.handle) : undefined;
  const fits = (brief: string | null) => !!(me && brief && score(me, contextualize(parseBrief(brief), creators)).fits);
  const ranked = brands.map((b) => ({ ...b, match: fits(b.brief) })).sort((a, b) => Number(b.match) - Number(a.match));
  const myCard = me ? (await creatorCards([me.channelId]))[0] : undefined;

  return (
    <>
      <h1 className="disp big">Pitch a brand</h1>
      <p className="acct-lede">Brands whose brief matches your channel are listed first. Your pitch lands in their deal board as a new pitch.</p>
      <OfferComposer side="creator" initial={[]} brands={ranked} myRate={myCard?.fair ?? null} initialBrand={to[0] ?? null} error={!!s.error} actions={actions} />
    </>
  );
}

export default function SendOfferPage({ searchParams }: { searchParams: Search }) {
  return (
    <main className="acct dash">
      <Link href="/dashboard/deals" className="acct-back">← Deals</Link>
      <Suspense fallback={<p className="acct-lede">Loading…</p>}>
        <Composer searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
