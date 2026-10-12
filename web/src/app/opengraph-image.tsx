import { ImageResponse } from "next/og";

// Link-preview card (1200×630): flat ink field, the dot universe with ten chosen in signal blue, wordmark + promise.
export const alt = "Scout — find the right creators, not more creators";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          <div style={{ fontSize: 132, fontWeight: 900, color: "#4D74FF", letterSpacing: -4, lineHeight: 1 }}>SCOUT</div>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#EFEDE6", marginTop: 14 }}>Find the right creators, not more creators.</div>
        </div>
      </div>
    ),
    size,
  );
}
