import { currentUser, sameOrigin } from "@/server/auth";
import { listMessages, sendMessage } from "@/server/messages";

// Deal chat. GET ?after=<id>: new messages (the drawer polls while open; reading marks the deal read).
// POST {"body": "..."}: send. Only the deal's two parties; same-origin only.
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const u = await currentUser();
  if (!u) return Response.json({ error: "signin" }, { status: 401 });
  const after = Math.max(0, Math.floor(Number(new URL(request.url).searchParams.get("after")) || 0));
  const messages = await listMessages(u, (await params).id, after);
  return messages ? Response.json({ messages }) : Response.json({ error: "not found" }, { status: 404 });
}

export async function POST(request: Request, { params }: Ctx) {
  if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const u = await currentUser();
  if (!u) return Response.json({ error: "signin" }, { status: 401 });
  const body = await request.json().catch(() => null) as { body?: unknown } | null;
  const r = await sendMessage(u, (await params).id, String(body?.body ?? ""));
  return "error" in r ? Response.json(r, { status: 400 }) : Response.json(r);
}
