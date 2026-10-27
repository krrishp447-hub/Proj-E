// Pure transform: YouTube Analytics API reports (owner-only, from a connected creator) → ScoutBlack's audience fields.
import { COUNTRY } from "./metrics.ts";

/** A YouTube Analytics `reports.query` response: rows of dimension values followed by metric values. */
export type Report = { rows?: (string | number)[][] };

export type Audience = {
  age: number[]; // % of viewers per AGE_BANDS (13–17, 18–24, 25–34, 35+)
  male: number | null; // % of viewers
  geo: [string, number][]; // top countries by % of views, then "Other"
  avgViewPct: number | null; // average % of each video watched (retention)
};

const BAND: Record<string, number> = { "age13-17": 0, "age18-24": 1, "age25-34": 2 }; // every older group → 35+

/**
 * ageGender: dimensions=ageGroup,gender metrics=viewerPercentage
 * countries: dimensions=country metrics=views
 * retention: metrics=averageViewPercentage
 */
export function audienceFrom(ageGender: Report, countries: Report, retention: Report): Audience {
  const age = [0, 0, 0, 0];
  let male = 0;
  for (const [group, gender, pct] of ageGender.rows ?? []) {
    age[BAND[String(group)] ?? 3] += Number(pct);
    if (gender === "male") male += Number(pct);
  }

  const rows = (countries.rows ?? []).map(([code, views]) => [String(code), Number(views)] as const).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  const pct = (v: number) => Math.round((v / total) * 100);
  const top = rows.slice(0, 3).map(([code, v]): [string, number] => [COUNTRY[code] ?? code, pct(v)]);
  const rest = 100 - top.reduce((s, [, v]) => s + v, 0);
  const geo = total ? (rows.length > 3 && rest > 0 ? [...top, ["Other", rest] as [string, number]] : top) : [];

  const ret = retention.rows?.[0]?.[0];
  return {
    age: ageGender.rows?.length ? age.map(Math.round) : [],
    male: ageGender.rows?.length ? Math.round(male) : null,
    geo,
    avgViewPct: ret === undefined ? null : Math.round(Number(ret) * 10) / 10,
  };
}
