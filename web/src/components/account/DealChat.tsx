"use client";

import { useEffect, useRef, useState } from "react";
import type { Side } from "@/lib/scout/deals";

type Message = { id: number; by: Side; body: string; at: string };
const POLL_MS = 5_000;
const time = (at: string) => new Date(at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Free conversation inside a deal, beside the offer thread. Polls while open (and the tab is visible); opening marks it read. */
export function DealChat({ dealId, side, counterpart, full = false }: { dealId: string; side: Side; counterpart: string; full?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const last = useRef(0);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      if (document.hidden) return;
      const r = await fetch(`/api/deals/${encodeURIComponent(dealId)}/messages?after=${last.current}`).catch(() => null);
      if (!alive || !r?.ok) return;
      const { messages: fresh } = (await r.json()) as { messages: Message[] };
      if (fresh.length) { last.current = fresh.at(-1)!.id; setMessages((m) => [...m, ...fresh.filter((f) => !m.some((x) => x.id === f.id))]); }
    };
    void pull();
    const t = setInterval(pull, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [dealId]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const r = await fetch(`/api/deals/${encodeURIComponent(dealId)}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) }).catch(() => null);
    const data = r ? ((await r.json().catch(() => ({}))) as { message?: Message; error?: string }) : { error: "Couldn't reach Scout. Check your connection." };
    if (data.message) {
      last.current = Math.max(last.current, data.message.id);
      setMessages((m) => [...m, data.message!]);
      setDraft("");
    } else setError(data.error ?? "Couldn't send.");
    setSending(false);
  };

  return (
    <section className={`deals-chat ${full ? "is-full" : ""}`} aria-label={`Messages with ${counterpart}`}>
      <ol ref={listRef} className="deals-msgs" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className={m.by === side ? "is-mine" : ""}>
            <span>{m.body}</span>
            <small>{m.by === side ? "You" : counterpart} · {time(m.at)}</small>
          </li>
        ))}
        {!messages.length && <li className="deals-msgs-empty">No messages yet. Questions about the brief, the script or dates go here.</li>}
      </ol>
      {error && <p className="acct-alert is-bad" role="alert">{error}</p>}
      <form className="deals-msgform" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <label className="sr-only" htmlFor={`msg-${dealId}${full ? "-full" : ""}`}>Message {counterpart}</label>
        <textarea id={`msg-${dealId}${full ? "-full" : ""}`} autoFocus={full} value={draft} maxLength={2000} rows={2} placeholder={`Message ${counterpart}…`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        <button type="submit" className="acct-btn on-ink" disabled={sending || !draft.trim()}>{sending ? "Sending…" : "Send"}</button>
      </form>
    </section>
  );
}
