import { currentUser } from "@/server/auth";
import { appAccess } from "@/server/billing";
import { listCampaigns } from "@/server/brand-campaigns";

// The app's Campaigns tab: the signed-in brand's campaigns (part of a plan, like the rest of the app).
export async function GET() {
  const u = await currentUser();
  if (!(await appAccess(u)).ok || !u) return Response.json({ error: "plan" }, { status: 402 });
  return Response.json({ campaigns: await listCampaigns(u) });
}
