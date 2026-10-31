// Placeholder score for the Scout launch film → public/music.wav
// Synthesised from the same timing grid as the picture (src/timing.ts), so every hit is frame-accurate.
// Replace with the licensed track for release; keep it at 90 BPM with the downbeat at 0 s and the hit at 9.33 s.
//
//   node scripts/make-music.ts

import { writeFileSync, mkdirSync } from "node:fs";
import { BEAT, DURATION, FPS, QUERY, T } from "../src/timing.ts";

const SR = 44100;
const LEN = Math.ceil((DURATION / FPS) * SR);
const L = new Float32Array(LEN);
const R = new Float32Array(LEN);
const sec = (frames: number) => frames / FPS;
const beatSec = sec(BEAT);

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function add(t0: number, dur: number, fn: (t: number) => number, gain = 1, pan = 0) {
  const a = Math.max(0, Math.floor(t0 * SR));
  const b = Math.min(LEN, Math.floor((t0 + dur) * SR));
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = a; i < b; i++) {
    const v = fn(i / SR - t0);
    L[i] += v * gl;
    R[i] += v * gr;
  }
}

/* ---- pad: soft additive chords, crossfaded ---- */
const CHORDS: [number, number[]][] = [
  [0, [45, 52, 55, 59, 60]], // Am9
  [sec(T.search - 20), [41, 48, 52, 57]], // Fmaj7
  [sec(T.hit), [45, 52, 55, 59, 64]], // Am9
  [sec(T.hit + 4 * BEAT), [41, 48, 52, 57, 60]], // Fmaj7
  [sec(T.proof - 2 * BEAT), [48, 52, 55, 59]], // Cmaj7
  [sec(T.chips[2] + 2 * BEAT), [43, 50, 55, 59, 64]], // G6
  [sec(T.endWordmark), [36, 43, 48, 52, 55, 62]], // Cadd9 — resolve
];
const total = LEN / SR;
CHORDS.forEach(([start, notes], ci) => {
  const end = ci + 1 < CHORDS.length ? CHORDS[ci + 1][0] : total;
  const xf = 0.6;
  const last = ci === CHORDS.length - 1;
  notes.forEach((n, ni) => {
    const f = hz(n);
    add(start - (ci ? xf / 2 : 0), end - start + xf, (t) => {
      const len = end - start + xf;
      const env = Math.min(1, t / (ci ? xf : 1.8)) * Math.min(1, (len - t) / xf + (last ? 1 : 0));
      // "fake" section: a slow detune so the bed feels uneasy
      const abs = start + t;
      const wob = abs > sec(T.fake) && abs < sec(T.search) ? 1 + 0.006 * Math.sin(abs * 7) : 1;
      let v = 0;
      for (let h = 1; h <= 5; h++) {
        v += (Math.sin(2 * Math.PI * f * h * wob * t) + Math.sin(2 * Math.PI * f * h * 1.003 * t + h)) / (h * h);
      }
      return v * env;
    }, last ? 0.05 : 0.04, ni % 2 ? 0.35 : -0.35);
  });
});

/* ---- tick, thump, kick, hat, chime voices ---- */
const tick = (t0: number, g = 0.12) => add(t0, 0.03, (t) => rnd() * Math.exp(-t * 260), g, rnd() * 0.4);
const thump = (t0: number, g: number) => add(t0, 0.5, (t) => Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 9), g);
const kick = (t0: number, g = 0.55) =>
  add(t0, 0.35, (t) => Math.sin(2 * Math.PI * (45 * t + (75 / 18) * (1 - Math.exp(-t * 18)))) * Math.exp(-t * 11), g);
let hp = 0, prev = 0;
const hat = (t0: number, g = 0.05) =>
  add(t0, 0.05, (t) => { const n = rnd(); hp = 0.85 * (hp + n - prev); prev = n; return hp * Math.exp(-t * 90); }, g, 0.3);
const chime = (t0: number, midi: number, g = 0.12) =>
  add(t0, 1.4, (t) => (Math.sin(2 * Math.PI * hz(midi) * t) + 0.35 * Math.sin(4 * Math.PI * hz(midi) * t)) * Math.exp(-t * 3.2), g, 0.15);

// hook + fake: one soft tick per line, sub pulse building toward the hit
[T.hookLine1, T.hookLine2, T.fake + 8].forEach((f) => tick(sec(f), 0.2));
for (let b = 0; b * BEAT < T.hit; b++) thump(b * beatSec, 0.1 + 0.25 * ((b * BEAT) / T.hit));
for (let f = T.fake + 6; f < T.search; f += 9) if (rnd() > 0.2) tick(sec(f), 0.06); // glitch flicker

// typing — one click per character, in sync with the on-screen text
for (let i = 1; i <= QUERY.length; i++) tick(sec(T.typeStart + (i * (T.typeEnd - T.typeStart)) / QUERY.length), 0.05);

// riser into the hit
add(sec(T.riser), sec(T.hit - T.riser), (t) => {
  const p = t / sec(T.hit - T.riser);
  return (rnd() * 0.5 + Math.sin(2 * Math.PI * (200 * t + 450 * t * p))) * p * p;
}, 0.12);

// the hit: sub drop + air
add(sec(T.hit), 1.6, (t) => Math.sin(2 * Math.PI * (35 * t + (35 / 3) * (1 - Math.exp(-t * 3)))) * Math.exp(-t * 2.2), 0.7);
add(sec(T.hit), 0.6, (t) => rnd() * Math.exp(-t * 8), 0.16);

// groove from the hit until the outro
for (let f = T.hit; f < T.outro; f += BEAT) {
  kick(sec(f), f === T.hit ? 0 : 0.45);
  hat(sec(f + BEAT / 2));
}
// felt arpeggio on eighths over the results
const ARP = [69, 72, 76, 79, 76, 72];
for (let k = 0, f = T.hit + BEAT; f < T.outro; f += BEAT / 2, k++) chime(sec(f), ARP[k % ARP.length], 0.045);

// UI accents: rows, chips, overlap, warning
for (let i = 0; i < 10; i++) tick(sec(T.rows + 6 + i * T.rowStagger), 0.07);
T.chips.forEach((f, i) => chime(sec(f), 84 + i * 2, 0.1));
chime(sec(T.overlap), 81, 0.09);
chime(sec(T.overlapWarn), 77, 0.09);

// end card: soft impact on the resolve
add(sec(T.endWordmark), 2.5, (t) => Math.sin(2 * Math.PI * 65.4 * t) * Math.exp(-t * 1.6), 0.4);
chime(sec(T.endWordmark), 72, 0.12);
chime(sec(T.endTagline), 79, 0.08);

/* ---- master: gentle saturation, normalise to -1 dBFS, 16-bit WAV ---- */
let peak = 0;
for (let i = 0; i < LEN; i++) {
  L[i] = Math.tanh(L[i] * 1.2);
  R[i] = Math.tanh(R[i] * 1.2);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak;
const buf = Buffer.alloc(44 + LEN * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + LEN * 4, 4); buf.write("WAVE", 8);
buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(LEN * 4, 40);
for (let i = 0; i < LEN; i++) {
  buf.writeInt16LE(Math.round(L[i] * norm * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(R[i] * norm * 32767), 46 + i * 4);
}
mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/music.wav", import.meta.url), buf);
console.log(`public/music.wav — ${(LEN / SR).toFixed(2)} s, peak normalised from ${peak.toFixed(2)}`);
