import { currentUser } from "@/server/auth";
import { appAccess } from "@/server/billing";
import { DEMO_SOV, getShareOfVoice } from "@/server/sov";

// The demo's live share of voice (a fixed public brand set). Loaded when the tab opens: the first scan of the day is slow.
export async function GET() {
  if (!(await appAccess(await currentUser())).ok) return Response.json({ error: "plan" }, { status: 402 }); // part of the app
  const result = await getShareOfVoice(DEMO_SOV.brands, DEMO_SOV.category, 90);
  return Response.json({ title: DEMO_SOV.title, category: DEMO_SOV.category, result });
}
