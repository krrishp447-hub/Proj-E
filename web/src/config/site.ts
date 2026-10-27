export type SocialLink = { label: string; footerLabel?: string; href?: string };

export const site = {
  name: "ScoutBlack",
  title: "ScoutBlack — Creator Intelligence",
  description: "The creator intelligence layer for brands & agencies. Find the right creators, not more.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "hello@scoutblack.in",
  address: "Mumbai, India",
  coords: `19°04'33.6"N 72°52'39.7"E`, // central Mumbai
  demoHref: "/#product", // the homepage taste; the full app (/demo) needs a plan
  filmHref: "/film",
  // No real profile URLs yet; entries without an href render as plain text instead of dead links.
  // YouTube-first: other profiles come back when they exist.
  social: [{ label: "YouTube" }] as SocialLink[],
};
