// Single source of truth for the cut. Picture (src/*) and the placeholder score (scripts/make-music.ts)
// both read these, so every hit lands on the same frame.
//
// 90 BPM at 30 fps → 1 beat = 20 frames, 1 bar = 80 frames, 9 bars = 720 frames = 24 s.

export const FPS = 30;
export const BPM = 90;
export const BEAT = 20; // frames
export const DURATION = 720; // frames

export const T = {
  hookLine1: 8,
  hookLine2: 48,
  hookOut: 92,
  fake: 100, // "Some of them aren't even real." + red flicker
  fakeOut: 172,
  search: 180, // search bar settles in
  wordmark: 184,
  typeStart: 196,
  typeEnd: 262,
  riser: 240,
  hit: 280, // field collapses to ten points; beat enters
  collapseEnd: 310,
  rows: 300, // ranked rows cascade
  rowStagger: 4,
  proof: 450, // push into the top creator
  chips: [460, 480, 500], // authentic · suspicious · verified — on the beat
  bars: 480,
  overlap: 520,
  overlapWarn: 540,
  outro: 580, // UI recedes, field re-forms ordered
  endWordmark: 600, // final chord
  endTagline: 620,
  audioFadeEnd: 705,
} as const;

export const QUERY = "Indian YouTube tech creators who review earbuds, 50K–500K subs";

/** Frames → seconds, for GSAP timelines (which are seeked in seconds). */
export const s = (frames: number) => frames / FPS;
