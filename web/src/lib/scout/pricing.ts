// Plans and the value calculator, shared by the pricing page. Stance (DECISIONS.md §4): creators are never charged to be
// found; brands pay for seats, data depth and outreach, never per search; a take-rate only once on-platform closing exists.

export type Feature = { text: string; soon?: boolean };
export type Plan = { id: string; name: string; monthly: number | null; blurb: string; cta: { label: string; href: string }; features: Feature[]; featured?: boolean };

export const ANNUAL_DISCOUNT = 0.2;

export const CREATOR_PLANS: Plan[] = [
  {
    id: "creator-free", name: "Creator", monthly: 0, blurb: "Be found by brands. Free forever: we never charge to be listed.",
    cta: { label: "Claim your channel", href: "/api/auth/google/start?role=creator" }, // straight to creator sign-in (YouTube access)
    features: [
      { text: "Listed and ranked in brand searches" },
      { text: "Verified audience from YouTube Analytics" },
      { text: "Receive brand offers, counter and accept" },
      { text: "Deal board with checklists and due dates" },
      { text: "Pitch brands whose brief you match" },
      { text: "Market-rate guide for your reach" },
    ],
  },
  {
    id: "creator-pro", name: "Creator Pro", monthly: 499, blurb: "For creators running brand deals as a business.",
    cta: { label: "Start free, upgrade later", href: "/api/auth/google/start?role=creator" }, // Pro isn't live: everyone starts on Free
    features: [
      { text: "Everything in Creator" },
      { text: "Who viewed and shortlisted you", soon: true },
      { text: "Rate benchmarks by niche, size and language", soon: true },
      { text: "Direct brand chat", soon: true },
      { text: "Media kit link with live, verified stats", soon: true },
    ],
  },
];

export const BRAND_PLANS: Plan[] = [
  {
    id: "starter", name: "Starter", monthly: 25_000, blurb: "For a brand running its first creator campaigns.",
    cta: { label: "Start free trial", href: "/api/auth/google/start?role=brand" },
    features: [
      { text: "2 seats" },
      { text: "Unlimited search, shortlists and compare" },
      { text: "Brand mention tracking (5 terms)" },
      { text: "25 creator offers a month" },
      { text: "Deal board with offer history" },
    ],
  },
  {
    id: "growth", name: "Growth", monthly: 60_000, blurb: "For teams running campaigns every month.", featured: true,
    cta: { label: "Start free trial", href: "/api/auth/google/start?role=brand" },
    features: [
      { text: "5 seats" },
      { text: "Everything in Starter, unlimited offers" },
      { text: "Campaign auto-filing and deliverable tracking" },
      { text: "Share of voice vs up to 5 competitors" },
      { text: "Shortlist and report exports", soon: true },
    ],
  },
  {
    id: "agency", name: "Agency", monthly: null, blurb: "For agencies and large brands managing many clients. From ₹1.5L a month; we set up your team after sign-up.",
    cta: { label: "Start free trial", href: "/api/auth/google/start?role=brand" },
    features: [
      { text: "15+ seats, multiple brands and clients" },
      { text: "Everything in Growth" },
      { text: "API and bulk data access", soon: true },
      { text: "Dedicated success manager" },
    ],
  },
];

/** Displayed monthly price: exact when billed monthly; yearly gets the discount, rounded to ₹100 for brand plans, ₹1 for small ones. */
export function priceFor(monthly: number, annual: boolean) {
  if (!annual) return monthly;
  const x = monthly * (1 - ANNUAL_DISCOUNT);
  return x >= 10_000 ? Math.round(x / 100) * 100 : Math.round(x);
}

/**
 * What manual shortlisting costs a month: hours spent finding, vetting and checking creators by hand, minus the
 * minutes ScoutBlack takes. Assumptions are shown on the page and adjustable.
 */
export function manualCost(shortlistsPerMonth: number, hoursPerShortlist: number, hourlyCost: number, scoutHours = 0.5) {
  const hoursSaved = Math.max(0, shortlistsPerMonth * (hoursPerShortlist - scoutHours));
  return { hoursSaved, rupees: Math.round(hoursSaved * hourlyCost) };
}
