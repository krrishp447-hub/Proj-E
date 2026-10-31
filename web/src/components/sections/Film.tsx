"use client";

import { useRef, useState } from "react";

// Scene starts in the explainer (explainer-video/src/timing.ts): each scene is its voice-over line + 0.5 s.
// The steps are the film's own scenes, so each one jumps the film to the moment it shows.
type Step = { n: string; at: number; title: string; text: string };
const CREATORS: Step[] = [
  { n: "01", at: 6.4, title: "Sign in with Google", text: "Sign in and claim your YouTube channel. Free for creators, always." },
  { n: "02", at: 12.3, title: "Prove it's yours", text: "Read-only YouTube access proves the channel is yours and brings in your verified audience: countries, age and gender." },
  { n: "03", at: 18.5, title: "Set up your profile", text: "Pick what you make, your languages and your rates, with a market guide for a channel your size." },
  { n: "04", at: 24.6, title: "Get found", text: "See your rank in your niche, the brand briefs you match, and the brands you can pitch." },
  { n: "05", at: 31.1, title: "Reply, counter, accept", text: "Offers land on your deal board. Reply, counter or accept, then run the deal through to paid." },
];
const BRANDS: Step[] = [
  { n: "06", at: 41.4, title: "Set up in minutes", text: "Sign in, add your company and a first brief. Every brand plan starts with a 4-day free trial." },
  { n: "07", at: 48.6, title: "Search in plain English", text: "Describe the campaign the way you'd say it. Creators are ranked on engagement, growth, reach, authenticity and track record, not follower count." },
  { n: "08", at: 59.5, title: "See why. Compare.", text: "Open any creator to see why they ranked. Shortlist up to four and compare them side by side, audience overlap included." },
  { n: "09", at: 66.6, title: "Send an offer", text: "Creators on ScoutBlack get your offer directly. Pick a template, set the fee against their market rate, send." },
  { n: "10", at: 73.1, title: "Run it end to end", text: "Track every deal from inbound to paid. Posts file into your campaigns automatically, and share of voice shows how you stack up." },
];
const ALL = [{ n: "00", at: 0, title: "", text: "" }, ...CREATORS, ...BRANDS];
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * The 88-second explainer with its steps for creators and for brands. Nothing downloads until someone presses play
 * (6 MB); it plays with sound and captions, and every step jumps the film to the moment it shows.
 */
export function FilmGuide() {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState(0);

  const play = (at?: number) => {
    const v = video.current;
    if (!v) return;
    if (at !== undefined) v.currentTime = at;
    setStarted(true);
    v.play().catch(() => {});
    if (at !== undefined) v.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const current = started ? ALL.reduce((c, s) => (now >= s.at ? s.n : c), "00") : null;

  const steps = (side: string, sub: string, list: Step[]) => (
    <div className="film-side">
      <div className="film-side-head"><h2 className="disp">{side}</h2><span className="mono">{sub}</span></div>
      <ol className="film-steps">
        {list.map((s) => (
          <li key={s.n}>
            <button type="button" className={current === s.n ? "is-on" : ""} onClick={() => play(s.at)}>
              <span className="film-step-n disp">{s.n}</span>
              <span className="film-step-body">
                <b>{s.title}</b>
                <span>{s.text}</span>
              </span>
              <span className="film-step-t mono">▶ {clock(s.at)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <>
      <figure className="film-frame">
        <video
          ref={video}
          src="/video/scoutblack-explainer.mp4"
          poster="/video/scoutblack-explainer-poster.jpg"
          preload="none"
          playsInline
          controls={started}
          onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
          onPlay={() => setStarted(true)}
          aria-label="ScoutBlack explainer film, 1 minute 28 seconds, with voice-over"
        >
          <track kind="captions" srcLang="en" label="English" src="/video/scoutblack-explainer.en.vtt" default />
        </video>
        {!started && (
          <button type="button" className="film-play" onClick={() => play()} aria-label="Play the film with sound">
            <span className="film-play-dot" aria-hidden="true">▶</span>
            <span className="disp">Watch the film</span>
            <span className="mono">1:28 · sound on · captions</span>
          </button>
        )}
      </figure>

      <div className="film-guide">
        {steps("For creators", "Free, always", CREATORS)}
        {steps("For brands & agencies", "4-day free trial", BRANDS)}
      </div>
    </>
  );
}
