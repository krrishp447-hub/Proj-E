import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authUrl, type Role } from "@/server/google";

// /api/auth/google/start?role=creator|brand → Google consent screen. The state cookie ties the callback to this browser (CSRF).
export async function GET(request: Request) {
  const role: Role = new URL(request.url).searchParams.get("role") === "creator" ? "creator" : "brand";
  const state = randomBytes(24).toString("base64url");
  let url: string;
  try {
    url = authUrl(role, state);
  } catch {
    return NextResponse.redirect(new URL("/login?error=config", request.url)); // GOOGLE_CLIENT_ID / SECRET not set
  }
  const res = NextResponse.redirect(url);
  res.cookies.set({
    name: "scout_oauth", value: `${state}.${role}`, httpOnly: true, sameSite: "lax",
    secure: process.env.NODE_ENV === "production", path: "/api/auth/google", maxAge: 600,
  });
  return res;
}
