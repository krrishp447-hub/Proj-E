import { revalidateTag } from "next/cache";
import { syncAudiences } from "@/server/accounts";
import { runAudits } from "@/server/audit";
import { sql } from "@/server/db";
import { rejectUnlessCron } from "@/server/cron";
import { runIngest } from "@/server/ingest";

// Called by Vercel Cron several times a night (see vercel.json): each pass refreshes up to 1,000 of the
// stalest channels, so passes after the first only pick up what earlier ones didn't reach.
export const maxDuration = 300;

export async function GET(request: Request) {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;
  try {
    const result = await runIngest();
    const audiences = await syncAudiences(); // connected creators' private audience (YouTube Analytics quota, not Data API)
    // every 100 new creators: segregation + calculation checks, recorded in quality_audits (npm run quality)
    const audits = sql ? await runAudits(sql) : [];
    revalidateTag("creators", "max"); // views pick up the fresh numbers
    return Response.json({ ...result, audiences, audits: audits.map((a) => ({ creators: `${a.from + 1}–${a.to}`, passed: a.passed, failed: a.checks.filter((c) => !c.passed).map((c) => c.name) })) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Ingest failed" }, { status: 500 });
  }
}
