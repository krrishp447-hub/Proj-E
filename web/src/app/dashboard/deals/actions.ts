"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEAL_STAGES, validTerms, type DealAction, type DealStage } from "@/lib/scout/deals";
import { currentUser } from "@/server/auth";
import { dealAction, openDeal, setChecklist, setDue, type ChecklistItem } from "@/server/deals";

async function user() {
  const u = await currentUser();
  if (!u || !u.onboarded) redirect("/login");
  return u;
}
const isDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function openDealAction(fd: FormData) {
  const u = await user();
  const terms = validTerms({
    fee: Number(fd.get("fee")), deliverables: String(fd.get("deliverables") ?? ""), usage: String(fd.get("usage") ?? ""),
    timeline: String(fd.get("timeline") ?? ""), note: String(fd.get("note") ?? ""),
  });
  const title = String(fd.get("title") ?? "").trim().slice(0, 120);
  const target = String(fd.get("target") ?? "");
  if (!terms || !title || !target) redirect(`/dashboard/deals?${u.role === "brand" ? "new" : "pitch"}=${encodeURIComponent(target)}&error=terms`);
  const checklist = String(fd.get("checklist") ?? "").split("\n").map((l) => l.trim().slice(0, 200)).filter(Boolean).slice(0, 30);
  const id = await openDeal(u, target, title, terms, checklist, isDate(fd.get("due")));
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/deals?open=${id}`);
}

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
