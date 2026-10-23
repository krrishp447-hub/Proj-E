"use server";

import { redirect } from "next/navigation";
import { BUDGETS, NICHES } from "@/lib/scout/data";
import { LANGUAGES } from "@/lib/scout/engine";
import { saveBrandProfile, saveCreatorProfile } from "@/server/accounts";
import { currentUser } from "@/server/auth";

// Server-side validation: never trust the form. Unknown options are dropped, text is trimmed and capped.
const text = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);
const pick = (fd: FormData, k: string, allowed: readonly string[]) => fd.getAll(k).map(String).filter((v) => allowed.includes(v));
const rupees = (fd: FormData, k: string) => {
  const n = Math.round(Number(fd.get(k)));
  return Number.isFinite(n) && n > 0 && n <= 100_000_000 ? n : null;
};

async function requireUser(role: "creator" | "brand") {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect("/onboarding");
  return user;
}

export async function saveCreatorOnboarding(fd: FormData) {
  const user = await requireUser("creator");
  await saveCreatorProfile(user.id, {
    focus: pick(fd, "focus", NICHES),
    languages: pick(fd, "languages", LANGUAGES),
    rateVideo: rupees(fd, "rateVideo"),
    rateShort: rupees(fd, "rateShort"),
    openToCollabs: fd.get("openToCollabs") === "on",
  });
  redirect("/dashboard");
}

export async function saveBrandOnboarding(fd: FormData) {
  const user = await requireUser("brand");
  const company = text(fd, "company", 120);
  if (!company) redirect("/onboarding?error=company");
  const site = text(fd, "website", 300);
  const website = /^https?:\/\/[^\s]+\.[^\s]+$/i.test(site) ? site : null;
  const brief = text(fd, "brief", 300);
  await saveBrandProfile(user.id, {
    company,
    kind: fd.get("kind") === "agency" ? "agency" : "brand",
    website,
    category: pick(fd, "category", [...NICHES, "Other"])[0] ?? null,
    brief: brief || null,
    budget: pick(fd, "budget", BUDGETS)[0] ?? null,
    pitchable: fd.get("pitchable") === "on",
    tracked: text(fd, "tracked", 400).split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12),
  });
  redirect("/dashboard");
}
