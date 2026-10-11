"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Lenis inertia scrolling, driven by GSAP's ticker so there is a single animation loop and
 * ScrollTrigger reads the smoothed position. Skipped for reduced motion; touch keeps native scrolling.
 */
function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      lerp: 0.1,
      anchors: true, // in-page links glide too
      allowNestedScroll: true, // the niche carousel keeps its own horizontal scroll
      prevent: (node) => !!node.closest("dialog[open]"), // menu / overlays scroll natively
    });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
}

/**
 * One client island that drives all scroll motion for the server-rendered sections inside it.
 * Markup opts in with data attributes:
 *   data-io     → gets class "in" once it scrolls into view (CSS owns the reveal transitions)
 *   data-scrub  → its .ln lines slide in from alternating sides, scrubbed to scroll; settled by the time
 *                 the heading reaches the upper part of the viewport, so it never rests off-gutter
 *   data-par    → parallax factor for collage cards
 *   data-count  → number counts up on reveal (data-suf = suffix)
 *   data-type   → text types out on reveal
 * Server-rendered text holds the final values, so no-JS visitors and crawlers see real content.
 */
export function ScrollEffects({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useSmoothScroll();

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Park animated text at its start state; real values stay in data attributes.
      if (!reduce) {
        q<HTMLElement>("[data-count]").forEach((el) => (el.textContent = "0"));
        q<HTMLElement>("[data-type]").forEach((el) => (el.textContent = ""));
      }

      const reveal = (scope: Element) => {
        if (scope.classList.contains("in")) return;
        scope.classList.add("in");

        scope.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
          const to = Number(el.dataset.count);
          const suf = el.dataset.suf ?? "";
          if (reduce) return void (el.textContent = to + suf);
          const n = { v: 0 };
          gsap.to(n, {
            v: to,
            duration: 0.9,
            ease: "power3.out",
            onUpdate: () => void (el.textContent = String(Math.round(n.v))),
            onComplete: () => void (el.textContent = to + suf),
          });
        });

        scope.querySelectorAll<HTMLElement>("[data-type]").forEach((el) => {
          const txt = el.dataset.type ?? "";
          if (reduce) return void (el.textContent = txt);
          const n = { i: 0 };
          gsap.to(n, {
            i: txt.length,
            duration: txt.length * 0.02,
            ease: "none",
            onUpdate: () => void (el.textContent = txt.slice(0, Math.round(n.i))),
          });
        });
      };

      // Geometry-based on purpose: .wipe sections start fully clipped (clip-path), and IntersectionObserver
      // reports a fully clipped element as never visible, so it would never reveal them.
      q("[data-io]").forEach((el) => {
        ScrollTrigger.create({ trigger: el, start: "top 85%", once: true, onEnter: () => reveal(el) });
      });

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        q("[data-scrub]").forEach((head) => {
          head.querySelectorAll(".ln").forEach((ln, i) => {
            const dir = i % 2 ? -1 : 1;
            gsap.fromTo(
              ln,
              { x: () => dir * window.innerWidth * 0.12 },
              {
                x: 0,
                ease: "none",
                // short travel + lag-smoothed scrub: a calm glide, not 30vw of giant type jumping per wheel tick
                scrollTrigger: { trigger: head, start: "top bottom", end: "top 45%", scrub: 0.8, invalidateOnRefresh: true },
              },
            );
          });
        });

        q<HTMLElement>("[data-par]").forEach((card) => {
          const f = Number(card.dataset.par);
          const strip = card.parentElement as HTMLElement;
          gsap.set(card, { rotate: (1 - f) * 4 });
          gsap.fromTo(
            card,
            { y: () => -window.innerHeight * (f - 1) * 0.25 },
            {
              y: () => strip.offsetHeight * (f - 1) * 0.25,
              ease: "none",
              scrollTrigger: { trigger: strip, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true },
            },
          );
        });
      });

      // ScrollTrigger already re-measures on window "load" (after web fonts and images settle).
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
