import { searchAll } from "@/lib/scout/search";
import { after } from "next/server";
import { getCreators } from "@/server/creators";
import { logUnread } from "@/server/unread";

// Creator search for /demo: ranks every creator on the server and returns only the best ~150, so the page never
// ships the full creator list (it was 3.3 MB). `ids`: shortlisted channels to score against this brief as well.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 300);
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter((id) => /^[\w-]{10,40}$/.test(id)).slice(0, 10);
  const { creators } = await getCreators();
  const result = searchAll(creators, q, { pinned: ids });
  if (result.unread) after(() => logUnread(q));
  return Response.json(result);
}
