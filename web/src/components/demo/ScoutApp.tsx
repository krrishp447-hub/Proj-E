"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Creator, Platform } from "@/lib/scout/data";
import { contextualize, describe, parseBrief, score } from "@/lib/scout/engine";
import { CampaignsView } from "./CampaignsView";
import { ComparePanel } from "./ComparePanel";
import { CreatorView } from "./CreatorView";
import { DetailPanel } from "./DetailPanel";
import { ResultsTable, type SortKey } from "./ResultsTable";
import { ShareOfVoice } from "./ShareOfVoice";
import "./demo.css";

export const DEFAULT_QUERY = "Indian YouTube tech creators who review earbuds, 50K–500K subs, strong engagement";
const EXAMPLES = [
  DEFAULT_QUERY,
  "Fast-growing Instagram fitness creators in India",
  "YouTube finance creators in India with high engagement",
  "US audio reviewers, ANC earbuds, under 500K",
];
const PLATFORMS: ("All" | Platform)[] = ["All", "YouTube", "Instagram"];

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const MAX_SHORTLIST = 4;
const SHORTLIST_KEY = "scout:shortlist";

/** `embedded`: running inside the homepage, so no top bar and no URL rewriting. */
type Props = { initialQuery: string; creators: Creator[]; source?: "youtube" | "none"; embedded?: boolean };

export function ScoutApp({ initialQuery, creators, source = "none", embedded = false }: Props) {
  const [draft, setDraft] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [platform, setPlatform] = useState<"All" | Platform>("All");
  const [showMisses, setShowMisses] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "score", dir: -1 });
  const [selected, setSelected] = useState<number | null>(null);
  const [shortlist, setShortlist] = useState<number[]>([]);
  const [tab, setTab] = useState<"detail" | "compare">("detail");
  const [role, setRole] = useState<"brand" | "creator">("brand");
  const [brandTab, setBrandTab] = useState<"discover" | "campaigns" | "sov">("discover");

  const brief = useMemo(() => contextualize(parseBrief(query), creators), [query, creators]);
  const understood = describe(brief);
  const scored = useMemo(() => creators.map((c) => score(c, brief)), [creators, brief]);

  const { rows, misses } = useMemo(() => {
    const onPlatform = scored.filter((m) => platform === "All" || m.creator.platform === platform);
    const misses = onPlatform.filter((m) => !m.fits).length;
    const pick = (m: (typeof scored)[number]) =>
      sort.key === "score" ? m.score : sort.key === "auth" ? m.creator.auth : m.creator[sort.key];
    const rows = onPlatform
      .filter((m) => showMisses || m.fits)
      .sort((a, b) => (pick(a) - pick(b)) * sort.dir || b.score - a.score);
    return { rows, misses };
  }, [scored, platform, showMisses, sort]);

  const activeId = selected !== null && rows.some((m) => m.creator.id === selected) ? selected : rows[0]?.creator.id;
  const active = scored.find((m) => m.creator.id === activeId);
  const fits = rows.filter((m) => m.fits);

  const run = (q: string) => {
    setDraft(q);
    setQuery(q);
    setSelected(null);
    if (!embedded) window.history.replaceState(null, "", `?q=${encodeURIComponent(q)}`); // shareable briefs
  };
  // Up to 4 (the compare table's width). Persisted by channel id, which is stable across data refreshes; list positions aren't.
  const toggleShortlist = (id: number) =>
    setShortlist((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_SHORTLIST ? s : [...s, id]));
  useEffect(() => {
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(SHORTLIST_KEY) ?? "[]");
      const ids = saved.map((ch) => creators.findIndex((c) => c.channelId === ch)).filter((i) => i >= 0).slice(0, MAX_SHORTLIST);
      if (ids.length) setShortlist(ids); // eslint-disable-line react-hooks/set-state-in-effect -- one-time restore after hydration
    } catch {} // storage blocked or corrupt: start empty
  }, [creators]);
  useEffect(() => {
    try { localStorage.setItem(SHORTLIST_KEY, JSON.stringify(shortlist.map((i) => creators[i]?.channelId).filter(Boolean))); } catch {}
  }, [shortlist, creators]);
  const onSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }));

  const kpis = [
    { label: "Matches", value: fits.length, note: `of ${creators.length}` },
    { label: "Median match", value: median(fits.map((m) => m.score)) },
    { label: "Avg authenticity", value: fits.length ? Math.round(fits.reduce((s, m) => s + m.creator.auth, 0) / fits.length) : 0 },
    { label: "Proven", value: fits.filter((m) => m.creator.proven).length, note: "on-platform record" },
    { label: "Shortlist", value: shortlist.length, note: `of ${MAX_SHORTLIST}` },
  ];

  return (
    <div className={`d-app ${embedded ? "is-embedded" : ""}`}>
      {!embedded && (
      <header className="d-top">
        <Link href="/" className="d-wm">Scout</Link>
        <span className="d-tag">{source === "youtube" ? "Live · YouTube public data" : "No creator data yet"}</span>
        <Link href="/" className="d-back">← Site</Link>
      </header>
      )}

      <div className="d-seg d-role" role="radiogroup" aria-label="View as">
        <button type="button" role="radio" aria-checked={role === "brand"} onClick={() => setRole("brand")}>Brand &amp; agency</button>
        <button type="button" role="radio" aria-checked={role === "creator"} onClick={() => setRole("creator")}>Creator</button>
      </div>

      {role === "creator" ? (creators.length ? <CreatorView creators={creators} /> : <p className="d-empty">No creators yet — they appear after the first data ingest.</p>) : <>
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
        <button type="submit" className="d-btn">Search</button>
      </form>

      <div className="d-under">
        {understood.length ? (
          <>
            <span className="d-lbl">Understood</span>
            {understood.map((t) => <span key={t} className="d-token">{t}</span>)}
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
        <div className="d-seg" role="radiogroup" aria-label="Platform">
          {PLATFORMS.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={platform === p} onClick={() => setPlatform(p)}>{p}</button>
          ))}
        </div>
        <label className="d-check">
          <input type="checkbox" checked={showMisses} onChange={(e) => setShowMisses(e.target.checked)} />
          Show near misses ({misses})
        </label>
      </div>

      <dl className="d-kpis">
        {kpis.map((k) => (
          <div key={k.label}>
            <dt>{k.label}</dt>
            <dd>{k.value}{k.note && <small> {k.note}</small>}</dd>
          </div>
        ))}
      </dl>

      <div className="d-main">
        <section className="d-tablewrap" aria-label="Ranked creators">
          {rows.length ? (
            <ResultsTable rows={rows} sort={sort} onSort={onSort} activeId={activeId} onSelect={(id) => { setSelected(id); setTab("detail"); }} shortlist={shortlist} onToggle={toggleShortlist} />
          ) : (
            <div className="d-empty">
              No creator fits every part of this brief.
              {misses > 0 && <button type="button" className="d-link" onClick={() => setShowMisses(true)}>Show {misses} near misses</button>}
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
            <button type="button" className="d-btn d-cmpgo" onClick={() => setTab("compare")}>Compare {shortlist.length} shortlisted →</button>
          )}
          {tab === "compare" && shortlist.length >= 2 ? (
            <ComparePanel matches={shortlist.map((id) => scored[id])} onRemove={toggleShortlist} />
          ) : active ? (
            <DetailPanel m={active} inShortlist={shortlist.includes(active.creator.id)} onToggle={() => toggleShortlist(active.creator.id)} />
          ) : (
            <p className="d-muted">Select a creator to see why they ranked.</p>
          )}
          {tab === "detail" && shortlist.length === 1 && <p className="d-hint">Shortlist one more creator to compare and check audience overlap.</p>}
          {tab === "detail" && shortlist.length >= MAX_SHORTLIST && active && !shortlist.includes(active.creator.id) && <p className="d-hint">Shortlist is full ({MAX_SHORTLIST}). Remove someone in Compare to add {active.creator.name}.</p>}
        </aside>
      </div>
      </>}
      </>}
    </div>
  );
}
