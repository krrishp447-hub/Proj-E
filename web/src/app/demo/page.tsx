import type { Metadata } from "next";
import { Suspense } from "react";
import { DEFAULT_QUERY, ScoutApp } from "@/components/demo/ScoutApp";
import { QueryFromUrl } from "@/components/demo/QueryFromUrl";
import { getCreators } from "@/server/creators";

export const metadata: Metadata = {
  title: "Demo — Scout",
  description: "Search, rank and compare creators on Scout's 8 signals. Live YouTube public data.",
  alternates: { canonical: "/demo" },
};

export default async function DemoPage() {
  const { creators, source } = await getCreators();
  // The static shell renders the default brief; ?q= (from the site's brief box or a shared link) swaps in on the client.
  return (
    <Suspense fallback={<ScoutApp initialQuery={DEFAULT_QUERY} creators={creators} source={source} />}>
      <QueryFromUrl creators={creators} source={source} />
    </Suspense>
  );
}
