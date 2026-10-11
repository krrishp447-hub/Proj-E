"use client";

import { useEffect, useRef } from "react";

// The creator universe as a dot grid: ten chosen (signal blue), a few flagged (magenta), the rest quiet.
// Dots near the pointer light up. Pure SVG + one rAF-throttled pointer handler; static under reduced motion.
const COLS = 32;
const ROWS = 18;
const GAP = 46;
const W = COLS * GAP;
const H = ROWS * GAP;
const RADIUS = 170; // px in SVG units
const CHOSEN = new Set([75, 112, 143, 178, 209, 244, 270, 301, 338, 369]);
const FLAGGED = new Set([40, 97, 131, 190, 233, 286, 327, 352, 401, 455, 498, 530]);

const dots = Array.from({ length: COLS * ROWS }, (_, i) => ({
  i,
  x: (i % COLS) * GAP + GAP / 2,
  y: Math.floor(i / COLS) * GAP + GAP / 2,
  kind: CHOSEN.has(i) ? "chosen" : FLAGGED.has(i) ? "flagged" : "",
}));

export function SignalField() {
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svg.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const circles = [...el.querySelectorAll<SVGCircleElement>("circle")];
    let frame = 0;
    let lit: SVGCircleElement[] = [];

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(el.getScreenCTM()!.inverse());
        lit.forEach((c) => c.removeAttribute("data-near"));
        lit = [];
        circles.forEach((c, i) => {
          const d = Math.hypot(dots[i].x - pt.x, dots[i].y - pt.y);
          if (d >= RADIUS) return;
          c.setAttribute("data-near", d < RADIUS / 2 ? "2" : "1"); // two rings: inner glows brighter
          lit.push(c);
        });
      });
    };
    const hero = el.closest("header") ?? window;
    hero.addEventListener("pointermove", onMove as EventListener);
    return () => {
      cancelAnimationFrame(frame);
      hero.removeEventListener("pointermove", onMove as EventListener);
    };
  }, []);

  return (
    <svg ref={svg} className="sfield" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {dots.map((d) => (
        <circle key={d.i} data-i={d.i} className={d.kind} cx={d.x} cy={d.y} r={d.kind ? 5 : 2.5} />
      ))}
    </svg>
  );
}
