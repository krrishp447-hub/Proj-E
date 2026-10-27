import { ImageResponse } from "next/og";
import { LOGO } from "@/components/ui/logo-data";

// Link-preview card (1200×630): flat ink field, the dot universe with ten chosen in signal blue, logo + promise.
export const alt = "ScoutBlack — find the right creators, not more creators";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Wordmark as a data-URI image (dark-background colourway), built from the same geometry as <Logo/>.
const logoSrc = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO.viewBox}" fill="#EFEDE6">${LOGO.letters.map((l) => `<path transform="translate(${l.x} 0)" d="${l.d}"/>`).join("")}<circle cx="${LOGO.disc.cx}" cy="${LOGO.disc.cy}" r="${LOGO.disc.r}"/><circle cx="${LOGO.dot.cx}" cy="${LOGO.dot.cy}" r="${LOGO.dot.r}" fill="#4D74FF"/></svg>`,
).toString("base64")}`;

const CHOSEN = new Set([14, 27, 41, 52, 66, 79, 93, 104, 118, 131]);

export default function Image() {
  const dots = Array.from({ length: 24 * 6 }, (_, i) => i);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0C0D0B", padding: 64 }}>
        <div style={{ display: "flex", flexWrap: "wrap", width: 1072, gap: 22 }}>
          {dots.map((i) => (
            <div key={i} style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: CHOSEN.has(i) ? 14 : 6, height: CHOSEN.has(i) ? 14 : 6, borderRadius: 99, background: CHOSEN.has(i) ? "#4D74FF" : "#34352f" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={520} height={164} alt="" />
          <div style={{ fontSize: 44, fontWeight: 700, color: "#EFEDE6", marginTop: 24 }}>Find the right creators, not more creators.</div>
        </div>
      </div>
    ),
    size,
  );
}
