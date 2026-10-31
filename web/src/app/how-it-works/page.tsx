import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteNav } from "@/components/layout/SiteNav";
import { FilmGuide } from "@/components/sections/Film";

export const metadata: Metadata = {
  title: "How it works — ScoutBlack",
  description: "See ScoutBlack in 88 seconds: creators claim their channel and get found; brands search in plain English, compare, send offers and run every deal to paid.",
  alternates: { canonical: "/how-it-works" },
  openGraph: { images: ["/video/scoutblack-explainer-poster.jpg"] },
};

export default function HowItWorksPage() {
  return (
    <>
      <SiteNav />
      <main>
        <section className="sec film film-page">
          <span className="plus c-tl" /><span className="plus c-br" />
          <div className="edge">
            <div className="film-head">
              <div className="mono film-kick">HOW IT WORKS · THE FILM · 1:28</div>
              <h1 className="disp big">500 TABS,<br />OR <em className="hl">88 SECONDS.</em></h1>
              <p className="film-lede">
                One film, both sides of ScoutBlack. A creator claims their channel. A brand describes a campaign in plain
                English and gets the right ten. Then the deal runs from offer to paid, with every post filed for them.
                Press any step below to jump straight to it.
              </p>
            </div>
            <FilmGuide />
            <div className="film-end">
              <p className="disp">Ready when you are.</p>
              <div className="btnrow">
                <a className="pbtn" href="/api/auth/google/start?role=brand">Start 4-day free trial →</a>
                <a className="pbtn ghost" href="/api/auth/google/start?role=creator">I&apos;m a creator: claim my channel</a>
                <a className="pbtn ghost" href="/pricing">See pricing</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
