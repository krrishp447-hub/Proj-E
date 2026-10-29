"use client";

import { useRef, useState } from "react";
import { site } from "@/config/site";

// Scene starts in the explainer (explainer-video/src/timing.ts): each scene is its voice-over line + 0.5 s.
const CHAPTERS = [
  { at: 0, label: "The 500-tab problem" },
  { at: 6.4, label: "For creators" },
  { at: 38.3, label: "For brands" },
  { at: 48.6, label: "Search in plain English" },
  { at: 66.6, label: "Offer to paid" },
];
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * The 88-second explainer: both sides of ScoutBlack, start to finish. Nothing downloads until someone presses play
 * (6 MB); it plays with sound and captions, and the chapters jump straight to a part of the story.
 */
export function Film() {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState(0);

  const play = (at?: number) => {
    const v = video.current;
    if (!v) return;
    if (at !== undefined) v.currentTime = at;
    setStarted(true);
    v.play().catch(() => {});
  };
  const current = CHAPTERS.reduce((c, ch, i) => (now >= ch.at ? i : c), 0);

  return (
    <section id="film" className="sec film" data-io>
      <span className="plus c-tl" /><span className="plus c-br" />
      <div className="edge">
        <div className="film-head">
          <div className="mono film-kick">THE FILM · 1:28</div>
          <h2 className="disp big">500 TABS,<br />OR <em className="hl">88 SECONDS.</em></h2>
          <p className="film-lede">
            One film, both sides of ScoutBlack. A creator claims their channel. A brand describes a campaign in plain
            English and gets the right ten. Then the deal runs from offer to paid, with every post filed for them.
          </p>
        </div>

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

        <ol className="film-chapters" aria-label="Chapters">
          {CHAPTERS.map((c, i) => (
            <li key={c.at}>
              <button type="button" className={started && i === current ? "is-on" : ""} onClick={() => play(c.at)}>
                <span className="mono">{clock(c.at)}</span>{c.label}
              </button>
            </li>
          ))}
        </ol>

        <div className="btnrow film-cta">
          <a className="pbtn" href={site.demoHref}>Try it free →</a>
          <a className="pbtn ghost" href="/pricing">See pricing</a>
        </div>
      </div>
    </section>
  );
}
