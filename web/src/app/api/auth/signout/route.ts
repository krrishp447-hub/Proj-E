import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/server/auth";

// POST only (a form button): a GET sign-out link could be triggered by any page. 303 → the browser follows with GET.
export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/", request.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
