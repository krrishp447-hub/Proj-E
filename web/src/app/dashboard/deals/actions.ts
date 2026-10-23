"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEAL_STAGES, validTerms, type DealAction, type DealStage } from "@/lib/scout/deals";
import { currentUser } from "@/server/auth";
import { dealAction, setChecklist, setDue, type ChecklistItem } from "@/server/deals";

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
