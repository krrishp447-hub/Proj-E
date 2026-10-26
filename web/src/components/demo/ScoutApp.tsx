"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Creator } from "@/lib/scout/data";
import type { Match } from "@/lib/scout/engine";
import { DEFAULT_QUERY, type SearchResult } from "@/lib/scout/search";
import { CampaignsView } from "./CampaignsView";
import { CompareDialog, ComparePanel } from "./ComparePanel";
import { CreatorView } from "./CreatorView";
import { DetailPanel } from "./DetailPanel";
import { ResultsTable, type SortKey } from "./ResultsTable";
import { ShareOfVoice } from "./ShareOfVoice";
import "./demo.css";

const EXAMPLES = [
  DEFAULT_QUERY,
  "Fast-growing YouTube fitness creators in India",
  "YouTube finance creators in India with high engagement",
  "BGMI streamers in Hindi",
];

const MAX_SHORTLIST = 4;
const SHORTLIST_KEY = "scout:shortlist";

/**
 * The full app at /demo. Every creator is ranked on the server (/api/search); only the best ~150 come down.
 * `creatorPool` feeds the Creator view (any creators; a sample is fine). The homepage has its own light HomeTry.
 */
type Props = {
  initialQuery: string;
  initialResult?: SearchResult;
  creatorPool?: Creator[];
  source?: "youtube" | "none";
  trialDaysLeft?: number | null; // on a free trial: shown in the top bar with a link to plans
};

export function ScoutApp({ initialQuery, initialResult, creatorPool = [], source = "none", trialDaysLeft = null }: Props) {
  const [draft, setDraft] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [showMisses, setShowMisses] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "score", dir: -1 });
  const [selected, setSelected] = useState<string | null>(null); // channel ids: stable across searches
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [tab, setTab] = useState<"detail" | "compare">("detail");
  const [role, setRole] = useState<"brand" | "creator">("brand");
  const [brandTab, setBrandTab] = useState<"discover" | "campaigns" | "sov">("discover");
  const [remote, setRemote] = useState<SearchResult | null>(initialResult ?? null);
  const [loading, setLoading] = useState(false);

  const result = remote;

  // Every creator we've seen scored for the current brief, so the shortlist / compare work across result pages.
  const known = useMemo(() => {
    const m = new Map<string, Match>();
    for (const x of [...(result?.misses ?? []), ...(result?.fits ?? []), ...(result?.pinned ?? [])]) m.set(x.creator.channelId, x);
    return m;
  }, [result]);
  // shortlisted creators this result doesn't include: ask the server to score them too
  const missing = remote && remote.query === query ? shortlist.filter((id) => !known.has(id)).join(",") : "";

  useEffect(() => {
    if (remote?.query === query && !missing) return;
    const ctl = new AbortController();
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- marks a fetch in flight
    fetch(`/api/search?${new URLSearchParams({ q: query, ids: shortlist.join(",") })}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((r: SearchResult) => { setRemote(r); setLoading(false); })
      .catch((e: Error) => { if (e.name !== "AbortError") setLoading(false); });
    return () => ctl.abort();
    // shortlist is read for the request but only `missing` should trigger a refetch
  }, [query, missing]); // eslint-disable-line react-hooks/exhaustive-deps

  const { rows, missCount } = useMemo(() => {
    if (!result) return { rows: [] as Match[], missCount: 0 };
    const pick = (m: Match) => (sort.key === "score" ? m.score : sort.key === "auth" ? m.creator.auth : m.creator[sort.key]);
    const rows = [...result.fits, ...(showMisses ? result.misses : [])].sort((a, b) => (pick(a) - pick(b)) * sort.dir || b.score - a.score);
    return { rows, missCount: result.missCount };
  }, [result, showMisses, sort]);

  const activeId = selected !== null && rows.some((m) => m.creator.channelId === selected) ? selected : rows[0]?.creator.channelId;
  const active = rows.find((m) => m.creator.channelId === activeId);

  const run = (q: string) => {
    setDraft(q);
    setQuery(q);
    setSelected(null);
    window.history.replaceState(null, "", `?q=${encodeURIComponent(q)}`); // shareable briefs
  };
  // Up to 4 (the compare table's width), by channel id.
  const toggleShortlist = (id: string) =>
    setShortlist((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_SHORTLIST ? s : [...s, id]));
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(SHORTLIST_KEY) ?? "[]");
      const ids = Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string").slice(0, MAX_SHORTLIST) : [];
      if (ids.length) setShortlist(ids); // eslint-disable-line react-hooks/set-state-in-effect -- one-time restore after hydration
    } catch {} // storage blocked or corrupt: start empty
  }, []);
  useEffect(() => {
    try { localStorage.setItem(SHORTLIST_KEY, JSON.stringify(shortlist)); } catch {}
  }, [shortlist]);
  const onSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }));

  const compare = shortlist.map((id) => known.get(id)).filter((m): m is Match => !!m);
  const kpis = [
    { label: "Matches", value: result?.fitCount ?? 0, note: `of ${(result?.total ?? 0).toLocaleString("en-IN")}` },
    { label: "Median match", value: result?.medianScore ?? 0 },
    { label: "Avg authenticity", value: result?.avgAuth ?? 0 },
    { label: "Proven", value: result?.proven ?? 0, note: "on-platform record" },
    { label: "Shortlist", value: shortlist.length, note: `of ${MAX_SHORTLIST}` },
  ];
  const pool = creatorPool;

  return (
    <div className="d-app">
      <header className="d-top">
        <Link href="/" className="d-wm">Scout</Link>
        <span className="d-tag">{source === "youtube" ? "Live · YouTube public data" : "No creator data yet"}</span>
        {trialDaysLeft !== null && <Link href="/pricing" className="d-trial">Free trial · {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left · Plans</Link>}
        <Link href="/" className="d-back">← Site</Link>
      </header>

      <div className="d-seg d-role" role="radiogroup" aria-label="View as">
        <button type="button" role="radio" aria-checked={role === "brand"} onClick={() => setRole("brand")}>Brand &amp; agency</button>
        <button type="button" role="radio" aria-checked={role === "creator"} onClick={() => setRole("creator")}>Creator</button>
      </div>

      {role === "creator" ? (pool.length ? <CreatorView creators={pool} /> : <p className="d-empty">No creators yet — they appear after the first data ingest.</p>) : <>
      <div className="d-tabs d-tabs-top" role="tablist" aria-label="Brand sections">
        <button role="tab" aria-selected={brandTab === "discover"} onClick={() => setBrandTab("discover")}>Discover</button>
        <button role="tab" aria-selected={brandTab === "campaigns"} onClick={() => setBrandTab("campaigns")}>Campaigns</button>
        <button role="tab" aria-selected={brandTab === "sov"} onClick={() => setBrandTab("sov")}>Share of voice</button>
      </div>
      {brandTab === "campaigns" && <CampaignsView />}
      {brandTab === "sov" && <ShareOfVoice />}
      {brandTab === "discover" && <>
      <form className="d-search" role="search" onSubmit={(e) => { e.preventDefault(); run(draft); }}>
        <label htmlFor="brief" className="sr-only">Describe the creators you need</label>
        <input id="brief" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Describe the creators you need…" autoComplete="off" />
        <button type="submit" className="d-btn" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
      </form>

      <div className="d-under">
        {result?.unread ? (
          <span className="d-lbl">Couldn’t read this brief yet — try a niche, language or topic, e.g. “Tamil cooking channels” or “budget phone reviews”.</span>
        ) : result?.understood.length ? (
          <>
            <span className="d-lbl">Understood</span>
            {result.understood.map((t) => <span key={t} className="d-token">{t}</span>)}
          </>
        ) : (
          <span className="d-lbl">No niche, platform or size recognised — ranking every creator on quality.</span>
        )}
      </div>
      <div className="d-examples" aria-label="Example briefs">
        {EXAMPLES.filter((q) => q !== query).map((q) => (
          <button key={q} type="button" onClick={() => run(q)}>{q}</button>
        ))}
      </div>

      <div className="d-controls">
        <label className="d-check">
          <input type="checkbox" checked={showMisses} onChange={(e) => setShowMisses(e.target.checked)} />
          Show near misses ({missCount.toLocaleString("en-IN")})
        </label>
      </div>

      <dl className={`d-kpis ${loading ? "is-loading" : ""}`} aria-busy={loading}>
        {kpis.map((k) => (
          <div key={k.label}>
            <dt>{k.label}</dt>
            <dd>{k.value}{k.note && <small> {k.note}</small>}</dd>
          </div>
        ))}
      </dl>

      <div className="d-main">
        <section className={`d-tablewrap ${loading ? "is-loading" : ""}`} aria-label="Ranked creators" aria-busy={loading}>
          {rows.length ? (
            <>
              <ResultsTable rows={rows} sort={sort} onSort={onSort} activeId={activeId} onSelect={(id) => { setSelected(id); setTab("detail"); }} shortlist={shortlist} onToggle={toggleShortlist} />
              {result && result.fitCount > result.fits.length && (
                <p className="d-hint">Showing the best {result.fits.length} of {result.fitCount.toLocaleString("en-IN")} matches. Add detail to the brief to narrow it down.</p>
              )}
            </>
          ) : (
            <div className="d-empty">
              {result ? "No creator fits every part of this brief." : "Searching…"}
              {missCount > 0 && <button type="button" className="d-link" onClick={() => setShowMisses(true)}>Show near misses</button>}
            </div>
          )}
        </section>

        <aside className="d-panel" aria-label="Details">
          <div className="d-tabs" role="tablist">
            <button role="tab" aria-selected={tab === "detail"} onClick={() => setTab("detail")}>Detail</button>
            <button role="tab" aria-selected={tab === "compare"} onClick={() => setTab("compare")} disabled={shortlist.length < 2}>
              Compare{shortlist.length ? ` (${shortlist.length})` : ""}
            </button>
          </div>
          {shortlist.length >= 2 && tab === "detail" && (
            <button type="button" className="d-btn d-cmpgo" onClick={() => setTab("compare")}>Compare {shortlist.length} shortlisted <span className="arw">→</span></button>
          )}
          {tab === "compare" && shortlist.length >= 2 && (
            <CompareDialog count={shortlist.length} onClose={() => setTab("detail")}>
              {compare.length >= 2 ? <ComparePanel key={shortlist.join()} matches={compare} onRemove={toggleShortlist} /> : <p className="d-muted">Scoring your shortlist against this brief…</p>}
            </CompareDialog>
          )}
          {active ? (
            <DetailPanel key={active.creator.channelId} m={active} inShortlist={shortlist.includes(active.creator.channelId)} onToggle={() => toggleShortlist(active.creator.channelId)} />
          ) : (
            <p className="d-muted">Select a creator to see why they ranked.</p>
          )}
          {tab === "detail" && shortlist.length === 1 && <p className="d-hint">Shortlist one more creator to compare and check audience overlap.</p>}
          {tab === "detail" && shortlist.length >= MAX_SHORTLIST && active && !shortlist.includes(active.creator.channelId) && <p className="d-hint">Shortlist is full ({MAX_SHORTLIST}). Remove someone in Compare to add {active.creator.name}.</p>}
        </aside>
      </div>
      </>}
      </>}
    </div>
  );
}
