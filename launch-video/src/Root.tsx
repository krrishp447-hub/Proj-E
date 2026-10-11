import { Composition, Folder } from "remotion";
import { Launch } from "./Launch";
import { NicheReel, REEL, type NicheProps } from "./NicheReel";
import niches from "./niches.json";
import { DURATION, FPS } from "./timing";

export const Root = () => (
  <>
    <Composition
      id="Launch"
      component={Launch}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
      // Leave url empty until the launch domain is final; the end card hides it.
      defaultProps={{ url: "" }}
    />
    {/* Vertical loops for the site's niche carousel — data from src/niches.json (npm run niches). */}
    <Folder name="Niches">
      {(niches as NicheProps[]).map((n) => (
        <Composition
          key={n.slug}
          id={`Niche-${n.slug}`}
          component={NicheReel}
          durationInFrames={REEL.frames}
          fps={REEL.fps}
          width={REEL.width}
          height={REEL.height}
          defaultProps={n}
        />
      ))}
    </Folder>
  </>
);
