"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAnimatedDialog } from "@/hooks/useAnimatedDialog";
import { clampIndex, nearestIndex } from "@/lib/carousel";

const niches = [
  { name: "TECH & AUDIO", slug: "tech", bg: "var(--signal)", desc: "TWS · EARBUDS · ANC · SMARTPHONE REVIEWERS" },
  { name: "FITNESS", slug: "fitness", bg: "var(--pop)", desc: "WORKOUT · NUTRITION · HOME & GYM · HIGH TRUST" },
  { name: "FINANCE", slug: "finance", bg: "var(--data)", desc: "INVESTING · MONEY · HIGH-INTENT AUDIENCE" },
  { name: "GAMING", slug: "gaming", bg: "var(--sun)", desc: "ESPORTS · SETUP · PERIPHERALS · YOUNG & FAST" },
  { name: "FASHION", slug: "fashion", bg: "var(--tang)", desc: "HAULS · GRWM · BEAUTY · GEN-Z REACH" },
];
// 6 s vertical loops rendered by launch-video (npm run niches && node scripts/render-niches.mjs).
const reel = (slug: string) => ({ src: `/video/niches/${slug}.mp4`, poster: `/video/niches/${slug}.jpg` });
const DRAG_THRESHOLD = 5;

export function FeatureCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const drag = useRef({ x: 0, left: 0, id: -1, moved: false });
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(0);
  const { ref: expandRef, shown: expandShown, open: openExpand, close: closeExpand, onCancel: onExpandCancel } = useAnimatedDialog(400);

  const syncActive = useCallback(() => {
    const t = track.current;
    if (!t) return;
    const cards = [...t.children] as HTMLElement[];
    setActive(nearestIndex(cards.map((c) => c.offsetLeft + c.clientWidth / 2), t.scrollLeft + t.clientWidth / 2));
  }, []);

  const scrollToCard = useCallback((i: number) => {
    const t = track.current;
    if (!t) return;
    const c = t.children[clampIndex(i, niches.length)] as HTMLElement;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    t.scrollTo({ left: c.offsetLeft - (t.clientWidth - c.clientWidth) / 2, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Debounced active-card detection while the track scrolls.
  useEffect(() => {
    const t = track.current;
    if (!t) return;
    let timer: number | undefined;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(syncActive, 60);
    };
    t.addEventListener("scroll", onScroll, { passive: true });
    syncActive();
    return () => {
      t.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [syncActive]);

  // Reels only download and play while on screen; posters stand in under reduced motion.
  useEffect(() => {
    const t = track.current;
    if (!t || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      }),
      { threshold: 0.5 },
    );
    t.querySelectorAll("video").forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, []);

  // Arrow keys step the deck while the section is on screen (and focus isn't in a form field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if ((e.target as HTMLElement).closest("input, textarea, select, dialog[open]")) return;
      const r = section.current?.getBoundingClientRect();
      if (!r || r.top >= window.innerHeight || r.bottom <= 0) return;
      scrollToCard(active + (e.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, scrollToCard]);

  // Mouse drag-to-scroll. Capture starts only past a small threshold so plain clicks still reach the cards;
  // touch keeps native scrolling.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    drag.current = { x: e.pageX, left: track.current?.scrollLeft ?? 0, id: e.pointerId, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const t = track.current;
    if (d.id !== e.pointerId || !t) return;
    const dx = e.pageX - d.x;
    if (!d.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      d.moved = true;
      t.setPointerCapture(e.pointerId);
      t.style.cursor = "grabbing";
      t.style.scrollSnapType = "none";
    }
    if (d.moved) t.scrollLeft = d.left - dx;
  };
  const onPointerUp = () => {
    const t = track.current;
    if (t && drag.current.moved) {
      t.style.cursor = "";
      t.style.scrollSnapType = "";
      syncActive();
    }
    drag.current.id = -1;
  };

  const onCardClick = (i: number) => {
    if (drag.current.moved) return void (drag.current.moved = false);
    if (i !== active) return scrollToCard(i);
    setExpanded(i);
    openExpand();
  };

  const current = niches[active];

  return (
    <section id="feature" ref={section} className="sec feature" data-io aria-roledescription="carousel" aria-label="Niches">
      <span className="plus c-tl text-paper" /><span className="plus c-br text-paper" />
      <div className="edge inner">
        <div className="mono mb-2.5 text-center text-signal">INDEX · 0{active + 1} / 0{niches.length}</div>
        <h2 className="disp huge fname">{current.name}</h2>
        <div
          ref={track}
          className="track"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {niches.map((n, i) => (
            <button
              key={n.name}
              type="button"
              className={`fcard ${i === active ? "active" : ""}`}
              aria-label={i === active ? `Expand ${n.name}` : `Show ${n.name}`}
              aria-current={i === active}
              onClick={() => onCardClick(i)}
            >
              <video className="fvid" {...reel(n.slug)} style={{ background: n.bg }} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} />
              <div className="brackets" aria-hidden="true"><i className="tl" /><i className="tr" /><i className="bl" /><i className="br" /></div>
            </button>
          ))}
        </div>
        <p className="desc min-h-5 text-center text-paper!" aria-live="polite">{current.desc}</p>
        <div className="fctrl">
          <button type="button" aria-label="Previous niche" onClick={() => scrollToCard(active - 1)}>←</button>
          <button type="button" aria-label="Next niche" onClick={() => scrollToCard(active + 1)}>→</button>
        </div>
      </div>

      <dialog
        ref={expandRef}
        className={`overlay z-90 ${expandShown ? "show" : ""}`}
        aria-label={niches[expanded].name}
        onCancel={onExpandCancel}
        onClick={(e) => e.target === e.currentTarget && closeExpand()}
      >
        <button className="close" type="button" onClick={closeExpand}>CLOSE ✕</button>
        {expandShown && (
          <video key={expanded} className="fvid-big" {...reel(niches[expanded].slug)} style={{ background: niches[expanded].bg }} muted loop playsInline autoPlay controls />
        )}
      </dialog>
    </section>
  );
}
