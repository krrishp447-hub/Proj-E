import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { runIngest } from "@/server/ingest";

// Called daily by Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
export const maxDuration = 300;

const matches = (given: string, expected: string) => {
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b); // constant-time: don't leak the secret via timing
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  if (!matches(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runIngest();
    revalidateTag("creators", "max"); // views pick up the fresh numbers
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Ingest failed" }, { status: 500 });
  }
}
