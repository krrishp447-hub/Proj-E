import { currentUser, sameOrigin } from "@/server/auth";
import { appAccess } from "@/server/billing";
import { inviteCreator } from "@/server/contact";

// "Invite to ScoutBlack": brands (with a plan) invite a creator who hasn't claimed their channel, so they can be sent offers.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const u = await currentUser();
  if (!u || u.role !== "brand") return Response.json({ result: "signin" }, { status: 401 });
  if (!(await appAccess(u)).ok) return Response.json({ result: "plan" }, { status: 402 });
  const body = (await request.json().catch(() => null)) as { channel?: unknown } | null;
  const channel = String(body?.channel ?? "");
  if (!/^[\w-]{10,40}$/.test(channel)) return Response.json({ result: "unavailable" }, { status: 400 });
  return Response.json({ result: await inviteCreator(channel, u.id) });
}
