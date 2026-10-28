import "server-only";
import type { User } from "./auth";
import { sql } from "./db";

// The full app (/discover and the APIs behind it) is for brand accounts with a plan: a free trial that starts with the brand
// profile, then an active subscription. Payments aren't built yet: plans are switched on with `npm run plan`, and the
// pricing FAQ promises we talk to the brand before any billing.
export const TRIAL_DAYS = 4;

export type Access = { ok: true; plan: string; daysLeft: number | null } | { ok: false; reason: "signin" | "creator" | "onboarding" | "expired" };

export async function appAccess(u: User | null): Promise<Access> {
  if (!u) return { ok: false, reason: "signin" };
  if (u.role !== "brand") return { ok: false, reason: "creator" };
  if (!u.onboarded || !sql) return { ok: false, reason: "onboarding" };
  await startTrial(u.id); // accounts made before plans existed get their trial now
  const [s] = (await sql`
    select plan, status, ceil(extract(epoch from (trial_ends_at - now())) / 86400)::int as trial_days,
      current_period_end is null or current_period_end > now() as paid_through
    from subscriptions where user_id = ${u.id}`) as { plan: string; status: string; trial_days: number | null; paid_through: boolean }[];
  if (s?.status === "active" && s.paid_through) return { ok: true, plan: s.plan, daysLeft: null };
  if (s?.status === "trial" && (s.trial_days ?? 0) > 0) return { ok: true, plan: "trial", daysLeft: s.trial_days };
  return { ok: false, reason: "expired" };
}

/** Once per brand account: the trial clock starts with the brand profile. */
export async function startTrial(userId: string) {
  if (!sql) return;
  await sql`insert into subscriptions (user_id, trial_ends_at) values (${userId}, now() + make_interval(days => ${TRIAL_DAYS})) on conflict do nothing`;
}
