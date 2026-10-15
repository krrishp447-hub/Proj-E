import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { disconnectChannel } from "@/server/accounts";
import { currentUser } from "@/server/auth";

// Revokes Scout's YouTube access and deletes the private audience data. The session cookie is SameSite=Lax, so a
// cross-site form POST arrives without it and is rejected here.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), 303);
  await disconnectChannel(user.id);
  revalidateTag("creators", "max");
  return NextResponse.redirect(new URL("/account?done=disconnected", request.url), 303);
}
