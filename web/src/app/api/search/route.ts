import { HOME_RESULTS, searchAll } from "@/lib/scout/search";
import { after } from "next/server";
import { currentUser } from "@/server/auth";
import { appAccess } from "@/server/billing";
import { getCreators } from "@/server/creators";
import { logUnread } from "@/server/unread";

// Creator search for /demo: ranks every creator on the server and returns only the best ~150, so the page never
// ships the full creator list (it was 3.3 MB). `ids`: shortlisted channels to score against this brief as well.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 300);
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter((id) => /^[\w-]{10,40}$/.test(id)).slice(0, 10);
  // `limit`: the homepage asks for its few rows only (no near misses)
  const limit = Math.min(100, Math.max(1, Math.floor(Number(url.searchParams.get("limit"))) || 100));
  // the homepage's few rows are public; full results (the app) need a plan, or the page gate means nothing
  if ((limit > HOME_RESULTS || ids.length) && !(await appAccess(await currentUser())).ok) return Response.json({ error: "plan" }, { status: 402 });
  const { creators } = await getCreators();
  const result = searchAll(creators, q, limit < 100 ? { limit, missLimit: 0 } : { pinned: ids });
  if (result.unread) after(() => logUnread(q));
  return Response.json(result);
}
