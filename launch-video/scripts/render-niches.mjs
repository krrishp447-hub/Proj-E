// Render every Niche-* reel (muted, 720×960) + a poster frame straight into the site.
//   node scripts/render-niches.mjs
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import path from "node:path";

const out = path.resolve("../web/public/video/niches");
mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const comps = (await getCompositions(serveUrl)).filter((c) => c.id.startsWith("Niche-"));
for (const composition of comps) {
  const slug = composition.id.replace("Niche-", "");
  await renderMedia({ serveUrl, composition, codec: "h264", crf: 26, muted: true, outputLocation: `${out}/${slug}.mp4`, chromiumOptions: { gl: "angle" } });
  await renderStill({ serveUrl, composition, frame: 125, imageFormat: "jpeg", jpegQuality: 85, output: `${out}/${slug}.jpg` });
  console.log("rendered", slug);
}
