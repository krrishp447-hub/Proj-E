"use client";

import { useMemo, useState, useTransition } from "react";
import { DEAL_STAGES, WORK_STAGES, type DealAction, type DealStage, type Side } from "@/lib/scout/deals";
import type { ChecklistItem, DealView } from "@/server/deals";
import "./account.css";

type Actions = {
  run: (id: string, a: DealAction) => Promise<string | null>;
  checklist: (id: string, items: ChecklistItem[]) => Promise<void>;
  due: (id: string, due: string) => Promise<void>;
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const short = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const USAGE = ["Organic only · 30 days", "Organic only · 90 days", "Organic + paid ads · 30 days", "Organic + paid ads · 90 days"];

/** ClickUp-style deal workspace: board (drag after contract) or list, filters, and a detail drawer with the offer thread. */
export function DealsBoard({ deals, side, openId, actions }: { deals: DealView[]; side: Side; openId: string | null; actions: Actions }) {
  const [view, setView] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const [open, setOpen] = useState<string | null>(openId);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return deals.filter((d) => (!mine || d.myTurn) && (!t || `${d.title} ${d.counterpart.name}`.toLowerCase().includes(t)));
  }, [deals, q, mine]);
  const run = (id: string, a: DealAction) => start(async () => setError(await actions.run(id, a)));
  const current = deals.find((d) => d.id === open) ?? null;

  return (
    <div className="deals">
      <div className="deals-bar">
        <div className="deals-seg" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")}>Board</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
        </div>
        <input type="search" placeholder="Search deals" aria-label="Search deals" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="acct-inline"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Needs my reply ({deals.filter((d) => d.myTurn).length})</label>
        {pending && <span className="deals-saving" role="status">Saving…</span>}
      </div>
      {error && <p className="acct-alert is-bad" role="alert">{error}</p>}

      <div className={`deals-main ${current ? "has-drawer" : ""}`}>
        {view === "board" ? (
          <div className="deals-board" aria-label="Deal board">
            {DEAL_STAGES.map((s) => {
              const col = shown.filter((d) => d.stage === s);
              const droppable = WORK_STAGES.includes(s);
              return (
                <section
                  key={s}
                  className={`deals-col ${dragId && droppable ? "is-target" : ""}`}
                  aria-label={`${s}, ${col.length} deals`}
                  onDragOver={(e) => { if (droppable && dragId) e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); if (dragId) run(dragId, { type: "move", to: s }); setDragId(null); }}
                >
                  <h3>{s} <span>{col.length}</span></h3>
                  {col.map((d) => <Card key={d.id} d={d} side={side} active={d.id === open} dragging={d.id === dragId} onOpen={() => setOpen(d.id)} onDrag={WORK_STAGES.includes(d.stage) ? setDragId : undefined} />)}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="deals-tablewrap">
            <table className="deals-table">
              <thead><tr><th>Deal</th><th>With</th><th>Stage</th><th>Latest offer</th><th>Due</th><th>Checklist</th><th>Updated</th></tr></thead>
              <tbody>
                {shown.map((d) => (
                  <tr key={d.id} className={d.id === open ? "is-active" : ""}>
                    <td><button type="button" className="deals-link" onClick={() => setOpen(d.id)}>{d.title}</button>{d.myTurn && <span className="deals-turn">Your turn</span>}</td>
                    <td>{d.counterpart.name}</td>
                    <td>{d.stage}</td>
                    <td>{d.offers.at(-1) ? `${inr(d.offers.at(-1)!.fee)} · ${d.offers.at(-1)!.by === side ? "you" : "them"}` : "—"}</td>
                    <td>{d.due ? short(d.due) : "—"}</td>
                    <td>{d.checklist.length ? `${d.checklist.filter((c) => c.done).length}/${d.checklist.length}` : "—"}</td>
                    <td>{short(d.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!shown.length && <p className="acct-help">No deals match.</p>}
          </div>
        )}

        {current && <Drawer key={current.id + current.offers.length + current.stage} d={current} side={side} pending={pending} onClose={() => setOpen(null)} run={run} actions={actions} />}
      </div>
    </div>
  );
}

function Card({ d, side, active, dragging, onOpen, onDrag }: { d: DealView; side: Side; active: boolean; dragging: boolean; onOpen: () => void; onDrag?: (id: string | null) => void }) {
  const last = d.offers.at(-1);
  const done = d.checklist.filter((c) => c.done).length;
  return (
    <button
      type="button"
      className={`deals-card ${active ? "is-active" : ""} ${d.myTurn ? "is-turn" : ""} ${dragging ? "is-dragging" : ""}`}
      onClick={onOpen}
      draggable={!!onDrag}
      onDragStart={() => onDrag?.(d.id)}
      onDragEnd={() => onDrag?.(null)}
    >
      <b>{d.counterpart.name}</b>
      <span>{d.title}</span>
      <span className="deals-cardmeta">
        {last && <>{inr(last.fee)} · {last.by === side ? "your offer" : "their offer"}</>}
        {d.due && <> · due {short(d.due)}</>}
        {d.checklist.length > 0 && <> · ☑ {done}/{d.checklist.length}</>}
      </span>
      {d.myTurn && <span className="deals-turn">{d.stage === "Inbound" ? (d.initiatedBy === side ? "Your turn" : "New — reply") : "Your turn"}</span>}
    </button>
  );
}

function Drawer({ d, side, pending, onClose, run, actions }: { d: DealView; side: Side; pending: boolean; onClose: () => void; run: (id: string, a: DealAction) => void; actions: Actions }) {
  const last = d.offers.at(-1);
  const [items, setItems] = useState<ChecklistItem[]>(d.checklist);
  const [newItem, setNewItem] = useState("");
  const [counter, setCounter] = useState(false);
  const saveItems = (next: ChecklistItem[]) => { setItems(next); void actions.checklist(d.id, next); };
  const open = d.stage === "Inbound" || d.stage === "Negotiating";

  return (
    <aside className="deals-drawer acct-card" aria-label={`Deal: ${d.title}`}>
      <div className="deals-drawerhead">
        <div>
          <p className="acct-help">{d.counterpart.name} · {d.counterpart.sub}</p>
          <h2>{d.title}</h2>
        </div>
        <button type="button" className="acct-btn ghost" onClick={onClose} aria-label="Close deal">✕</button>
      </div>

      <div className="acct-row">
        <label className="acct-q">Stage
          {WORK_STAGES.includes(d.stage) ? (
            <select value={d.stage} disabled={pending} onChange={(e) => run(d.id, { type: "move", to: e.target.value as DealStage })}>
              {WORK_STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
          ) : <b>{d.stage}</b>}
        </label>
        <label className="acct-q">Due
          <input type="date" defaultValue={d.due ?? ""} onChange={(e) => void actions.due(d.id, e.target.value)} />
        </label>
      </div>

      {d.myTurn && last && (
        <div className="deals-callout">
          <b>{d.stage === "Inbound" ? "New" : "Counter"} offer: {inr(last.fee)}</b> for {last.deliverables} · {last.usage} · {last.timeline}
          {d.fair && <p className="acct-help">Market guide for this creator: {inr(d.fair.low)}–{inr(d.fair.high)} per video.{last.fee < d.fair.low ? " This offer is below it." : ""}</p>}
          <div className="acct-actions">
            <button type="button" className="acct-btn on-ink" disabled={pending} onClick={() => run(d.id, { type: "accept" })}>Accept {inr(last.fee)}</button>
            <button type="button" className="acct-btn" disabled={pending} onClick={() => setCounter((v) => !v)}>Counter</button>
            <button type="button" className="acct-btn danger" disabled={pending} onClick={() => run(d.id, { type: "decline" })}>Decline</button>
          </div>
        </div>
      )}
      {!d.myTurn && open && <p className="acct-help">Waiting for {d.counterpart.name} to reply. <button type="button" className="deals-link" onClick={() => run(d.id, { type: "decline" })}>Withdraw</button></p>}

      {counter && last && (
        <form
          className="acct-form deals-counter"
          action={(fd) => { run(d.id, { type: "counter", terms: { fee: Number(fd.get("fee")), deliverables: String(fd.get("deliverables")), usage: String(fd.get("usage")), timeline: String(fd.get("timeline")), note: String(fd.get("note") ?? "") } }); setCounter(false); }}
        >
          <div className="acct-row">
            <label>Fee (₹)<input type="number" name="fee" min={0} step={500} required defaultValue={last.fee} /></label>
            <label>Timeline<input type="text" name="timeline" required maxLength={100} defaultValue={last.timeline} /></label>
          </div>
          <label>Deliverables<input type="text" name="deliverables" required maxLength={200} defaultValue={last.deliverables} /></label>
          <label>Usage rights<select name="usage" defaultValue={USAGE.includes(last.usage) ? last.usage : USAGE[0]}>{USAGE.map((u) => <option key={u}>{u}</option>)}</select></label>
          <label>Note<textarea name="note" maxLength={500} placeholder="Why this number: reach, past results, usage…" /></label>
          <button type="submit" className="acct-btn on-ink" disabled={pending}>Send counter</button>
        </form>
      )}

      <h3>Checklist</h3>
      <ul className="dash-check deals-checklist">
        {items.map((c, i) => (
          <li key={i}>
            <label className="acct-inline"><input type="checkbox" checked={c.done} onChange={() => saveItems(items.map((x, k) => (k === i ? { ...x, done: !x.done } : x)))} /> {c.text}</label>
          </li>
        ))}
      </ul>
      <form className="dash-search" onSubmit={(e) => { e.preventDefault(); if (newItem.trim()) { saveItems([...items, { text: newItem.trim(), done: false }]); setNewItem(""); } }}>
        <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add a deliverable or task" aria-label="New checklist item" maxLength={200} />
        <button type="submit" className="acct-btn">Add</button>
      </form>

      <h3>Offer history</h3>
      <ol className="deals-thread">
        {d.offers.map((o, i) => (
          <li key={i} className={o.by === side ? "is-mine" : ""}>
            <b>{o.by === side ? "You" : d.counterpart.name} · {inr(o.fee)}</b>
            <span>{o.deliverables} · {o.usage} · {o.timeline}</span>
            {o.note && <q>{o.note}</q>}
            <span className="acct-help">{short(o.at)}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
