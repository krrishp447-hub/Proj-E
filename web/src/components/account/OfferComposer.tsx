"use client";

import { useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { fmt } from "@/lib/scout/engine";
import type { BrandCard, CreatorCard } from "@/server/offers";
import "./account.css";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const USAGE = ["Organic only · 30 days", "Organic only · 90 days", "Organic + paid ads · 30 days", "Organic + paid ads · 90 days"];
const SHORTLIST_KEY = "scout:shortlist"; // written by the Discover app
const MAX = 10;

/** Starting points brands pick from; every field stays editable. `x` scales the market rate (a Short costs less). */
const TEMPLATES = [
  { name: "Dedicated video", deliverables: "1 dedicated YouTube video (8–12 min)", timeline: "Live within 3 weeks", checklist: "Share product + brief\nScript approval\nTracking link in description\n#ad disclosure", x: 1 },
  { name: "Integration", deliverables: "60–90 s integration in a regular video", timeline: "Live within 3 weeks", checklist: "Share talking points\nIntegration timestamp\nTracking link in description\n#ad disclosure", x: 0.5 },
  { name: "Shorts pack", deliverables: "3 YouTube Shorts", timeline: "Live within 2 weeks", checklist: "Share hooks\nApprove first Short\n#ad disclosure", x: 0.6 },
  { name: "Review + Shorts", deliverables: "1 dedicated video + 2 Shorts", timeline: "Live within 4 weeks", checklist: "Share product + brief\nScript approval\nTracking link\n#ad disclosure", x: 1.4 },
];

function Send({ count, total, side }: { count: number; total: number; side: "brand" | "creator" }) {
  const { pending } = useFormStatus();
  const label = side === "brand" ? (count > 1 ? `Send ${count} offers` : "Send offer") : "Send pitch";
  return <button type="submit" className="acct-btn on-ink" disabled={pending || !count}>{pending ? "Sending…" : `${label}${count && total ? ` · ${inr(total)}` : ""}`}</button>;
}

type Props = {
  side: "brand" | "creator";
  initial: CreatorCard[];
  brands: (BrandCard & { match: boolean })[]; // creator side
  myRate: { low: number; high: number } | null; // creator side: their own market rate
  initialBrand: string | null;
  error: boolean;
  actions: { send: (fd: FormData) => Promise<void>; find: (q: string) => Promise<CreatorCard[]>; byIds: (ids: string[]) => Promise<CreatorCard[]> };
};

export function OfferComposer({ side, initial, brands, myRate, initialBrand, error, actions }: Props) {
  const [to, setTo] = useState<CreatorCard[]>(initial);
  const [fees, setFees] = useState<Record<string, number>>(() => Object.fromEntries(initial.map((c) => [c.channelId, c.fair.low])));
  const [brand, setBrand] = useState<string | null>(initialBrand);
  const [pitchFee, setPitchFee] = useState<number>(myRate?.low ?? 0);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CreatorCard[]>([]);
  const [searching, start] = useTransition();
  const [tpl, setTpl] = useState(TEMPLATES[0]);
  const [fields, setFields] = useState({ deliverables: TEMPLATES[0].deliverables, timeline: TEMPLATES[0].timeline, checklist: TEMPLATES[0].checklist });
  const [note, setNote] = useState("");

  const add = (cs: CreatorCard[]) => {
    setTo((cur) => [...cur, ...cs.filter((c) => !cur.some((x) => x.channelId === c.channelId))].slice(0, MAX));
    setFees((f) => ({ ...Object.fromEntries(cs.map((c) => [c.channelId, Math.round(c.fair.low * tpl.x / 500) * 500])), ...f }));
  };
  const remove = (id: string) => setTo((cur) => cur.filter((c) => c.channelId !== id));
  // One request per keystroke; only the latest may set results (an older, slower reply must not overwrite a newer one).
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const search = (v: string) => {
    setQ(v);
    const n = ++latest.current;
    clearTimeout(timer.current);
    // wait for a pause in typing (250 ms) before asking the server
    timer.current = setTimeout(() => start(async () => {
      const r = v.trim().length >= 2 ? await actions.find(v) : [];
      if (n === latest.current) setResults(r);
    }), 250);
  };
  const addShortlist = () => start(async () => {
    let ids: string[] = [];
    try { ids = JSON.parse(localStorage.getItem(SHORTLIST_KEY) ?? "[]"); } catch {}
    add(await actions.byIds(ids));
  });
  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setTpl(t);
    setFields({ deliverables: t.deliverables, timeline: t.timeline, checklist: t.checklist });
    setFees(Object.fromEntries(to.map((c) => [c.channelId, Math.round((c.fair.low * t.x) / 500) * 500])));
    if (myRate) setPitchFee(Math.round((myRate.low * t.x) / 500) * 500);
  };
  const total = side === "brand" ? to.reduce((s, c) => s + (fees[c.channelId] || 0), 0) : pitchFee;
  const count = side === "brand" ? to.length : brand ? 1 : 0;

  return (
    <form className="acct-form offer" action={actions.send}>
      {error && <p className="acct-alert is-bad" role="alert">Every offer needs a title, fee, deliverables, usage and timeline.</p>}

      <fieldset>
        <legend>{side === "brand" ? "1 · Who" : "1 · Which brand"}</legend>
        {side === "brand" ? (
          <>
            <div className="dash-search">
              <input type="search" value={q} onChange={(e) => search(e.target.value)} placeholder="Search creators by name or handle" aria-label="Search creators" />
              <button type="button" className="acct-btn" onClick={addShortlist} disabled={to.length >= MAX}>Add my shortlist</button>
            </div>
            {searching && <p className="acct-help" role="status">Searching…</p>}
            {results.length > 0 && (
              <ul className="dash-list offer-results">
                {results.map((c) => {
                  const picked = to.some((x) => x.channelId === c.channelId);
                  return (
                    <li key={c.channelId}>
                      <span><b>{c.name}</b></span>
                      <button type="button" className="acct-btn" disabled={picked || to.length >= MAX} onClick={() => add([c])}>{picked ? "Added" : "Add"}</button>
                      <span className="dash-meta">{c.niche} · {c.language} · {fmt(c.subs)} subs · {fmt(c.views)} avg views</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {to.length ? (
              <table className="offer-table">
                <thead><tr><th>Creator</th><th>Reach</th><th>Market rate</th><th>Your offer (₹)</th><th><span className="sr-only">Remove</span></th></tr></thead>
                <tbody>
                  {to.map((c) => (
                    <tr key={c.channelId}>
                      <td><b>{c.name}</b><span className="acct-help"> {c.niche} · {c.language}</span><input type="hidden" name="target" value={c.channelId} /></td>
                      <td>{fmt(c.views)} views</td>
                      <td>{inr(c.fair.low)}–{inr(c.fair.high)}</td>
                      <td>
                        <input type="number" name={`fee:${c.channelId}`} min={0} step={500} required aria-label={`Offer to ${c.name}`}
                          value={fees[c.channelId] ?? ""} onChange={(e) => setFees((f) => ({ ...f, [c.channelId]: Number(e.target.value) }))} />
                        {(fees[c.channelId] ?? 0) < c.fair.low * tpl.x * 0.8 && <span className="offer-warn">below market</span>}
                      </td>
                      <td><button type="button" className="d-x" onClick={() => remove(c.channelId)} aria-label={`Remove ${c.name}`}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="acct-help">No creators yet. Search above, add your Discover shortlist, or use “Send offer” on any creator.</p>
            )}
            {to.length > 1 && (
              <div className="acct-actions">
                <button type="button" className="acct-btn ghost" onClick={() => { const v = fees[to[0].channelId] ?? 0; setFees(Object.fromEntries(to.map((c) => [c.channelId, v]))); }}>Same fee as first for all</button>
                <button type="button" className="acct-btn ghost" onClick={() => applyTemplate(tpl)}>Reset to market rates</button>
              </div>
            )}
            <p className="acct-help">Up to {MAX} creators. Each gets their own deal; nobody sees who else was offered.</p>
          </>
        ) : (
          <>
            {brands.length ? (
              <div className="offer-brands" role="radiogroup" aria-label="Brand">
                {brands.map((b) => (
                  <label key={b.id} className={brand === b.id ? "is-on" : ""}>
                    <input type="radio" name="target" value={b.id} checked={brand === b.id} onChange={() => setBrand(b.id)} required />
                    <span><b>{b.company}</b>{b.match && <span className="deals-turn">Matches your channel</span>}</span>
                    <span className="acct-help">{[b.category, b.brief && `“${b.brief}”`].filter(Boolean).join(" · ")}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="acct-help">No brands on ScoutBlack yet.</p>
            )}
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>2 · What</legend>
        <div className="acct-q">Start from
          <div className="acct-chips" role="group" aria-label="Templates">
            {TEMPLATES.map((t) => (
              <button key={t.name} type="button" className={`offer-tpl ${t === tpl ? "is-on" : ""}`} aria-pressed={t === tpl} onClick={() => applyTemplate(t)}>{t.name}</button>
            ))}
          </div>
        </div>
        <label>Deal title<input type="text" name="title" required maxLength={120} placeholder={side === "brand" ? "Launch review + Shorts" : "Hindi review for your festive launch"} /></label>
        <label>Deliverables<input type="text" name="deliverables" required maxLength={200} value={fields.deliverables} onChange={(e) => setFields({ ...fields, deliverables: e.target.value })} /></label>
        <div className="acct-row">
          <label>Usage rights<select name="usage" defaultValue={USAGE[0]}>{USAGE.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Timeline<input type="text" name="timeline" required maxLength={100} value={fields.timeline} onChange={(e) => setFields({ ...fields, timeline: e.target.value })} /></label>
          <label>Due date<input type="date" name="due" /></label>
        </div>
        {side === "creator" && (
          <label>Your rate (₹)
            <input type="number" name={brand ? `fee:${brand}` : "fee"} min={0} step={500} required value={pitchFee || ""} onChange={(e) => setPitchFee(Number(e.target.value))} />
            {myRate && <span className="acct-help">Your market guide: {inr(myRate.low)}–{inr(myRate.high)} per dedicated video, from your real views and engagement.</span>}
          </label>
        )}
        <label>Checklist <span className="acct-help">One item per line. Both sides tick these off on the deal board.</span>
          <textarea name="checklist" maxLength={2000} value={fields.checklist} onChange={(e) => setFields({ ...fields, checklist: e.target.value })} />
        </label>
      </fieldset>

      <fieldset>
        <legend>3 · Message</legend>
        <label>{side === "brand" ? "Why them, what you're launching" : "Why your audience fits"}
          <textarea name="note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={side === "brand" ? "We're launching Buds X on 1 Nov. Your earbud reviews are exactly the audience we want." : "My viewers are 18–34 Hindi tech buyers; my last earbud review hit 120K views."} />
        </label>
        <span className="acct-help">{note.length}/500</span>
      </fieldset>

      <div className="offer-bar">
        <span>{count ? `${count} ${side === "brand" ? (count > 1 ? "offers" : "offer") : "pitch"} · ${inr(total)} total` : side === "brand" ? "Add at least one creator" : "Choose a brand"}</span>
        <Send count={count} total={total} side={side} />
      </div>
    </form>
  );
}
