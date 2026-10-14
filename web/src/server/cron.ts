import "server-only";
import { timingSafeEqual } from "node:crypto";

const matches = (given: string, expected: string) => {
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b); // constant-time: don't leak the secret via timing
};

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Returns an error response, or null when authorized. */
export function rejectUnlessCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  if (!matches(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}
