export type SocialLink = { label: string; footerLabel?: string; href?: string };

export const site = {
  name: "Scout",
  title: "Scout — Creator Intelligence",
  description: "The creator intelligence layer for brands & agencies. Find the right creators, not more.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  // Placeholder from the original poster — replace with an address you own before launch.
  email: "hello@scout.io",
  address: "Koramangala, Bengaluru",
  coords: `12°56'04.9"N 77°37'17.8"E`,
  demoHref: "/demo",
  filmHref: "/film",
  // No real profile URLs yet; entries without an href render as plain text instead of dead links.
  social: [
    { label: "Instagram" },
    { label: "LinkedIn" },
    { label: "X", footerLabel: "X / Twitter" },
    { label: "YouTube" },
  ] as SocialLink[],
};
