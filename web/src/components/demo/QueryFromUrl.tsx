"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_QUERY, ScoutApp } from "./ScoutApp";

export function QueryFromUrl() {
  const q = useSearchParams().get("q")?.slice(0, 300).trim();
  return <ScoutApp key={q ?? ""} initialQuery={q || DEFAULT_QUERY} />;
}
