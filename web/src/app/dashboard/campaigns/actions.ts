"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth";
import { appAccess } from "@/server/billing";
import { decidePost, rulesFrom, saveCampaign } from "@/server/brand-campaigns";

/** Campaigns are part of a brand plan, like the rest of the app. */
async function brand() {
  const u = await currentUser();
  if (!u) redirect("/login");
  const access = await appAccess(u);
  if (!access.ok) redirect(access.reason === "creator" ? "/dashboard" : access.reason === "onboarding" ? "/onboarding" : `/pricing?app=${access.reason}`);
  return u;
}
const isDate = (v: FormDataEntryValue | null) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Create (no id) or edit a campaign from the form. Dates and a name are required; rules are comma-separated lists. */
export async function saveCampaignForm(id: string | null, fd: FormData) {
  const u = await brand();
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  const start = isDate(fd.get("start")), end = isDate(fd.get("end"));
  const back = id ? `/dashboard/campaigns/${encodeURIComponent(id)}` : "/dashboard/campaigns";
  if (!name || !start || !end || end < start) redirect(`${back}?error=form`);
  const text = (k: string) => String(fd.get(k) ?? "").slice(0, 600);
  const saved = await saveCampaign(u, { name, start, end, rules: rulesFrom({ hashtags: text("hashtags"), links: text("links"), mentions: text("mentions"), keywords: text("keywords") }) }, id ?? undefined);
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/campaigns/${encodeURIComponent(saved)}${id ? "?saved=1" : ""}`);
}

export async function decidePostAction(campaignId: string, videoId: string, status: string) {
  if (status !== "filed" && status !== "rejected") return;
  await decidePost(await brand(), String(campaignId), String(videoId), status);
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
}
