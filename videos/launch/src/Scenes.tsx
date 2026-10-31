import { useGsapTimeline } from "@remotion/gsap";
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { PANEL, RING, TOP10, initials } from "./data";
import { C, F } from "./theme";
import { QUERY, T, s } from "./timing";

// Each scene lives in its own <Sequence>, so frames (and GSAP seconds) are relative to its start.
// Easing vocabulary is deliberately small: power3.out to arrive, expo.inOut to transform, power2.in to leave.

const disp: CSSProperties = { fontFamily: F.disp, textTransform: "uppercase", lineHeight: 0.92, letterSpacing: "-0.005em" };
const mono: CSSProperties = { fontFamily: F.mono, textTransform: "uppercase", letterSpacing: "0.08em" };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const RING_C = 2 * Math.PI * RING.r;

const Center = ({ children }: { children: ReactNode }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>{children}</AbsoluteFill>
);

/* 0–3.3 s — the hook */
export function Hook() {
  const scope = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => {
    const enter = { opacity: 0, y: 34, filter: "blur(10px)", duration: 0.8, ease: "power3.out" };
    timeline
      .from(selector("[data-l1]"), enter, s(T.hookLine1))
      .from(selector("[data-l2]"), enter, s(T.hookLine2))
      .to(selector("[data-l]"), { opacity: 0, y: -18, filter: "blur(6px)", duration: 0.3, ease: "power2.in" }, s(T.hookOut - 6));
  });
  return (
    <Center>
      <div ref={scope} style={{ ...disp, fontSize: 112 }}>
        <div data-l data-l1 style={{ color: C.paper }}>Every brand is looking for creators.</div>
        <div data-l data-l2 style={{ color: C.signal, marginTop: 18 }}>Most find followers.</div>
      </div>
    </Center>
  );
}

/* 3.3–6 s — the risk */
export function Fake() {
  const scope = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => {
    timeline
      .from(selector("[data-l]"), { opacity: 0, y: 30, filter: "blur(10px)", duration: 0.8, ease: "power3.out" }, s(8))
      .to(selector("[data-l]"), { opacity: 0, filter: "blur(8px)", duration: 0.3, ease: "power2.in" }, s(T.fakeOut - T.fake - 6));
  });
  return (
    <Center>
      <div ref={scope} style={{ ...disp, fontSize: 112 }}>
        <div data-l style={{ color: C.paper }}>
          Some of them <span style={{ color: C.bad }}>aren&apos;t even real.</span>
        </div>
      </div>
    </Center>
  );
}

/* Persistent wordmark */
export function Wordmark() {
  const scope = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => {
    timeline
      .from(selector("[data-w]"), { opacity: 0, x: -16, duration: 0.7, ease: "power3.out" }, 0)
      .to(selector("[data-w]"), { opacity: 0, duration: 0.4, ease: "power2.in" }, s(T.outro - T.wordmark));
  });
  return (
    <div ref={scope}>
      <div data-w style={{ position: "absolute", left: 80, top: 62, ...disp, fontSize: 40, color: C.signal, textShadow: "0 0 24px rgba(77,116,255,.55)" }}>
        Scout
      </div>
    </div>
  );
}

/* 6–15 s — the sentence, then it docks above the results */
export function SearchBar() {
  const frame = useCurrentFrame(); // relative to T.search
  const g = frame + T.search;
  const chars = Math.round(interpolate(g, [T.typeStart, T.typeEnd], [0, QUERY.length], clamp));
  const caretOn = g < T.hit && Math.floor(g / 15) % 2 === 0;

  const scope = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => {
    const bar = selector("[data-bar]");
    timeline
      .from(bar, { opacity: 0, scale: 0.94, y: 24, duration: 0.8, ease: "expo.out" }, 0)
      .to(bar, { boxShadow: "0 0 0 10px rgba(77,116,255,.16), 0 0 90px rgba(77,116,255,.45)", duration: s(T.hit - T.riser), ease: "power2.in" }, s(T.riser - T.search))
      .to(bar, { left: PANEL.left, top: 104, width: PANEL.width, height: 62, fontSize: 19, paddingLeft: 22, boxShadow: "0 0 0 0 rgba(0,0,0,0)", duration: 0.9, ease: "expo.inOut" }, s(T.hit - T.search))
      .to(bar, { opacity: 0, duration: 0.4, ease: "power2.in" }, s(T.proof - T.search));
  });

  return (
    <div ref={scope}>
      <div
        data-bar
        style={{
          position: "absolute", left: 330, top: 498, width: 1260, height: 92, display: "flex", alignItems: "center", gap: 18,
          paddingLeft: 34, borderRadius: 18, background: C.panel, border: `1.5px solid ${C.signal}`,
          fontFamily: F.body, fontWeight: 500, fontSize: 31, color: C.paper, boxSizing: "border-box", overflow: "hidden", whiteSpace: "nowrap",
        }}
      >
        <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.2" style={{ flex: "none" }}>
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
        <span>
          {QUERY.slice(0, chars)}
          <span style={{ display: "inline-block", width: 3, height: "1.1em", marginLeft: 3, verticalAlign: "-0.18em", background: C.signal, opacity: caretOn ? 1 : 0 }} />
        </span>
      </div>
    </div>
  );
}

/* 10–19.5 s — the right ten */
export function Rows() {
  const frame = useCurrentFrame(); // relative to T.rows
  const scope = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => {
    timeline
      .from(selector("[data-cap] > div"), { opacity: 0, y: 40, filter: "blur(10px)", duration: 0.8, ease: "power3.out", stagger: 0.18 }, s(4))
      .from(selector("[data-head]"), { opacity: 0, duration: 0.5 }, s(2))
      .from(selector("[data-row]"), { opacity: 0, x: 46, duration: 0.6, ease: "power3.out", stagger: s(T.rowStagger) }, s(6))
      .fromTo(selector("[data-ring]"), { strokeDashoffset: RING_C }, {
        strokeDashoffset: (i: number) => RING_C * (1 - TOP10[i].score / 100),
        duration: 0.9, ease: "power3.out", stagger: s(T.rowStagger),
      }, s(12))
      .to(selector("[data-cap]"), { opacity: 0, y: -20, filter: "blur(6px)", duration: 0.35, ease: "power2.in" }, s(T.proof - T.rows - 8))
      .to(selector("[data-panel]"), { opacity: 0, scale: 0.97, filter: "blur(4px)", duration: 0.6, ease: "expo.inOut" }, s(T.proof - T.rows));
  });

  return (
    <div ref={scope}>
      <div data-cap style={{ position: "absolute", left: 120, top: 380, ...disp, fontSize: 132 }}>
        <div style={{ color: C.paper }}>One search.</div>
        <div style={{ color: C.signal }}>The right ten.</div>
      </div>

      <div data-panel style={{ position: "absolute", left: PANEL.left, top: PANEL.top - 34, width: PANEL.width, transformOrigin: "50% 30%" }}>
        <div data-head style={{ ...mono, fontSize: 14, color: C.muted, height: 34 }}>Ranked on 8 signals · not follower count</div>
        {TOP10.map((c, i) => {
          const start = 12 + i * T.rowStagger;
          const n = Math.round(interpolate(frame, [start, start + 27], [0, c.score], clamp));
          return (
            <div key={c.name} data-row style={{ height: PANEL.rowH, display: "grid", gridTemplateColumns: "34px 46px 1fr 112px 84px 118px 56px", alignItems: "center", gap: 14, borderBottom: `1px solid ${C.panelLine}`, fontFamily: F.body }}>
              <span style={{ ...mono, fontSize: 14, color: C.faint }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ width: 44, height: 44, borderRadius: 11, background: c.color, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 16, color: "#fff" }}>{initials(c.name)}</span>
              <span>
                <div style={{ fontWeight: 700, fontSize: 21, color: C.paper }}>{c.name}</div>
                <div style={{ fontSize: 14, color: C.muted, marginTop: 2 }}>{c.meta}</div>
              </span>
              <span style={{ fontFamily: F.mono, fontSize: 17, color: C.paper }}>{c.subs}<div style={{ ...mono, fontSize: 10, color: C.faint }}>Subs</div></span>
              <span style={{ fontFamily: F.mono, fontSize: 17, color: C.paper }}>{c.eng}<div style={{ ...mono, fontSize: 10, color: C.faint }}>Eng.</div></span>
              <span>{c.proven && <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: C.score, border: `1px solid ${C.score}55`, background: `${C.score}18`, padding: "4px 8px", borderRadius: 999 }}>◆ Proven</span>}</span>
              <span style={{ position: "relative", width: RING.r * 2 + RING.stroke, height: RING.r * 2 + RING.stroke }}>
                <svg viewBox="0 0 58 58" width="58" height="58" style={{ transform: "rotate(-90deg)", position: "absolute", inset: -2 }}>
                  <circle cx="29" cy="29" r={RING.r} fill="none" stroke={C.panelLine} strokeWidth={RING.stroke} />
                  <circle data-ring cx="29" cy="29" r={RING.r} fill="none" stroke={C.score} strokeWidth={RING.stroke} strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={RING_C} />
                </svg>
                <span style={{ position: "absolute", inset: -2, display: "grid", placeItems: "center", fontFamily: F.mono, fontWeight: 700, fontSize: 18, color: C.score }}>{n}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const chip = (color: string): CSSProperties => ({
  ...mono, fontSize: 16, fontWeight: 700, color, padding: "10px 16px", borderRadius: 999,
  border: `1px solid ${color}66`, background: `${color}1A`, display: "inline-block",
});

const BREAKDOWN = [
  { l: "Sub-niche · tws, earbuds", p: 42, w: 92 },
  { l: "Engagement 5.8%", p: 13, w: 40 },
  { l: "Proven on-platform results", p: 12, w: 38 },
  { l: "Audience · India", p: 12, w: 34 },
  { l: "Growth +7.2%", p: 6, w: 22 },
];

/* 15–19.5 s — the receipts */
export function Proof() {
  const scope = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => {
    const rel = (f: number) => s(f - T.proof);
    timeline
      .from(selector("[data-cap] > div"), { opacity: 0, y: 40, filter: "blur(10px)", duration: 0.8, ease: "power3.out", stagger: 0.18 }, rel(T.proof + 6))
      .from(selector("[data-card]"), { opacity: 0, x: 70, duration: 0.8, ease: "expo.out" }, 0);
    T.chips.forEach((f, i) => timeline.from(selector(`[data-chip="${i}"]`), { opacity: 0, scale: 0.86, y: 10, duration: 0.45, ease: "power3.out" }, rel(f)));
    timeline
      .fromTo(selector("[data-bar] i"), { width: "0%" }, { width: (i: number) => `${BREAKDOWN[i].w}%`, duration: 0.8, ease: "power3.out", stagger: 0.07 }, rel(T.bars))
      .from(selector("[data-ov]"), { opacity: 0, y: 14, duration: 0.5, ease: "power3.out" }, rel(T.overlap))
      .fromTo(selector("[data-ovfill]"), { width: "0%" }, { width: "71%", duration: 0.7, ease: "power3.out" }, rel(T.overlap + 4))
      .from(selector("[data-warn]"), { opacity: 0, y: 8, duration: 0.45, ease: "power3.out" }, rel(T.overlapWarn))
      .to(selector("[data-out]"), { opacity: 0, y: -20, filter: "blur(6px)", duration: 0.5, ease: "power2.in" }, rel(T.outro));
  });

  return (
    <div ref={scope}>
      <div data-out>
        <div data-cap style={{ position: "absolute", left: 120, top: 380, ...disp, fontSize: 132 }}>
          <div style={{ color: C.paper }}>Verified,</div>
          <div style={{ color: C.score }}>not inflated.</div>
        </div>

        <div data-card style={{ position: "absolute", left: PANEL.left, top: 170, width: PANEL.width, padding: "34px 38px", boxSizing: "border-box", borderRadius: 22, background: C.panel, border: `1px solid ${C.panelLine}`, boxShadow: "0 40px 120px -40px rgba(0,0,0,.9)", fontFamily: F.body, color: C.paper }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <span style={{ width: 62, height: 62, borderRadius: 15, background: TOP10[0].color, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 22 }}>TA</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 30 }}>Tech With Arjun <span style={{ color: C.signal }}>✓</span></div>
              <div style={{ fontSize: 17, color: C.muted, marginTop: 2 }}>@techwitharjun · YouTube · India · Tech</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 26 }}>
            <span data-chip="0" style={chip(C.score)}>92 authentic</span>
            <span data-chip="1" style={chip(C.score)}>3% suspicious</span>
            <span data-chip="2" style={chip(C.muted)}>↻ verified 2d ago</span>
          </div>

          <div style={{ ...mono, fontSize: 13, color: C.faint, margin: "30px 0 14px" }}>Why this match</div>
          <div style={{ display: "grid", gap: 12 }}>
            {BREAKDOWN.map((b) => (
              <div key={b.l} data-bar style={{ display: "grid", gridTemplateColumns: "1fr 330px 54px", alignItems: "center", gap: 18, fontSize: 18 }}>
                <span style={{ color: C.muted }}>{b.l}</span>
                <span style={{ height: 10, borderRadius: 6, background: C.panelLine, overflow: "hidden" }}><i style={{ display: "block", height: "100%", width: 0, borderRadius: 6, background: C.score }} /></span>
                <span style={{ fontFamily: F.mono, fontWeight: 700, color: C.score, textAlign: "right" }}>+{b.p}</span>
              </div>
            ))}
          </div>

          <div data-ov style={{ marginTop: 30, paddingTop: 24, borderTop: `1px solid ${C.panelLine}` }}>
            <div style={{ ...mono, fontSize: 13, color: C.faint, marginBottom: 14 }}>Audience overlap</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 330px 54px", alignItems: "center", gap: 18, fontSize: 18 }}>
              <span>Arjun <span style={{ color: C.faint }}>×</span> EarbudExpert</span>
              <span style={{ height: 10, borderRadius: 6, background: C.panelLine, overflow: "hidden" }}><i data-ovfill style={{ display: "block", height: "100%", width: 0, borderRadius: 6, background: C.bad }} /></span>
              <span style={{ fontFamily: F.mono, fontWeight: 700, color: C.bad, textAlign: "right" }}>71%</span>
            </div>
            <div data-warn style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, fontSize: 17, background: `${C.bad}1A`, border: `1px solid ${C.bad}55` }}>
              ⚠ Same audience, paid twice. Swap one for broader reach.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 19.3–24 s — the end card */
export function Outro({ url }: { url: string }) {
  const scope = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => {
    const rel = (f: number) => s(f - T.outro);
    timeline
      .from(selector("[data-k]"), { opacity: 0, y: 12, duration: 0.7, ease: "power3.out" }, rel(T.endWordmark + 4))
      .from(selector("[data-wm]"), { opacity: 0, scale: 1.08, filter: "blur(14px)", duration: 1.2, ease: "expo.out" }, rel(T.endWordmark))
      .from(selector("[data-tag]"), { opacity: 0, y: 20, filter: "blur(8px)", duration: 0.9, ease: "power3.out" }, rel(T.endTagline))
      .from(selector("[data-url]"), { opacity: 0, duration: 0.6 }, rel(T.endTagline + 24));
  });
  return (
    <Center>
      <div ref={scope}>
        <div data-k style={{ ...mono, fontSize: 18, color: C.signal, marginBottom: 22 }}>Creator intelligence</div>
        <div data-wm style={{ ...disp, fontSize: 250, color: C.signal, textShadow: "0 0 60px rgba(77,116,255,.45)" }}>Scout</div>
        <div data-tag style={{ fontFamily: F.body, fontWeight: 700, fontSize: 44, color: C.paper, marginTop: 30 }}>
          Find the right creators, not more creators.
        </div>
        {url && <div data-url style={{ ...mono, fontSize: 20, color: C.muted, marginTop: 30 }}>{url}</div>}
      </div>
    </Center>
  );
}

/* Honesty label while product data is on screen */
export function DataNote() {
  const scope = useGsapTimeline<HTMLDivElement>(({ timeline, selector }) => {
    timeline.from(selector("[data-n]"), { opacity: 0, duration: 0.5 }, 0).to(selector("[data-n]"), { opacity: 0, duration: 0.4 }, s(T.outro - T.rows));
  });
  return (
    <div ref={scope}>
      <div data-n style={{ position: "absolute", right: 80, bottom: 52, ...mono, fontSize: 13, color: C.faint }}>Illustrative product data</div>
    </div>
  );
}
