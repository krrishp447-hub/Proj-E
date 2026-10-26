"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEAL_STAGES, validTerms, type DealAction, type DealStage } from "@/lib/scout/deals";
import { currentUser } from "@/server/auth";
import { assignDeal } from "@/server/brand-campaigns";
import { dealAction, setChecklist, setDue, type ChecklistItem } from "@/server/deals";
import { addDeliverable, removeDeliverable, setDeliverableStatus, setDraftLink, submitDeliverable } from "@/server/delivery";

async function user() {
  const u = await currentUser();
  if (!u || !u.onboarded) redirect("/login");
  return u;
}
const isDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Board/drawer actions. Returns an error message, or null on success (the page re-renders with fresh data). */
export async function runDealAction(id: string, a: DealAction): Promise<string | null> {
  const u = await user();
  let action: DealAction;
  if (a?.type === "counter") {
    const terms = validTerms(a.terms ?? {});
    if (!terms) return "Fill in fee, deliverables, usage and timeline.";
    action = { type: "counter", terms };
  } else if (a?.type === "move") {
    if (!DEAL_STAGES.includes(a.to as DealStage)) return "Unknown stage.";
    action = { type: "move", to: a.to };
  } else if (a?.type === "accept" || a?.type === "decline") action = { type: a.type };
  else return "Unknown action.";
  const err = await dealAction(u, String(id), action);
  revalidatePath("/dashboard", "layout");
  return err;
}

export async function saveChecklist(id: string, items: ChecklistItem[]) {
  await setChecklist(await user(), String(id), Array.isArray(items) ? items : []);
  revalidatePath("/dashboard", "layout");
}

export async function saveDue(id: string, due: string) {
  await setDue(await user(), String(id), isDate(due));
  revalidatePath("/dashboard", "layout");
}

// Delivery: the creator submits links, the brand approves, pays, reopens and edits items; deals go into campaigns.
export async function submitDeliverableLink(id: string, url: string): Promise<string | null> {
  const err = await submitDeliverable(await user(), String(id), String(url ?? ""));
  revalidatePath("/dashboard", "layout");
  return err;
}
export async function saveDraftLink(id: string, url: string): Promise<string | null> {
  const err = await setDraftLink(await user(), String(id), String(url ?? "").slice(0, 600));
  revalidatePath("/dashboard", "layout");
  return err;
}
export async function setDeliveryStatus(id: string, to: string): Promise<string | null> {
  if (to !== "Approved" && to !== "Paid" && to !== "Planned") return "Unknown status.";
  const err = await setDeliverableStatus(await user(), String(id), to);
  revalidatePath("/dashboard", "layout");
  return err;
}
export async function addDeliverableItem(dealId: string, kind: string, due: string): Promise<string | null> {
  const k = kind === "YouTube Short" ? "YouTube Short" : "YouTube video";
  const d = isDate(due);
  if (!d) return "Pick a due date.";
  const err = await addDeliverable(await user(), String(dealId), k, d);
  revalidatePath("/dashboard", "layout");
  return err;
}
export async function removeDeliverableItem(id: string): Promise<string | null> {
  const err = await removeDeliverable(await user(), String(id));
  revalidatePath("/dashboard", "layout");
  return err;
}
export async function setDealCampaign(dealId: string, campaignId: string): Promise<string | null> {
  const u = await user();
  if (u.role !== "brand") return "Only the brand manages campaigns.";
  const err = await assignDeal(u, String(dealId), campaignId ? String(campaignId) : null);
  revalidatePath("/dashboard", "layout");
  return err;
}
