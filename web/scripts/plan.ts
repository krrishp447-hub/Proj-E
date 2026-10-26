// Switch a brand's plan on or off until payments exist (the pricing FAQ: we talk to the brand before any billing).
//   npm run plan -- <email> starter|growth|agency [months]   activate, paid through N months (default 1)
//   npm run plan -- <email> trial [days]                      extend or restart the free trial (default 14)
//   npm run plan -- <email> cancel                            end access
//   npm run plan -- <email>                                   show the current plan
import { neon } from "@neondatabase/serverless";

const [email, action, n] = process.argv.slice(2);
if (!email) { console.log("usage: npm run plan -- <email> [starter|growth|agency [months] | trial [days] | cancel]"); process.exit(1); }
const sql = neon(process.env.DATABASE_URL!);
const [u] = await sql`select id, role from users where lower(email) = lower(${email})`;
if (!u) { console.log(`No account with that email. They need to sign in once first.`); process.exit(1); }
if (u.role !== "brand") { console.log("That account is a creator; plans are for brand accounts."); process.exit(1); }

if (["starter", "growth", "agency"].includes(action)) {
  const months = Math.max(1, Number(n) || 1);
  await sql`insert into subscriptions (user_id, plan, status, current_period_end) values (${u.id}, ${action}, 'active', now() + make_interval(months => ${months}))
    on conflict (user_id) do update set plan = excluded.plan, status = 'active', current_period_end = excluded.current_period_end, updated_at = now()`;
} else if (action === "trial") {
  const days = Math.max(1, Number(n) || 14);
  await sql`insert into subscriptions (user_id, trial_ends_at) values (${u.id}, now() + make_interval(days => ${days}))
    on conflict (user_id) do update set plan = 'trial', status = 'trial', trial_ends_at = excluded.trial_ends_at, updated_at = now()`;
} else if (action === "cancel") {
  await sql`update subscriptions set status = 'canceled', updated_at = now() where user_id = ${u.id}`;
} else if (action) {
  console.log(`Unknown action "${action}".`); process.exit(1);
}
const [s] = await sql`select plan, status, (trial_ends_at at time zone 'Asia/Kolkata')::date::text trial_ends, (current_period_end at time zone 'Asia/Kolkata')::date::text paid_through
  from subscriptions where user_id = ${u.id}`;
console.log(s ?? "No plan yet (the trial starts when they finish their brand profile).");
