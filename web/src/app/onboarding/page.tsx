import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { ChannelSummary } from "@/components/account/Audience";
import { BrandOnboarding, CreatorOnboarding } from "@/components/account/Onboarding";
import { fairRate } from "@/lib/scout/campaigns";
import { getBrandProfile, getCreatorProfile, getMyChannel } from "@/server/accounts";
import { currentUser } from "@/server/auth";
import { saveBrandOnboarding, saveCreatorOnboarding } from "./actions";
import "@/components/account/account.css";

export const metadata: Metadata = { title: "Set up your account — Scout", robots: { index: false } };

async function Flow() {
  const user = await currentUser();
  if (!user) redirect("/login");

  if (user.role === "brand") {
    const p = await getBrandProfile(user.id);
    return (
      <>
        <h1 className="disp big">Set up</h1>
        <p className="acct-lede">Three quick steps, then Scout runs your first brief.</p>
        <BrandOnboarding
          action={saveBrandOnboarding}
          defaults={p ?? { company: "", kind: "brand", website: null, category: null, brief: null, budget: null, tracked: [], pitchable: false, competitors: [] }}
        />
      </>
    );
  }

  const [ch, p] = await Promise.all([user.channelId ? getMyChannel(user.channelId) : null, getCreatorProfile(user.id)]);
  const channel: ChannelSummary = {
    name: ch?.name ?? null, handle: ch?.handle ?? null, niche: ch?.niche ?? null, language: ch?.language ?? null,
    subs: ch?.subs ?? null, avgViews: ch?.avg_views ?? null, eng: ch?.eng ?? null,
    age: ch?.age ?? [], male: ch?.male ?? null, geo: ch?.geo ?? [], avgViewPct: ch?.avg_view_pct ?? null, synced: !!ch?.synced_at,
  };
  const fair = ch?.avg_views ? fairRate(ch.avg_views, ch.eng ?? 0) : null;
  return (
    <>
      <h1 className="disp big">Your profile</h1>
      <p className="acct-lede">Your channel is connected. Check what brands will see, then tell them what you make and what you charge.</p>
      <CreatorOnboarding
        action={saveCreatorOnboarding}
        channel={channel}
        fair={fair}
        defaults={p ?? { focus: ch?.niche && ch.niche !== "Other" ? [ch.niche] : [], languages: ch?.language ? [ch.language] : [], rateVideo: null, rateShort: null, openToCollabs: true }}
      />
    </>
  );
}

export default function OnboardingPage() {
  return (
    <main className="acct">
      <Link href="/dashboard" className="acct-back">← Dashboard</Link>
      <Suspense fallback={<p className="acct-lede">Loading…</p>}>
        <Flow />
      </Suspense>
    </main>
  );
}
