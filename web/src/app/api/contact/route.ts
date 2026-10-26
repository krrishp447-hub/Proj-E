import { currentUser, sameOrigin } from "@/server/auth";
import { appAccess } from "@/server/billing";
import { revealContact, REVEALS_PER_DAY } from "@/server/contact";

// A creator's public business email, for signed-in brands only (never in search results, the public demo, or exports).
export async function GET(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const u = await currentUser();
  if (!u || u.role !== "brand" || !u.onboarded) return Response.json({ error: "signin" }, { status: 401 });
  if (!(await appAccess(u)).ok) return Response.json({ error: "plan" }, { status: 402 });
  const channel = new URL(request.url).searchParams.get("channel") ?? "";
  if (!/^[\w-]{10,40}$/.test(channel)) return Response.json({ error: "none" }, { status: 400 });
  const r = await revealContact(u, channel);
  if ("email" in r) return Response.json({ email: r.email, source: "From the channel's public description" });
  return Response.json({ ...r, limit: REVEALS_PER_DAY }, { status: r.error === "limit" ? 429 : 404 });
}
