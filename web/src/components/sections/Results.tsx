import { site } from "@/config/site";
import { ResultsFunnel } from "./ResultsFunnel";
import { getCreators } from "@/server/creators";

export async function Listing() {
  const { creators } = await getCreators();
  return (
    <section id="listing" className="sec listing wipe" data-io>
      <div className="edge">
        <div className="mono mb-[26px]">RESULTS · THE SHORTLIST</div>
        <h2 className="disp huge rev mb-[50px]">FROM 500<br />TO 10.</h2>
        <ResultsFunnel creators={creators} />
      </div>
    </section>
  );
}

const brands = ["boAt", "Noise", "realme", "Nothing", "Zerodha", "Myntra", "Soundcore"];

export function Proof() {
  const row = (hidden: boolean) =>
    brands.flatMap((b) => [
      <span key={`${hidden}-${b}`} aria-hidden={hidden || undefined}>{b}</span>,
      <span key={`${hidden}-${b}-dot`} aria-hidden="true">·</span>,
    ]);
  return (
    <div className="proof">
      <div className="mono mb-[18px] text-center opacity-60">BRANDS IN THE DEMO DATASET · NOT CUSTOMERS OR ENDORSEMENTS</div>
      <div className="mq">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

export function Closing() {
  return (
    <section className="sec closing" data-io>
      <span className="plus c-tl" /><span className="plus c-tr" /><span className="plus c-bl" /><span className="plus c-br" />
      <div className="edge w-full">
        <h2 className="disp huge" data-scrub>
          <span className="ln">FROM BRIEF</span>
          <span className="ln">TO SHORTLIST</span>
          <span className="ln">IN MINUTES.</span>
        </h2>
        <div className="btnrow mt-11">
          <a className="pbtn" href={site.demoHref}>Launch the demo →</a>
          <a className="pbtn ghost" href={`mailto:${site.email}`}>Book a walkthrough</a>
        </div>
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="sec ctaband wipe" data-io>
      <span className="plus c-tl" /><span className="plus c-tr" /><span className="plus c-bl" /><span className="plus c-br" />
      <div className="edge">
        <div className="mono mb-6">GET STARTED</div>
        <h2 className="disp big rev">STOP OPENING<br />500 TABS.</h2>
        {/* text-ink instead of the original earth tone: earth on signal blue fails WCAG AA contrast */}
        <p className="desc rev mx-auto mt-5 max-w-[40ch] text-ink!" style={{ "--d": ".1s" } as React.CSSProperties}>
          THE RIGHT CREATORS FOR YOUR NEXT CAMPAIGN — RANKED, VERIFIED, SHORTLISTED IN MINUTES.
        </p>
        <div className="btnrow rev" style={{ "--d": ".2s" } as React.CSSProperties}>
          <a className="pbtn dark" href={site.demoHref}>Try Scout free →</a>
          <a className="pbtn outline-ink" href={`mailto:${site.email}`}>Talk to us</a>
        </div>
      </div>
    </section>
  );
}
