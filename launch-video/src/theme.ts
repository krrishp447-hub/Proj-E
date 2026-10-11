import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadArchivo } from "@remotion/google-fonts/Archivo";
import { loadFont as loadSpaceMono } from "@remotion/google-fonts/SpaceMono";

// Poster palette (web/src/app/globals.css). Emerald is reserved for scores and "verified".
export const C = {
  ink: "#0C0D0B",
  panel: "#11151F",
  panelLine: "#222B3A",
  paper: "#EFEDE6",
  muted: "#99A3B2",
  faint: "#5C6880",
  signal: "#4D74FF",
  score: "#16C98D",
  warn: "#E0A33E",
  bad: "#F0796F",
};

export const F = {
  disp: loadAnton("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily,
  body: loadArchivo("normal", { weights: ["500", "700", "800"], subsets: ["latin"] }).fontFamily,
  mono: loadSpaceMono("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily,
};
