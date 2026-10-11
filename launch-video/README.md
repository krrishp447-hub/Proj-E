# Scout launch film: "Signal"

A 24 s, 1920×1080, 30 fps launch video built with Remotion, three.js (`@remotion/three`) and GSAP (`@remotion/gsap`).
The script and research are in [SCRIPTS.md](SCRIPTS.md), under Script A.

```bash
npm install
npm run studio    # preview and scrub in the browser
npm run render    # → out/scout-launch.mp4 (H.264, CRF 16)
npm run music     # regenerate the placeholder score → public/music.wav
```

## Niche reels (site carousel)

There are five 6-second, 720×960 muted loops (`Niche-*` compositions in `src/NicheReel.tsx`), one per niche on the site's Niches carousel. Their numbers come from the site's demo dataset.

```bash
npm run niches                       # re-export stats from ../web/src/lib/scout/data.ts → src/niches.json
node scripts/render-niches.mjs       # render mp4 + poster jpg → ../web/public/video/niches/
```

## How it's built

- **`src/timing.ts`** holds every cue on one 90 BPM grid (1 beat = 20 frames). Both the picture and the music script read it, so hits stay frame-accurate when you retime anything.
- **`src/Field.tsx`** is the creator universe in three.js. It has 600 points in three layers: the crowd, the fakes and the chosen ten. Every position is a pure function of the frame, so preview and render match. The ten points land exactly on the score-ring centres from `src/data.ts`.
- **`src/Scenes.tsx`** contains the typography and product UI. Each scene is its own `<Sequence>` with a `useGsapTimeline`. Easing is limited to `power3.out` to arrive, `expo.inOut` to transform and `power2.in` to leave.
- Creator data is illustrative demo data, and is labelled on screen while it's visible.

## Before release

1. **Music.** `public/music.wav` is a synthesized placeholder. License a track (90 BPM, downbeat at 0 s, big moment at 9.33 s), save it as `public/music.wav` (or change the `src` in `src/Launch.tsx`), and re-render.
2. **URL.** Render with the launch domain on the end card: `npx remotion render Launch out/scout-launch.mp4 --props='{"url":"yourdomain.com"}'`.
3. **Remotion licence.** It's free for individuals and companies of up to 3 people. Larger companies need a Company License (remotion.dev/license).
