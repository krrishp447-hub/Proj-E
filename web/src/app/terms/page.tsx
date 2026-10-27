import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Terms — ScoutBlack", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="12 October 2026">
      <h2>The service</h2>
      <p>
        ScoutBlack helps brands and agencies find, rank and compare creators, and helps creators understand how brands find them.
        Match scores, authenticity estimates and audience-overlap figures are calculated signals to support your decisions —
        not guarantees of campaign results.
      </p>

      <h2>Demo data</h2>
      <p>
        Where the product is labelled &ldquo;Demo · illustrative data&rdquo;, creators and figures are fictional examples and must
        not be relied on.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don&apos;t scrape, resell or bulk-export ScoutBlack data, attempt to access other users&apos; accounts, or use ScoutBlack to harass
        creators. Contact creators only about genuine collaboration opportunities.
      </p>

      <h2>Third-party platforms</h2>
      <p>
        Features that use YouTube data are subject to the <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>.
        Platform data belongs to its respective owners.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${site.email}`}>{site.email}</a>.
      </p>
    </LegalPage>
  );
}
