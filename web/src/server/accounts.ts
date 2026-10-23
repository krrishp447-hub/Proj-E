import "server-only";
import { seal, unseal } from "./auth";
import { sql } from "./db";
import { exchangeCode, fetchAudience, grantedCreatorScopes, myChannel, refreshAccess, revoke, userInfo, type Role } from "./google";
import { runIngest } from "./ingest";

function db() {
  if (!sql) throw new Error("DATABASE_URL is not set");
  return sql;
}

export type SignInError = "scopes" | "no-channel" | "taken" | "no-refresh";
export type SignInResult = { userId: string; sessionVersion: number; error?: undefined } | { userId?: undefined; error: SignInError };

/**
 * Finish Google sign-in. An account's role is fixed by its first sign-in. Creators must grant the YouTube scopes
 * and own a channel; the channel is then connected (refresh token sealed), tracked, ingested and its audience synced.
 */
export async function signIn(code: string, requested: Role): Promise<SignInResult> {
  const q = db();
  const tokens = await exchangeCode(code);
  const me = await userInfo(tokens.access_token);
  const [existing] = (await q`select id, role from users where google_sub = ${me.sub}`) as { id: string; role: Role }[];
  const role = existing?.role ?? requested;

  let channel: { id: string; title: string } | null = null;
  // A creator who already connected their channel can sign in through any button (e.g. a brand plan on /pricing):
  // they don't need to grant YouTube access again. Only new or unconnected creators must.
  const [connected] = existing ? ((await q`select 1 from channel_connections where user_id = ${existing.id}`) as unknown[]) : [];
  if (role === "creator" && !(connected && !grantedCreatorScopes(tokens))) {
    if (!grantedCreatorScopes(tokens)) return { error: "scopes" };
    channel = await myChannel(tokens.access_token);
    if (!channel) return { error: "no-channel" };
    const [owner] = (await q`
      select u.google_sub from channel_connections cc join users u on u.id = cc.user_id where cc.channel_id = ${channel.id}`) as { google_sub: string }[];
    if (owner && owner.google_sub !== me.sub) return { error: "taken" };
    if (!tokens.refresh_token) return { error: "no-refresh" };
  }

  const [user] = (await q`
    insert into users (google_sub, email, name, role) values (${me.sub}, ${me.email}, ${me.name ?? ""}, ${role})
    on conflict (google_sub) do update set email = excluded.email, name = excluded.name
    returning id, session_version`) as { id: string; session_version: number }[];

  if (channel && tokens.refresh_token) {
    await q`
      insert into channel_connections (channel_id, user_id, refresh_token) values (${channel.id}, ${user.id}, ${seal(tokens.refresh_token)})
      on conflict (channel_id) do update set refresh_token = excluded.refresh_token, connected_at = now()`;
    await q`insert into channel_seeds (channel_id, note) values (${channel.id}, 'claimed') on conflict (channel_id) do update set active = true`;
    await runIngest(1, [channel.id]).catch(() => {}); // public stats now; the nightly ingest retries if the quota is spent
    await syncAudience(channel.id, tokens.access_token).catch(() => {}); // the nightly sync retries
  }
  return { userId: user.id, sessionVersion: user.session_version };
}

async function syncAudience(channelId: string, access: string) {
  const a = await fetchAudience(access);
  await db()`
    update channel_connections set age = ${a.age}, male = ${a.male}, geo = ${JSON.stringify(a.geo)}::jsonb,
      avg_view_pct = ${a.avgViewPct}, synced_at = now() where channel_id = ${channelId}`;
}

/**
 * Nightly: refresh every connected channel's audience. A refresh token Google rejects means the creator revoked
 * access from their Google account — the connection and its private data are deleted, as the privacy policy says.
 */
export async function syncAudiences(): Promise<{ synced: number; revoked: number; failed: number }> {
  const rows = (await db()`
    select channel_id, refresh_token from channel_connections
    where synced_at is null or synced_at < now() - interval '20 hours'`) as { channel_id: string; refresh_token: string }[];
  const out = { synced: 0, revoked: 0, failed: 0 };
  for (const r of rows) {
    let access: string;
    try {
      const token = unseal(r.refresh_token);
      if (!token) throw new Error("unreadable token"); // sealed under an old AUTH_SECRET: treat as revoked
      access = await refreshAccess(token);
    } catch {
      await db()`delete from channel_connections where channel_id = ${r.channel_id}`;
      out.revoked++;
      continue;
    }
    try {
      await syncAudience(r.channel_id, access);
      out.synced++;
    } catch {
      out.failed++;
    }
  }
  return out;
}

/** Revoke Google access and delete the connection with its private audience data. The public profile stays. */
export async function disconnectChannel(userId: string) {
  const [c] = (await db()`delete from channel_connections where user_id = ${userId} returning refresh_token`) as { refresh_token: string }[];
  const token = c ? unseal(c.refresh_token) : null;
  if (token) await revoke(token); // an unreadable token can't be revoked, but the connection is deleted either way
}

/** Delete the account and everything tied to it (profiles cascade). */
export async function deleteAccount(userId: string) {
  await disconnectChannel(userId);
  // a brand's brands row (and through it, its deals and offers) has no FK to users: remove it explicitly
  await db()`delete from brands where id = ${userId}`;
  await db()`delete from users where id = ${userId}`;
}

export type CreatorProfile = { focus: string[]; languages: string[]; rateVideo: number | null; rateShort: number | null; openToCollabs: boolean };
export type BrandProfile = { company: string; kind: "brand" | "agency"; website: string | null; category: string | null; brief: string | null; budget: string | null; tracked: string[]; pitchable: boolean };

export async function saveCreatorProfile(userId: string, p: CreatorProfile) {
  await db()`
    insert into creator_profiles (user_id, focus, languages, rate_video, rate_short, open_to_collabs)
    values (${userId}, ${p.focus}, ${p.languages}, ${p.rateVideo}, ${p.rateShort}, ${p.openToCollabs})
    on conflict (user_id) do update set focus = excluded.focus, languages = excluded.languages, rate_video = excluded.rate_video,
      rate_short = excluded.rate_short, open_to_collabs = excluded.open_to_collabs, updated_at = now()`;
  await db()`update users set onboarded_at = coalesce(onboarded_at, now()) where id = ${userId}`;
}

export async function saveBrandProfile(userId: string, p: BrandProfile) {
  await db()`
    insert into brand_profiles (user_id, company, kind, website, category, brief, budget, tracked, pitchable)
    values (${userId}, ${p.company}, ${p.kind}, ${p.website}, ${p.category}, ${p.brief}, ${p.budget}, ${p.tracked}, ${p.pitchable})
    on conflict (user_id) do update set company = excluded.company, kind = excluded.kind, website = excluded.website,
      category = excluded.category, brief = excluded.brief, budget = excluded.budget, tracked = excluded.tracked, pitchable = excluded.pitchable, updated_at = now()`;
  await db()`update users set onboarded_at = coalesce(onboarded_at, now()) where id = ${userId}`;
}

export async function getCreatorProfile(userId: string) {
  const [p] = (await db()`select * from creator_profiles where user_id = ${userId}`) as
    { focus: string[]; languages: string[]; rate_video: number | null; rate_short: number | null; open_to_collabs: boolean }[];
  return p ? { focus: p.focus, languages: p.languages, rateVideo: p.rate_video, rateShort: p.rate_short, openToCollabs: p.open_to_collabs } : null;
}

export async function getBrandProfile(userId: string): Promise<BrandProfile | null> {
  const [p] = (await db()`select company, kind, website, category, brief, budget, tracked, pitchable from brand_profiles where user_id = ${userId}`) as BrandProfile[];
  return p ?? null;
}

/** The connected channel's public stats + private audience, for the creator's own pages. */
export async function getMyChannel(channelId: string) {
  const [c] = (await db()`
    select cc.channel_id, cc.age, cc.male, cc.geo, cc.avg_view_pct, cc.synced_at, c.name, c.handle, c.niche, c.language, c.subs, c.avg_views, c.eng
    from channel_connections cc left join creators c using (channel_id) where cc.channel_id = ${channelId}`) as {
    channel_id: string; age: number[]; male: number | null; geo: [string, number][]; avg_view_pct: number | null; synced_at: string | null;
    name: string | null; handle: string | null; niche: string | null; language: string | null; subs: number | null; avg_views: number | null; eng: number | null;
  }[];
  return c ?? null;
}
