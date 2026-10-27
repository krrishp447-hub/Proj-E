import { NextResponse } from "next/server";
import { SESSION_COOKIE, currentUser, endSessions, sameOrigin } from "@/server/auth";

// POST only, from ScoutBlack's own pages. Ends every session of the account (the cookie version stops matching).
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const user = await currentUser();
  if (user) await endSessions(user.id);
  const res = NextResponse.redirect(new URL("/", request.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
