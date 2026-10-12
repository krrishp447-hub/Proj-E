import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Privacy — Scout", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="12 October 2026">
      <h2>What this site collects</h2>
      <p>
        Browsing this website does not require an account, and we do not set advertising or analytics cookies. Our hosting
        provider keeps standard server logs (such as IP address and request time) for security and reliability.
      </p>

      <h2>Creator data we process</h2>
      <p>
        Scout ranks creators using <strong>publicly available channel data</strong> — for example subscriber counts, video
        views, likes and comments — obtained through official platform APIs, including the YouTube API Services. We use it to
        calculate signals such as engagement rate, posting consistency, growth and an estimated authenticity score.
      </p>
      <p>
        Audience demographics (age, gender, location) and other private analytics are only processed if a creator connects
        their own account and gives explicit consent. A creator can disconnect at any time, after which we delete the
        private data obtained through that connection.
      </p>

      <h2>YouTube API Services</h2>
      <p>
        Scout uses YouTube API Services. By using features that display YouTube data you agree to the{" "}
        <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>. YouTube data is also subject to the{" "}
        <a href="https://policies.google.com/privacy">Google Privacy Policy</a>. Connected creators can revoke Scout&apos;s
        access at any time from the <a href="https://security.google.com/settings/security/permissions">Google security settings page</a>.
      </p>

      <h2>Retention</h2>
      <p>
        Public channel statistics are refreshed daily and kept only while a channel is being tracked. Creators can ask us to
        stop tracking their channel and delete its stored data.
      </p>

      <h2>Your rights</h2>
      <p>
        Under India&apos;s Digital Personal Data Protection Act, 2023, you can ask to access, correct or erase personal data we
        hold about you, and withdraw consent you have given. Contact us at <a href={`mailto:${site.email}`}>{site.email}</a>.
      </p>
    </LegalPage>
  );
}
