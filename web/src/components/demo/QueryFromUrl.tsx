"use client";

import { useSearchParams } from "next/navigation";
import type { Creator } from "@/lib/scout/data";
import { DEFAULT_QUERY, ScoutApp } from "./ScoutApp";

export function QueryFromUrl({ creators, source }: { creators: Creator[]; source: "demo" | "youtube" }) {
  const q = useSearchParams().get("q")?.slice(0, 300).trim();
  return <ScoutApp key={q ?? ""} initialQuery={q || DEFAULT_QUERY} creators={creators} source={source} />;
}
