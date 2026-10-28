"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validTerms } from "@/lib/scout/deals";
import { currentUser } from "@/server/auth";
import { appAccess } from "@/server/billing";
import { openDeal } from "@/server/deals";
import { MAX_TARGETS, creatorCards, searchCreatorCards, type CreatorCard } from "@/server/offers";

// New offers are part of the paid app (a trial or plan); deals already open keep working without one.
async function brandUser() {
  const u = await currentUser();
  return u?.role === "brand" && u.onboarded && (await appAccess(u)).ok ? u : null;
}

/** Creator picker: search by name/handle, or resolve saved channel ids (the Discover shortlist). Brands only. */
export async function findCreators(q: string): Promise<CreatorCard[]> {
  return (await brandUser()) ? searchCreatorCards(String(q)) : [];
}
export async function creatorsByIds(ids: string[]): Promise<CreatorCard[]> {
  return (await brandUser()) && Array.isArray(ids) ? creatorCards(ids.map(String)) : [];
}

/**
 * One deal per recipient: brands can send the same offer to several creators (each with their own fee);
 * creators pitch one brand. Every recipient and fee is validated here, never trusted from the form.
 */
export async function sendOffers(fd: FormData) {
  const u = await currentUser();
  if (!u || !u.onboarded) redirect("/login");
  if (u.role === "brand") {
    const access = await appAccess(u);
    if (!access.ok) redirect(`/pricing?app=${access.reason}`);
  }
  const targets = [...new Set(fd.getAll("target").map(String))].slice(0, u.role === "brand" ? MAX_TARGETS : 1);
  const title = String(fd.get("title") ?? "").trim().slice(0, 120);
  const checklist = String(fd.get("checklist") ?? "").split("\n").map((l) => l.trim().slice(0, 200)).filter(Boolean).slice(0, 30);
  const dueRaw = String(fd.get("due") ?? "");
  const due = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : null;
  const base = { deliverables: String(fd.get("deliverables") ?? ""), usage: String(fd.get("usage") ?? ""), timeline: String(fd.get("timeline") ?? ""), note: String(fd.get("note") ?? "") };
  // brands: only creators who claimed their channel (anyone else is dropped here and refused by openDeal)
  const allowed = u.role === "brand" ? new Set((await creatorCards(targets)).map((c) => c.channelId)) : null;
  const offers = targets.filter((t) => !allowed || allowed.has(t)).map((t) => ({ target: t, terms: validTerms({ ...base, fee: Number(fd.get(`fee:${t}`)) }) }));
  if (!title || !offers.length || offers.some((o) => !o.terms)) redirect(`/dashboard/offers/new?to=${encodeURIComponent(targets.join(","))}&error=terms`);

  const ids: string[] = [];
  for (const o of offers) ids.push(await openDeal(u, o.target, title, o.terms!, checklist, due));
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/deals?sent=${ids.length}&open=${ids.at(-1)}`);
}
