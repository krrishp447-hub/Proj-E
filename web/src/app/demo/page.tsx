import type { Metadata } from "next";
import { Suspense } from "react";
import { ScoutApp } from "@/components/demo/ScoutApp";
import { DEFAULT_QUERY, searchAll } from "@/lib/scout/search";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getCreators, getHomeCreators } from "@/server/creators";
import { currentUser } from "@/server/auth";
import { appAccess } from "@/server/billing";
import { logUnread } from "@/server/unread";

export const metadata: Metadata = {
  title: "App — ScoutBlack",
  description: "Search, rank and compare Indian YouTube creators on ScoutBlack's signals. Live YouTube public data.",
  robots: { index: false }, // members only (a brand trial or plan)
};

type Search = Promise<{ q?: string }>;

// The brief (?q= from the site's brief box or a shared link) is ranked on the server across every creator; only the
// best results are sent to the browser. Later searches go through /api/search.
async function Demo({ searchParams }: { searchParams: Search }) {
  // The full app needs a plan (a brand trial or subscription); everyone else gets the homepage taste and /pricing.
  const access = await appAccess(await currentUser());
  if (!access.ok) redirect(access.reason === "creator" ? "/dashboard" : access.reason === "onboarding" ? "/onboarding" : `/pricing?app=${access.reason}`);
  const query = (await searchParams).q?.slice(0, 300).trim() || DEFAULT_QUERY;
  const [{ creators, source }, sample] = await Promise.all([getCreators(), getHomeCreators()]);
  const result = searchAll(creators, query);
  if (result.unread) after(() => logUnread(query));
  return <ScoutApp key={query} initialQuery={query} initialResult={result} creatorPool={sample.creators} source={source} trialDaysLeft={access.daysLeft} />;
}

export default function DemoPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p className="d-empty">Loading ScoutBlack…</p>}>
      <Demo searchParams={searchParams} />
    </Suspense>
  );
}
