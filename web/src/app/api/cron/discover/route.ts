import { rejectUnlessCron } from "@/server/cron";
import { runDiscovery } from "@/server/discover";

// Called daily by Vercel Cron before the ingest passes (see vercel.json): adds new seed channels,
// which the ingest then fetches. No revalidation here: nothing visible changes until the ingest runs.
export const maxDuration = 300;

export async function GET(request: Request) {
  const rejected = rejectUnlessCron(request);
  if (rejected) return rejected;
  try {
    return Response.json(await runDiscovery());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Discovery failed" }, { status: 500 });
  }
}
