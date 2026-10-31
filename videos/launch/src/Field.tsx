import { ThreeCanvas } from "@remotion/three";
import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture } from "three";
import { Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { ringCenter } from "./data";
import { T } from "./timing";

// Every value below is a pure function of the frame (no useFrame / clocks), so preview == render.

const N = 600; // "the creator universe"
const TEN = 10;
const FOV = 50;
const CAM_LOCK = 10; // camera z from the hit onward; the ten points land exactly on the ring centres
const PX_PER_UNIT = 1080 / (2 * CAM_LOCK * Math.tan(((FOV / 2) * Math.PI) / 180));

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (f: number, a: number, b: number, e = Easing.inOut(Easing.cubic)) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: e });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const PAPER = [0.94, 0.93, 0.9];
const SIGNAL = [0.3, 0.45, 1];
const RED = [0.94, 0.3, 0.27];
const EMERALD = [0.09, 0.79, 0.55];

// Three render layers so each can have its own point size: the crowd, the fakes, the chosen ten.
const CROWD = 0, FAKES = 1, CHOSEN = 2;
type Pt = { base: number[]; ph: number[]; tint: number[]; suspicious: boolean; sphere: number[]; layer: number; slot: number };

function makePoints(): Pt[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const next = [0, 0, 0];
  return Array.from({ length: N }, (_, i) => {
    const suspicious = i >= TEN && i % 6 === 3;
    const layer = i < TEN ? CHOSEN : suspicious ? FAKES : CROWD;
    const r = (k: string) => random(`${k}-${i}`);
    const y = 1 - (i / (N - 1)) * 2; // Fibonacci sphere → the calm, ordered end state
    const rad = Math.sqrt(1 - y * y);
    return {
      base: [lerp(-13, 13, r("x")), lerp(-7.5, 7.5, r("y")), lerp(-10, 3, r("z"))],
      ph: [r("a") * 6.28, r("b") * 6.28, 0.6 + r("c") * 0.8],
      tint: r("t") < 0.22 ? SIGNAL : PAPER,
      suspicious,
      layer,
      slot: next[layer]++,
      sphere: [Math.cos(golden * i) * rad * 5.2, y * 5.2, Math.sin(golden * i) * rad * 5.2 - 4],
    };
  });
}

function sprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

/** R3F only reads the Canvas camera prop on mount, so drive the dolly from inside the scene. */
function Dolly({ z }: { z: number }) {
  const camera = useThree((st) => st.camera);
  camera.position.set(0, 0, z);
  camera.lookAt(0, 0, 0);
  return null;
}

export function Field() {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const pts = useMemo(makePoints, []);
  const tex = useMemo(sprite, []);

  const camZ = f < T.hit
    ? lerp(14, CAM_LOCK, ease(f, 0, T.hit))
    : lerp(CAM_LOCK, 9.2, ease(f, T.outro, 720, Easing.out(Easing.cubic)));

  const fadeIn = ease(f, 0, 30);
  const searchDim = 1 - 0.45 * ease(f, T.search, T.search + 20) * (1 - ease(f, T.hit, T.hit + 6));
  const collapse = ease(f, T.hit, T.collapseEnd, Easing.inOut(Easing.exp));
  const outro = ease(f, T.outro, T.outro + 100, Easing.inOut(Easing.cubic));
  const spin = f * 0.004;

  const layers = useMemo(() => {
    const counts = [0, 0, 0];
    pts.forEach((p) => counts[p.layer]++);
    const out = counts.map((n) => ({ pos: new Float32Array(n * 3), col: new Float32Array(n * 3) }));

    pts.forEach((p, i) => {
      // drifting, slowly turning noise
      const a = f * 0.0008;
      const dx = p.base[0] + Math.sin(f * 0.012 * p.ph[2] + p.ph[0]) * 0.35;
      const dy = p.base[1] + Math.cos(f * 0.01 * p.ph[2] + p.ph[1]) * 0.3;
      const dz = p.base[2];
      let x = dx * Math.cos(a) - dz * Math.sin(a);
      let y = dy;
      let z = dx * Math.sin(a) + dz * Math.cos(a);
      let col = p.tint;
      let lum = 0.7 * fadeIn * searchDim;

      if (p.suspicious && f >= T.fake) {
        col = RED;
        const flicker = f < T.search ? (random(`fl-${i}-${Math.floor(f / 3)}`) > 0.45 ? 1.15 : 0.25) : 0.45;
        lum = flicker * fadeIn * searchDim * ease(f, T.fake, T.fake + 10);
      }

      if (i < TEN) {
        // the right ten: lock onto the score-ring centres, then hand over to the UI rings
        const c = ringCenter(i);
        const tx = (c.x - width / 2) / PX_PER_UNIT;
        const ty = (height / 2 - c.y) / PX_PER_UNIT;
        x = lerp(x, tx, collapse);
        y = lerp(y, ty, collapse);
        z = lerp(z, 0, collapse);
        col = collapse > 0 ? EMERALD.map((v, k) => lerp(col[k], v, collapse)) : col;
        lum = lerp(lum, 1.2, collapse) * (1 - ease(f, T.rows + 24, T.rows + 44));
      } else {
        // everyone else falls away into the dark
        const len = Math.hypot(x, y) || 1;
        x += (x / len) * 6 * collapse;
        y += ((y / len) * 3 - 2) * collapse;
        z -= 14 * collapse;
        lum *= 1 - 0.8 * collapse;
      }

      // outro: the whole universe settles into an ordered, slowly turning sphere
      if (outro > 0) {
        const sx = p.sphere[0] * Math.cos(spin) - (p.sphere[2] + 4) * Math.sin(spin);
        const sz = p.sphere[0] * Math.sin(spin) + (p.sphere[2] + 4) * Math.cos(spin) - 4;
        x = lerp(x, sx, outro);
        y = lerp(y, p.sphere[1], outro);
        z = lerp(z, sz, outro);
        col = col.map((v, k) => lerp(v, (p.tint === SIGNAL ? SIGNAL : PAPER)[k], outro));
        lum = lerp(lum, 0.75, outro);
      }

      out[p.layer].pos.set([x, y, z], p.slot * 3);
      out[p.layer].col.set(col.map((v) => v * lum), p.slot * 3);
    });
    return out;
  }, [f, pts, width, height, fadeIn, searchDim, collapse, outro, spin]);

  const fieldSize = lerp(0.36, 0.12, ease(f, 0, T.search)) * lerp(1, 1.1, outro);
  const tenSize = lerp(lerp(fieldSize, 0.34, collapse), fieldSize, outro);
  // fakes swell while they flicker so the beat reads at a glance, then shrink back into the crowd
  const fakeSize = lerp(fieldSize, 0.42, ease(f, T.fake, T.fake + 12) * (1 - ease(f, T.search, T.search + 20)));
  const sizes = [fieldSize, fakeSize, tenSize];

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ fov: FOV, position: [0, 0, camZ], near: 0.1, far: 100 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Dolly z={camZ} />
      {layers.map((l, k) => (
        <points key={k}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[l.pos, 3]} />
            <bufferAttribute attach="attributes-color" args={[l.col, 3]} />
          </bufferGeometry>
          <pointsMaterial size={sizes[k]} map={tex} vertexColors transparent depthWrite={false} blending={AdditiveBlending} />
        </points>
      ))}
    </ThreeCanvas>
  );
}
