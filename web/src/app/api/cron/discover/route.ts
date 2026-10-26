import { rejectUnlessCron } from "@/server/cron";
import { runDiscovery } from "@/server/discover";
import { heartbeat } from "@/server/heartbeat";

// Called daily by Vercel Cron before the ingest passes (see vercel.json): adds new seed channels,
// which the ingest then fetches. No revalidation here: nothing visible changes until the ingest runs.
export const maxDuration = 300;

export async function GET(request: Request) {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;
  try {
    return Response.json(await runDiscovery());
  } catch (e) {
    const error = e instanceof Error ? e.message : "Discovery failed";
    await heartbeat(false, `nightly discovery crashed: ${error}`); // successes are reported by the ingest passes
    return Response.json({ error }, { status: 500 });
  }
}
