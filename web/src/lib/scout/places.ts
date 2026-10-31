// Formats and places: Shorts vs long videos from video length, and Indian cities from text. Pure; used at ingest,
// in briefs and in tests.

/** ISO 8601 video length from the YouTube API ("PT1M5S", "PT1H2M", "P0D") → seconds; null if missing or unreadable. */
export function durationSeconds(iso?: string): number | null {
  const m = iso?.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

/**
 * A YouTube Short: up to 60 s, or up to 3 minutes (YouTube's Shorts limit since Oct 2024) when it says #shorts.
 * Length alone can't tell a 2-minute Short from a 2-minute video; null when the length isn't known.
 */
export function isShort(seconds: number | null, text = ""): boolean | null {
  if (seconds === null) return null;
  return seconds > 0 && (seconds <= 60 || (seconds <= 180 && /#shorts?\b/i.test(text)));
}

/** Indian cities by the name ScoutBlack shows, with the other names people write ("Bangalore", "Bombay", "Gurgaon"). */
const CITY_NAMES: [string, string[]][] = [
  ["Mumbai", ["bombay"]], ["Delhi", ["new delhi"]], ["Bengaluru", ["bangalore"]], ["Hyderabad", []], ["Chennai", ["madras"]],
  ["Kolkata", ["calcutta"]], ["Pune", []], ["Ahmedabad", []], ["Jaipur", []], ["Lucknow", []], ["Kochi", ["cochin"]],
  ["Chandigarh", []], ["Indore", []], ["Surat", []], ["Goa", []], ["Noida", []], ["Gurugram", ["gurgaon"]], ["Nagpur", []],
  ["Bhopal", []], ["Patna", []], ["Coimbatore", []], ["Visakhapatnam", ["vizag"]], ["Mysuru", ["mysore"]],
  ["Thiruvananthapuram", ["trivandrum"]], ["Vadodara", ["baroda"]], ["Ludhiana", []], ["Amritsar", []], ["Kanpur", []],
  ["Varanasi", ["banaras"]], ["Guwahati", []], ["Bhubaneswar", []], ["Madurai", []], ["Nashik", []], ["Rajkot", []],
  ["Ranchi", []], ["Dehradun", []], ["Udaipur", []], ["Agra", []], ["Mangaluru", ["mangalore"]], ["Kozhikode", ["calicut"]],
  ["Thrissur", []], ["Vijayawada", []], ["Raipur", []], ["Navi Mumbai", []], ["Thane", []],
];
export const CITIES = CITY_NAMES.map(([name]) => name);
const PATTERNS = CITY_NAMES.map(([name, alts]): [string, RegExp] =>
  [name, new RegExp(String.raw`(?<![\p{L}])(?:${[name, ...alts].map((n) => n.toLowerCase().replace(/ /g, "\\s+")).join("|")})(?![\p{L}])`, "iu")]);

/** Cities named in a text, by display name ("best street food in bombay" → ["Mumbai"]). "Navi Mumbai" isn't also "Mumbai". */
export function citiesIn(text: string): string[] {
  const found = PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name);
  return found.filter((c) => !found.some((o) => o !== c && o.endsWith(` ${c}`)));
}

/** A city as typed or reported ("bangalore", "Bengaluru, Karnataka") → its display name, or null if not one we know. */
export const canonCity = (raw: string): string | null => citiesIn(raw)[0] ?? null;

/**
 * Cities a channel says it's about: named in its description, or in at least 2 recent titles (one travel vlog to Goa
 * isn't a Goa channel). Inferred from text, so it's shown as "mentions", never as where the creator lives.
 */
export function cityMentions(about: string, titles: string[]): string[] {
  const inTitles = new Map<string, number>();
  for (const t of titles) for (const c of citiesIn(t)) inTitles.set(c, (inTitles.get(c) ?? 0) + 1);
  return [...new Set([...citiesIn(about), ...[...inTitles].filter(([, n]) => n >= 2).map(([c]) => c)])];
}
