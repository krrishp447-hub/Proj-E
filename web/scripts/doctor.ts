// Checks every piece of live-data config for real and says exactly what to fix.
//   npm run doctor            (reads .env.local)
// Costs 1 YouTube quota unit. Never prints secret values.
import { neon } from "@neondatabase/serverless";

const { NEXT_PUBLIC_SITE_URL, DATABASE_URL, YOUTUBE_API_KEY, CRON_SECRET } = process.env;
let failures = 0;
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string, fix: string) => { failures++; console.log(`  ✗ ${msg}\n      → ${fix}`); };

console.log("\nSite");
if (!NEXT_PUBLIC_SITE_URL) bad("NEXT_PUBLIC_SITE_URL is empty", "set it to your live URL in Vercel (http://localhost:3000 locally)");
else if (NEXT_PUBLIC_SITE_URL.includes("example.com")) bad("NEXT_PUBLIC_SITE_URL is still the placeholder", "set your real domain");
else ok(`NEXT_PUBLIC_SITE_URL = ${NEXT_PUBLIC_SITE_URL}`);

console.log("\nDatabase");
const TABLES = ["channel_seeds", "creators", "snapshots", "brands", "campaigns", "campaign_creators", "videos", "video_snapshots", "campaign_posts", "deals", "offers", "deliverables"];
if (!DATABASE_URL) bad("DATABASE_URL is empty", "Vercel → your project → Storage → Create → Neon, then copy DATABASE_URL into .env.local");
else {
  try {
    const sql = neon(DATABASE_URL);
    await sql`select 1`;
    ok(`connected (${new URL(DATABASE_URL).hostname})`);
    const rows = (await sql`select table_name from information_schema.tables where table_schema = 'public'`) as { table_name: string }[];
    const have = new Set(rows.map((r) => r.table_name));
    const missing = TABLES.filter((t) => !have.has(t));
    if (missing.length) bad(`missing tables: ${missing.join(", ")}`, "run: npm run db:migrate");
    else {
      ok(`all ${TABLES.length} tables present`);
      const [{ seeds }] = (await sql`select count(*)::int as seeds from channel_seeds`) as { seeds: number }[];
      const [{ creators }] = (await sql`select count(*)::int as creators from creators`) as { creators: number }[];
      if (!seeds) bad("no channels seeded yet", "run: npm run discover");
      else ok(`${seeds} seeded channels`);
      if (seeds && !creators) bad("no creators ingested yet", "trigger the ingest once (see README → Go live)");
      else if (creators) ok(`${creators} creators ingested — the app shows live data`);
    }
  } catch (e) {
    bad(`cannot connect: ${e instanceof Error ? e.message.split("\n")[0] : e}`, "re-copy DATABASE_URL (the pooled connection string, with sslmode=require)");
  }
}

console.log("\nYouTube Data API");
if (!YOUTUBE_API_KEY) bad("YOUTUBE_API_KEY is empty", "Google Cloud console → enable YouTube Data API v3 → Credentials → Create API key");
else {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&id=UC_x5XG1OV2P6uZZ5FSM9Ttw&key=${encodeURIComponent(YOUTUBE_API_KEY)}`);
  if (res.ok) ok("key valid and YouTube Data API v3 enabled (1 quota unit used)");
  else {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; errors?: { reason?: string }[] } };
    const reason = body.error?.errors?.[0]?.reason ?? String(res.status);
    const fix: Record<string, string> = {
      keyInvalid: "the key is wrong — copy it again from Credentials",
      accessNotConfigured: "enable “YouTube Data API v3” for this Google Cloud project (APIs & Services → Library)",
      forbidden: "the key's API restrictions block YouTube Data API v3 — allow it under the key's restrictions",
      quotaExceeded: "daily quota used up — wait until midnight Pacific time or request more quota",
    };
    bad(`YouTube rejected the key (${reason})`, fix[reason] ?? body.error?.message ?? "check the key in Google Cloud");
  }
}

console.log("\nCron");
if (!CRON_SECRET) bad("CRON_SECRET is empty", "set a long random string here and the same value in Vercel");
else if (CRON_SECRET.length < 32) bad("CRON_SECRET is short", "use at least 32 random characters");
else ok(`CRON_SECRET set (${CRON_SECRET.length} chars) — add the same value in Vercel`);

console.log(failures ? `\n${failures} thing(s) to fix.\n` : "\nAll set.\n");
process.exitCode = failures ? 1 : 0;
