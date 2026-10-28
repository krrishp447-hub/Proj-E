import "server-only";
import { site } from "@/config/site";
import { audienceFrom, type Audience, type Report } from "@/lib/scout/audience";

// Google OAuth 2.0 (authorization-code flow, confidential client) + the owner-only YouTube APIs it unlocks.
const BASE_SCOPES = ["openid", "email", "profile"];
// Read-only. Creators only: lets ScoutBlack confirm which channel they own and read its private audience analytics.
const CREATOR_SCOPES = ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/yt-analytics.readonly"];

export type Role = "creator" | "brand";

function client() {
  const id = process.env.GOOGLE_CLIENT_ID, secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  return { id, secret, redirect: `${site.url}/api/auth/google/callback` };
}

export function authUrl(role: Role, state: string): string {
  const c = client();
  return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: c.id, redirect_uri: c.redirect, response_type: "code", state,
    scope: [...BASE_SCOPES, ...(role === "creator" ? CREATOR_SCOPES : [])].join(" "),
    // creators: offline access (a refresh token) so the audience can re-sync nightly; consent so Google re-issues it
    ...(role === "creator" ? { access_type: "offline", prompt: "consent" } : { prompt: "select_account" }),
  })}`;
}

type Tokens = { access_token: string; refresh_token?: string; scope: string };

async function token(params: Record<string, string>): Promise<Tokens> {
  const c = client();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, ...params }),
  });
  if (!res.ok) {
    // body may echo request details — keep only its error code ("invalid_grant" = the grant was revoked or expired)
    const code = ((await res.json().catch(() => ({}))) as { error?: unknown }).error;
    throw Object.assign(new Error(`Google token ${res.status}`), { code: typeof code === "string" ? code : undefined });
  }
  return res.json() as Promise<Tokens>;
}

/** True only when Google says the refresh token is no longer valid (revoked by the user, or expired). */
export const isRevoked = (e: unknown) => (e as { code?: string })?.code === "invalid_grant";

export const exchangeCode = (code: string) => token({ code, grant_type: "authorization_code", redirect_uri: client().redirect });
export const refreshAccess = async (refreshToken: string) => (await token({ refresh_token: refreshToken, grant_type: "refresh_token" })).access_token;
export const grantedCreatorScopes = (t: Tokens) => CREATOR_SCOPES.every((s) => t.scope.split(" ").includes(s));

async function get<T>(url: string, access: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Google API ${new URL(url).pathname} ${res.status}`);
  return res.json() as Promise<T>;
}

export const userInfo = (access: string) =>
  get<{ sub: string; email: string; name?: string }>("https://openidconnect.googleapis.com/v1/userinfo", access);

/** The channel the signed-in Google account owns (null if it has none). */
export async function myChannel(access: string): Promise<{ id: string; title: string } | null> {
  const r = await get<{ items?: { id: string; snippet: { title: string } }[] }>("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", access);
  const ch = r.items?.[0];
  return ch ? { id: ch.id, title: ch.snippet.title } : null;
}

/** Last 90 days of owner-only audience analytics (YouTube Analytics API — its own quota, not the Data API's). */
export async function fetchAudience(access: string): Promise<Audience> {
  const day = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
  const report = (q: Record<string, string>) =>
    get<Report>(`https://youtubeanalytics.googleapis.com/v2/reports?${new URLSearchParams({ ids: "channel==MINE", startDate: day(90), endDate: day(1), ...q })}`, access);
  const [ageGender, countries, retention] = await Promise.all([
    report({ metrics: "viewerPercentage", dimensions: "ageGroup,gender" }),
    report({ metrics: "views", dimensions: "country", sort: "-views", maxResults: "25" }),
    report({ metrics: "averageViewPercentage" }),
  ]);
  return audienceFrom(ageGender, countries, retention);
}

/** Revoke ScoutBlack's access at Google (on disconnect / account deletion). Best effort: the token may already be gone. */
export async function revoke(tokenValue: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?${new URLSearchParams({ token: tokenValue })}`, { method: "POST" }).catch(() => {});
}
