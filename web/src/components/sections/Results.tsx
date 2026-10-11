import { site } from "@/config/site";

const shortlist = [
  { lab: "YT · INDIA · TECH", name: "Tech With Arjun", match: 95, subs: 312 },
  { lab: "YT · INDIA · AUDIO", name: "EarbudExpert", match: 91, subs: 132 },
  { lab: "YT · INDIA · TECH", name: "GadgetGirl Priya", match: 87, subs: 189 },
  { lab: "YT · TAMIL · TWS", name: "Kiran Tech Tamil", match: 84, subs: 98 },
  { lab: "IG · INDIA · TECH", name: "Neha Unboxed", match: 82, subs: 240 },
  { lab: "YT · INDIA · AUDIO", name: "AudioPhile Akash", match: 80, subs: 74 },
  { lab: "YT · US · ANC", name: "TechSavvy Sam", match: 74, subs: 275 },
  { lab: "YT · INDIA · BUDGET", name: "Rohit Reviews", match: 71, subs: 468 },
  { lab: "YT · INDIA · DEV", name: "Dev Codes", match: 68, subs: 410 },
];

export function Listing() {
  return (
    <section id="listing" className="sec listing wipe" data-io>
      <div className="edge">
        <div className="mono mb-[26px]">RESULTS · THE SHORTLIST</div>
        <h2 className="disp huge rev mb-[50px]">FROM 500<br />TO 10.</h2>
        <div className="lgrid">
          {shortlist.map((c) => (
            <div key={c.name} className="lcell">
              <div className="lab" data-type={c.lab}>{c.lab}</div>
              <h3 className="lname">{c.name}</h3>
              <div className="met">
                <span data-count={c.match}>{c.match}</span> MATCH · <span data-count={c.subs} data-suf="K">{c.subs}K</span> SUBS
              </div>
            </div>
          ))}
        </div>
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
