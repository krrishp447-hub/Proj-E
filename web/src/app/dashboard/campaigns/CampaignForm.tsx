import type { TrackingRules } from "@/lib/scout/campaigns";
import { saveCampaignForm } from "./actions";

type Defaults = { id: string; name: string; start: string; end: string; rules: TrackingRules };

/** Name, dates and tracking rules: how ScoutBlack recognises this campaign's posts in creators' uploads. */
export function CampaignForm({ c }: { c?: Defaults }) {
  const today = new Date().toISOString().slice(0, 10);
  const join = (xs?: string[]) => (xs ?? []).join(", ");
  return (
    <form action={saveCampaignForm.bind(null, c?.id ?? null)} className="acct-form">
      <label>Campaign name<input name="name" required maxLength={120} defaultValue={c?.name} placeholder="Diwali launch: Buds X" /></label>
      <div className="acct-row">
        <label>Starts<input type="date" name="start" required defaultValue={c?.start ?? today} /></label>
        <label>Ends<input type="date" name="end" required defaultValue={c?.end} /></label>
      </div>
      <p className="acct-help">How ScoutBlack spots this campaign&apos;s posts (comma-separated). A tracking link or hashtag is strongest; a keyword alone needs review.</p>
      <div className="acct-row">
        <label>Hashtags<input name="hashtags" defaultValue={join(c?.rules.hashtags)} placeholder="#BudsXLaunch" /></label>
        <label>Tracking links<input name="links" defaultValue={join(c?.rules.links)} placeholder="yourbrand.com/buds-x" /></label>
      </div>
      <div className="acct-row">
        <label>@mentions<input name="mentions" defaultValue={join(c?.rules.mentions)} placeholder="@yourbrand" /></label>
        <label>Keywords<input name="keywords" defaultValue={join(c?.rules.keywords)} placeholder="Buds X" /></label>
      </div>
      <button type="submit" className="acct-btn on-ink">{c ? "Save changes" : "Create campaign"}</button>
    </form>
  );
}
