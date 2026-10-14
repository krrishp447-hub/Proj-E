import { revalidateTag } from "next/cache";
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
    revalidateTag("creators", "max"); // views pick up the fresh numbers
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Ingest failed" }, { status: 500 });
  }
}
