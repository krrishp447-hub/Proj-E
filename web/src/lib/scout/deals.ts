// Deal workflow rules, shared by the server (enforcement) and the board UI (what to offer). Pure, unit-tested.

export const DEAL_STAGES = ["Inbound", "Negotiating", "Contracted", "In production", "Live", "Paid", "Declined"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
/** After both sides agree, either side moves the deal along these (drag on the board). */
export const WORK_STAGES: DealStage[] = ["Contracted", "In production", "Live", "Paid"];
const OPEN: DealStage[] = ["Inbound", "Negotiating"];

export type Side = "brand" | "creator";
export type Terms = { fee: number; deliverables: string; usage: string; timeline: string; note?: string };
export type OfferEntry = Terms & { by: Side; at: string };
export type DealState = { stage: DealStage; offers: OfferEntry[] };
export type DealAction = { type: "counter"; terms: Terms } | { type: "accept" } | { type: "decline" } | { type: "move"; to: DealStage };

export const other = (s: Side): Side => (s === "brand" ? "creator" : "brand");

/** Who has to reply next: the side that didn't make the latest offer, while terms are still open. */
export function whoseTurn(d: DealState): Side | null {
  const last = d.offers.at(-1);
  return OPEN.includes(d.stage) && last ? other(last.by) : null;
}

/** Apply an action for one side; returns the new state, or a reason it isn't allowed. */
export function act(d: DealState, side: Side, a: DealAction, now: string): DealState | { error: string } {
  switch (a.type) {
    case "counter":
      if (whoseTurn(d) !== side) return { error: "It's not your turn to reply." };
      return { stage: "Negotiating", offers: [...d.offers, { ...a.terms, by: side, at: now }] };
    case "accept":
      if (whoseTurn(d) !== side) return { error: "You can only accept the other side's latest offer." };
      return { ...d, stage: "Contracted" };
    case "decline":
      if (d.stage === "Paid" || d.stage === "Declined") return { error: "This deal is closed." };
      return { ...d, stage: "Declined" };
    case "move":
      if (!WORK_STAGES.includes(d.stage) || !WORK_STAGES.includes(a.to)) return { error: "Agree terms first: accept an offer to start work." };
      return { ...d, stage: a.to };
  }
}

/** Server-side check of offer terms from a form. */
export function validTerms(t: Partial<Terms>): Terms | null {
  const fee = Math.round(Number(t.fee));
  const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const terms = { fee, deliverables: s(t.deliverables, 200), usage: s(t.usage, 100), timeline: s(t.timeline, 100), note: s(t.note, 500) || undefined };
  return Number.isFinite(fee) && fee >= 0 && fee <= 100_000_000 && terms.deliverables && terms.usage && terms.timeline ? terms : null;
}
