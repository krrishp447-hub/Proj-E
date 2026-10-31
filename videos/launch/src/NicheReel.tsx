import { Dumbbell, Gamepad2, Headphones, IndianRupee, Shirt } from "lucide-react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { F } from "./theme";

// 6 s vertical loop for the site's niche carousel (3:4, muted). Solid colour, vector icon, live demo-data readouts.
// Everything exits before the last frame, so frame 180 == frame 0 and the loop is seamless.

export const REEL = { width: 720, height: 960, fps: 30, frames: 180 };

const ICONS = { Headphones, Dumbbell, IndianRupee, Gamepad2, Shirt };

export type NicheProps = {
  slug: string;
  name: string;
  icon: keyof typeof ICONS;
  bg: string;
  fg: string;
  index: number;
  count: number;
  eng: number;
  auth: number;
  growth: number;
  top: { name: string; platform: string; eng: number }[];
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const OUT = 150; // exit starts
const out = (f: number) => interpolate(f, [OUT, OUT + 22], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
const rise = (f: number, start: number, dur = 18) => interpolate(f, [start, start + dur], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

export function NicheReel(p: NicheProps) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const Icon = ICONS[p.icon];
  const x = out(f);
  const pop = spring({ frame: f - 10, fps, config: { damping: 14, stiffness: 120 } });
  const ring = (f / REEL.frames) * 360; // one full turn per loop → seamless

  const stats = [
    { label: "Engagement", value: p.eng, max: 10, text: (v: number) => `${v.toFixed(1)}%` },
    { label: "Authenticity", value: p.auth, max: 100, text: (v: number) => `${Math.round(v)}` },
    { label: "Growth 90d", value: p.growth, max: 20, text: (v: number) => `+${v.toFixed(1)}%` },
  ];

  return (
    <AbsoluteFill style={{ background: p.bg, color: p.fg, fontFamily: F.body, padding: 56 }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.mono, fontSize: 22, letterSpacing: "0.08em", textTransform: "uppercase", opacity: rise(f, 4) * (1 - x) }}>
        <span>0{p.index} / 05</span>
        <span>Scout · niche</span>
      </div>

      {/* icon on a rotating dashed ring */}
      <div style={{ position: "relative", height: 250, marginTop: 24, display: "grid", placeItems: "center", opacity: 1 - x, transform: `translateY(${-40 * x}px)` }}>
        <svg width="240" height="240" viewBox="0 0 300 300" style={{ position: "absolute", transform: `rotate(${ring}deg) scale(${pop})` }}>
          <circle cx="150" cy="150" r="140" fill="none" stroke={p.fg} strokeWidth="3" strokeDasharray="10 14" />
        </svg>
        <div style={{ transform: `scale(${pop}) rotate(${interpolate(pop, [0, 1], [-14, 0])}deg)` }}>
          <Icon size={128} strokeWidth={1.4} color={p.fg} />
        </div>
      </div>

      {/* name */}
      <div style={{ fontFamily: F.disp, textTransform: "uppercase", fontSize: 92, lineHeight: 0.9, marginTop: 14, opacity: rise(f, 30) * (1 - x), transform: `translateY(${(1 - rise(f, 30)) * 40 - 40 * x}px)` }}>
        {p.name}
      </div>

      {/* live readouts */}
      <div style={{ marginTop: 34, display: "grid", gap: 18 }}>
        {stats.map((s, i) => {
          const r = rise(f, 52 + i * 10, 40);
          return (
            <div key={s.label} style={{ opacity: rise(f, 48 + i * 10) * (1 - x), transform: `translateY(${-30 * x}px)` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.mono, fontSize: 22, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <span>{s.label}</span>
                <b>{s.text(s.value * r)}</b>
              </div>
              <div style={{ height: 12, borderRadius: 6, background: p.fg, opacity: 0.18, marginTop: 8 }} />
              <div style={{ height: 12, borderRadius: 6, background: p.fg, marginTop: -12, width: `${(s.value / s.max) * 100 * r}%` }} />
            </div>
          );
        })}
      </div>

      {/* top creators in the demo data */}
      <div style={{ position: "absolute", left: 56, right: 56, bottom: 52, display: "grid", gap: 10 }}>
        <div style={{ fontFamily: F.mono, fontSize: 18, letterSpacing: "0.08em", textTransform: "uppercase", opacity: rise(f, 92) * (1 - x) }}>
          {p.count} in demo · top by engagement
        </div>
        {p.top.slice(0, 2).map((c, i) => (
          <div key={c.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: p.fg, color: p.bg, borderRadius: 14, padding: "14px 18px", fontSize: 24, fontWeight: 700, opacity: rise(f, 98 + i * 8) * (1 - x), transform: `translateX(${(1 - rise(f, 98 + i * 8)) * 60}px)` }}>
            <span>{c.name}</span>
            <span style={{ fontFamily: F.mono, fontSize: 20 }}>{c.platform === "YouTube" ? "YT" : "IG"} · {c.eng}%</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
