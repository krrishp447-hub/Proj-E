import type { Metadata } from "next";
import { Suspense } from "react";
import { ScoutApp } from "@/components/demo/ScoutApp";
import { DEFAULT_QUERY, searchAll } from "@/lib/scout/search";
import { after } from "next/server";
import { getCreators, getHomeCreators } from "@/server/creators";
import { logUnread } from "@/server/unread";

export const metadata: Metadata = {
  title: "Demo — Scout",
  description: "Search, rank and compare Indian YouTube creators on Scout's signals. Live YouTube public data.",
  alternates: { canonical: "/demo" },
};

type Search = Promise<{ q?: string }>;

// The brief (?q= from the site's brief box or a shared link) is ranked on the server across every creator; only the
// best results are sent to the browser. Later searches go through /api/search.
async function Demo({ searchParams }: { searchParams: Search }) {
  const query = (await searchParams).q?.slice(0, 300).trim() || DEFAULT_QUERY;
  const [{ creators, source }, sample] = await Promise.all([getCreators(), getHomeCreators()]);
  const result = searchAll(creators, query);
  if (result.unread) after(() => logUnread(query));
  return <ScoutApp key={query} initialQuery={query} initialResult={result} creatorPool={sample.creators} source={source} />;
}

export default function DemoPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p className="d-empty">Loading Scout…</p>}>
      <Demo searchParams={searchParams} />
    </Suspense>
  );
}
