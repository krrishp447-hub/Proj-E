import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { deleteAccount } from "@/server/accounts";
import { SESSION_COOKIE, currentUser } from "@/server/auth";

// Deletes the account, its profile and any connected-channel data (DPDP Act erasure). SameSite=Lax blocks cross-site POSTs.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), 303);
  await deleteAccount(user.id);
  revalidateTag("creators", "max");
  const res = NextResponse.redirect(new URL("/?deleted=1", request.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
