import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { sql } from "./db";

// One secret (AUTH_SECRET) signs session cookies and, through a derived key, encrypts stored OAuth refresh tokens.
function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ random characters)");
  return s;
}
const tokenKey = () => createHash("sha256").update(`scout-token-key:${secret()}`).digest(); // 32 bytes → AES-256
const b64 = (b: Buffer) => b.toString("base64url");

/** Encrypt a refresh token for storage (AES-256-GCM: iv.tag.ciphertext). */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b64).join(".");
}

/** Decrypt a stored token, or null if it can't be (corrupted, or sealed under a previous AUTH_SECRET). Never throws. */
export function unseal(sealed: string): string | null {
  try {
    const [iv, tag, enc] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", tokenKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "scout_session";
const SESSION_DAYS = 30;
const sign = (v: string) => b64(createHmac("sha256", secret()).update(v).digest());

/**
 * Cookie value: userId.sessionVersion.expiresMs.signature. The version must match users.session_version, so bumping it
 * (sign-out) ends every session at once, including a stolen cookie.
 */
export function sessionValue(userId: string, version: number): string {
  const v = `${userId}.${version}.${Date.now() + SESSION_DAYS * 86_400_000}`;
  return `${v}.${sign(v)}`;
}

export const sessionCookie = (value: string, maxAge = SESSION_DAYS * 86_400) => ({
  name: SESSION_COOKIE, value, httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge,
});

function sessionFrom(value: string | undefined): { id: string; version: number } | null {
  const [id, ver, exp, sig] = value?.split(".") ?? [];
  if (!id || !ver || !exp || !sig) return null;
  const want = Buffer.from(sign(`${id}.${ver}.${exp}`)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return Number(exp) > Date.now() ? { id, version: Number(ver) } : null;
}

/** End every session of this user (sign-out): existing cookies stop matching their session version. */
export async function endSessions(userId: string) {
  if (sql) await sql`update users set session_version = session_version + 1 where id = ${userId}`;
}

/**
 * Destructive POSTs (sign-out, disconnect, delete) only from Scout's own pages. SameSite=Lax already keeps the session
 * cookie off cross-site form posts; this checks the Origin / Fetch-Metadata headers as a second layer.
 */
export function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}

export type User = { id: string; email: string; name: string; role: "creator" | "brand"; onboarded: boolean; channelId: string | null };

/** The signed-in user, or null. Reads the session cookie, so call it inside a Suspense boundary / dynamic route. */
export async function currentUser(): Promise<User | null> {
  await connection(); // request-time only: the expiry check below reads the clock
  const s = sessionFrom((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s || !sql) return null;
  const id = s.id;
  const [u] = (await sql`
    select u.id, u.email, u.name, u.role, u.onboarded_at is not null as onboarded, u.session_version, cc.channel_id
    from users u left join channel_connections cc on cc.user_id = u.id where u.id = ${id}`) as {
    id: string; email: string; name: string; role: "creator" | "brand"; onboarded: boolean; session_version: number; channel_id: string | null;
  }[];
  if (!u || u.session_version !== s.version) return null; // signed out everywhere since this cookie was issued
  return u ? { id: u.id, email: u.email, name: u.name, role: u.role, onboarded: u.onboarded, channelId: u.channel_id } : null;
}
