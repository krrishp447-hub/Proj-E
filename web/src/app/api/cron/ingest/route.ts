import { revalidateTag } from "next/cache";
import { syncAudiences } from "@/server/accounts";
import { freshnessCheck, runAudits } from "@/server/audit";
import { sql } from "@/server/db";
import { rejectUnlessCron } from "@/server/cron";
import { checkDeliverables } from "@/server/delivery";
import { DB_WARN_BYTES, heartbeat } from "@/server/heartbeat";
import { runIngest } from "@/server/ingest";

// Called by Vercel Cron several times a night (see vercel.json): each pass refreshes up to 1,000 of the
// stalest channels, so passes after the first only pick up what earlier ones didn't reach.
export const maxDuration = 300;

export async function GET(request: Request) {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;
  try {
    const result = await runIngest();
    const delivery = await checkDeliverables(); // submitted links YouTube can now see; live deliverable videos' stats
    const audiences = await syncAudiences(); // connected creators' private audience (YouTube Analytics quota, not Data API)
    // every 100 new creators: segregation + calculation checks, recorded in quality_audits (npm run quality)
    const audits = sql ? await runAudits(sql) : [];
    const fresh = sql ? await freshnessCheck(sql) : null; // the 30-day API data rule
    const [{ bytes }] = sql ? ((await sql`select pg_database_size(current_database())::bigint as bytes`) as { bytes: string }[]) : [{ bytes: "0" }];
    revalidateTag("creators", "max"); // views pick up the fresh numbers

    // Owner alerts (heartbeat): anything here needs a human; a quota cut-off doesn't (the next pass resumes)
    const problems = [
      ...audits.filter((a) => !a.passed).map((a) => `quality audit failed for creators ${a.from + 1}–${a.to}: ${a.checks.filter((c) => !c.passed).map((c) => c.name).join(", ")}`),
      ...(fresh && !fresh.passed ? [`30-day rule: ${fresh.summary}`] : []),
      ...(Number(bytes) > DB_WARN_BYTES ? [`database is ${Math.round(Number(bytes) / 1048576)} MB of the free 512 MB`] : []),
      ...(result.failed.length > 50 ? [`${result.failed.length} channels failed to refresh, e.g. ${result.failed[0].error}`] : []),
    ];
    const summary = `${result.updated} refreshed · ${result.frozen?.refreshed ?? 0} frozen refreshed · ${result.quotaUnits} quota units · db ${Math.round(Number(bytes) / 1048576)} MB · ${fresh?.summary ?? ""}`;
    await heartbeat(!problems.length, problems.length ? `${problems.join("\n")}\n\n${summary}` : summary);

    return Response.json({ ...result, delivery, audiences, freshness: fresh?.summary ?? null, problems, audits: audits.map((a) => ({ creators: `${a.from + 1}–${a.to}`, passed: a.passed, failed: a.checks.filter((c) => !c.passed).map((c) => c.name) })) });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Ingest failed";
    await heartbeat(false, `nightly ingest crashed: ${error}`);
    return Response.json({ error }, { status: 500 });
  }
}
