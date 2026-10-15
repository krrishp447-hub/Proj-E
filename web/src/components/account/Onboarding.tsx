"use client";

import { BUDGETS, NICHES } from "@/lib/scout/data";
import { LANGUAGES } from "@/lib/scout/engine";
import { ChannelCard, type ChannelSummary } from "./Audience";
import { Stepper } from "./Stepper";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
type Action = (fd: FormData) => Promise<void>;

function Chips({ name, options, checked, label }: { name: string; options: readonly string[]; checked: string[]; label: string }) {
  return (
    <fieldset className="acct-chips" aria-label={label}>
      {options.map((o) => (
        <label key={o}><input type="checkbox" name={name} value={o} defaultChecked={checked.includes(o)} /> {o}</label>
      ))}
    </fieldset>
  );
}

export type CreatorDefaults = { focus: string[]; languages: string[]; rateVideo: number | null; rateShort: number | null; openToCollabs: boolean };

export function CreatorOnboarding({ action, channel, defaults, fair }: { action: Action; channel: ChannelSummary; defaults: CreatorDefaults; fair: { low: number; high: number } | null }) {
  return (
    <Stepper
      action={action}
      submitLabel="Finish setup"
      steps={[
        {
          title: "Your channel",
          body: (
            <>
              <ChannelCard c={channel} />
              <p className="acct-help">
                This is what brands see on your Scout profile. The audience section comes from YouTube Analytics and is marked
                verified; only you could have shared it.
              </p>
            </>
          ),
        },
        {
          title: "What you make",
          body: (
            <>
              <div className="acct-q">Content focus <span className="acct-help">Pick all that fit. Brands search by these.</span>
                <Chips name="focus" options={NICHES} checked={defaults.focus} label="Content focus" />
              </div>
              <div className="acct-q">Languages you create in
                <Chips name="languages" options={LANGUAGES} checked={defaults.languages} label="Languages" />
              </div>
            </>
          ),
        },
        {
          title: "Rates",
          body: (
            <>
              <p className="acct-help">
                {fair
                  ? `Market guide for your reach: ${inr(fair.low)}–${inr(fair.high)} per dedicated video (₹400–₹900 per 1,000 views, adjusted for engagement).`
                  : "Set what you usually charge. You can change it anytime."}{" "}
                Shown to brands as a starting point; every deal is still negotiated.
              </p>
              <div className="acct-row">
                <label>Per dedicated video (₹)<input type="number" name="rateVideo" min={0} step={500} inputMode="numeric" defaultValue={defaults.rateVideo ?? undefined} placeholder={fair ? String(fair.low) : "e.g. 40000"} /></label>
                <label>Per Short (₹)<input type="number" name="rateShort" min={0} step={500} inputMode="numeric" defaultValue={defaults.rateShort ?? undefined} placeholder="e.g. 15000" /></label>
              </div>
              <label className="acct-inline"><input type="checkbox" name="openToCollabs" defaultChecked={defaults.openToCollabs} /> Open to brand collaborations</label>
            </>
          ),
        },
      ]}
    />
  );
}

export type BrandDefaults = { company: string; kind: "brand" | "agency"; website: string | null; category: string | null; brief: string | null; budget: string | null; tracked: string[] };

export function BrandOnboarding({ action, defaults }: { action: Action; defaults: BrandDefaults }) {
  return (
    <Stepper
      action={action}
      submitLabel="Finish setup →"
      steps={[
        {
          title: "Company",
          body: (
            <>
              <label>Company name<input type="text" name="company" required maxLength={120} autoComplete="organization" defaultValue={defaults.company} /></label>
              <div className="acct-q">You are
                <fieldset className="acct-chips" aria-label="Company type">
                  <label><input type="radio" name="kind" value="brand" defaultChecked={defaults.kind !== "agency"} /> A brand</label>
                  <label><input type="radio" name="kind" value="agency" defaultChecked={defaults.kind === "agency"} /> An agency</label>
                </fieldset>
              </div>
              <div className="acct-row">
                <label>Website <span className="acct-help">Optional</span><input type="url" name="website" maxLength={300} placeholder="https://" defaultValue={defaults.website ?? ""} /></label>
                <label>Category
                  <select name="category" defaultValue={defaults.category ?? ""}>
                    <option value="">Choose…</option>
                    {[...NICHES, "Other"].map((n) => <option key={n}>{n}</option>)}
                  </select>
                </label>
              </div>
            </>
          ),
        },
        {
          title: "First brief",
          body: (
            <>
              <label>Who are you looking for?
                <span className="acct-help">Plain English: niche, language, size, platform. Scout turns it into filters.</span>
                <textarea name="brief" maxLength={300} defaultValue={defaults.brief ?? ""} placeholder="Hindi tech YouTubers reviewing earbuds, 100K–1M subs, strong engagement" />
              </label>
              <div className="acct-q">Typical campaign budget
                <fieldset className="acct-chips" aria-label="Budget">
                  {BUDGETS.map((b) => <label key={b}><input type="radio" name="budget" value={b} defaultChecked={defaults.budget === b} /> {b}</label>)}
                </fieldset>
              </div>
            </>
          ),
        },
        {
          title: "Track your brand",
          body: (
            <label>Brand names and hashtags to track
              <span className="acct-help">Comma-separated. Scout uses them for share of voice and to file creator posts into your campaigns. Common-word name? Add product names, and exclude phrases with a minus: “Noise, Noise Buds, -noise cancelling”.</span>
              <input type="text" name="tracked" maxLength={400} defaultValue={defaults.tracked.join(", ")} placeholder="Acme, Acme Buds, #AcmeSound" />
            </label>
          ),
        },
      ]}
    />
  );
}
