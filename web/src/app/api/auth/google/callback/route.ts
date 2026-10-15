import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { signIn } from "@/server/accounts";
import { sessionCookie, sessionValue } from "@/server/auth";
import type { Role } from "@/server/google";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const back = (path: string) => {
    const res = NextResponse.redirect(new URL(path, url.origin));
    res.cookies.delete({ name: "scout_oauth", path: "/api/auth/google" });
    return res;
  };
  const [state, role] = (request.cookies.get("scout_oauth")?.value ?? "").split(".");
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error")) return back(`/login?error=denied`); // user cancelled on Google
  if (!state || !code || !same(state, url.searchParams.get("state") ?? "")) return back("/login?error=expired");

  try {
    const result = await signIn(code, role === "creator" ? "creator" : ("brand" as Role));
    if (result.error) return back(`/login?error=${result.error}`);
    if (role === "creator") revalidateTag("creators", "max"); // brands see the verified audience
    const res = back("/dashboard"); // the dashboard sends new accounts on to /onboarding
    res.cookies.set(sessionCookie(sessionValue(result.userId)));
    return res;
  } catch (e) {
    console.error("sign-in failed", e instanceof Error ? e.message : e);
    return back("/login?error=failed");
  }
}
