"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Muted, looping showreel of the launch film. It only downloads and plays while on screen,
 * and doesn't autoplay under prefers-reduced-motion.
 * "Sound on" restarts it with audio and native controls.
 */
export function Showreel() {
  const video = useRef<HTMLVideoElement>(null);
  const [withSound, setWithSound] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(reduce);
    if (reduce) return;
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()),
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const soundOn = () => {
    const v = video.current;
    if (!v) return;
    v.muted = false;
    v.loop = false;
    v.currentTime = 0;
    setWithSound(true);
    v.play().catch(() => {});
  };

  return (
    <figure className="reel">
      <video
        ref={video}
        src="/video/scout-launch.mp4"
        poster="/video/scout-launch-poster.jpg"
        muted={!withSound}
        loop={!withSound}
        playsInline
        preload="none"
        controls={withSound || reduced}
        aria-label="Scout launch film"
      />
      {!withSound && !reduced && (
        <button type="button" className="chip reel-sound" onClick={soundOn}>
          ▶ Sound on
        </button>
      )}
      <figcaption className="mono">Showreel · 0:24</figcaption>
    </figure>
  );
}
