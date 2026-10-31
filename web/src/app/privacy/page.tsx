import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Privacy — ScoutBlack", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="31 October 2026">
      <h2>What this site collects</h2>
      <p>
        Browsing this website does not require an account, and we do not set advertising or analytics cookies. Our hosting
        provider keeps standard server logs (such as IP address and request time) for security and reliability.
      </p>

      <h2>Creator data we process</h2>
      <p>
        ScoutBlack ranks creators using <strong>publicly available channel data</strong> — for example subscriber counts, video
        views, likes and comments — obtained through official platform APIs, including the YouTube API Services. We use it to
        calculate signals such as engagement rate, posting consistency, growth and an estimated authenticity score. From
        the same public data we also note how much of a channel is Shorts (from video length) and which cities a channel
        names in its own description and titles; these are shown to brands as inferences, not facts about the creator.
      </p>
      <p>
        Audience demographics (age, gender, and location down to the top cities) and other private analytics are only
        processed if a creator connects their own account and gives explicit consent. A creator can disconnect at any time,
        after which we delete the private data obtained through that connection.
      </p>
      <p>
        Creators who set up a profile can choose to tell us where they&apos;re based. It is optional, shown to brands on
        ScoutBlack, and can be changed or removed from the profile at any time.
      </p>

      <p>
        If a creator wrote a business email in their own channel or video description, ScoutBlack may show it to signed-in brand
        accounts, one channel at a time and labelled as coming from the public description. It never appears in public
        search results or exports, and it is not shown once the creator manages contact on ScoutBlack. When a brand invites a
        channel that isn&apos;t on ScoutBlack, we may email that address once to say a brand wants to work with them. Every email
        has an unsubscribe link, and creators can ask us to stop showing their email on the{" "}
        <a href="/contact-removal">Remove my contact</a> page.
      </p>

      <h2>YouTube API Services</h2>
      <p>
        ScoutBlack uses YouTube API Services. By using features that display YouTube data you agree to the{" "}
        <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>. YouTube data is also subject to the{" "}
        <a href="https://policies.google.com/privacy">Google Privacy Policy</a>. Connected creators can revoke ScoutBlack&apos;s
        access at any time from the <a href="https://security.google.com/settings/security/permissions">Google security settings page</a>.
      </p>
      <p>
        ScoutBlack&apos;s use of information received from Google APIs will adhere to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>,
        including the Limited Use requirements.
      </p>

      <h2>Retention</h2>
      <p>
        Public channel statistics are refreshed every few days (within the 30 days YouTube allows) and kept only while a channel is being tracked. Creators can ask us to
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
