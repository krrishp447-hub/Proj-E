import "server-only";
import { site } from "@/config/site";
import { sign, type User } from "./auth";
import { sql } from "./db";

// A creator's public business email is personal data (DPDP Act): shown only to signed-in brands, one channel at a time,
// a limited number per day, never once the creator manages contact on ScoutBlack or asked for it to be removed.
export const REVEALS_PER_DAY = 25;
const INVITES_PER_CHANNEL_PER_WEEK = 3;

function db() {
  if (!sql) throw new Error("DATABASE_URL is not set");
  return sql;
}

export type Reveal = { email: string } | { error: "none" | "limit" };

export async function revealContact(u: User, channelId: string): Promise<Reveal> {
  const q = db();
  const [c] = (await q`
    select c.public_email from creators c
    where c.channel_id = ${channelId} and c.public_email is not null
      and not exists (select 1 from channel_connections x where x.channel_id = c.channel_id)
      and not exists (select 1 from contact_optouts o where o.channel_id = c.channel_id)`) as { public_email: string }[];
  if (!c) return { error: "none" };
  // re-opening a channel already revealed today is free; new channels count against the daily limit
  const [seen] = (await q`select 1 from contact_reveals where brand_id = ${u.id} and channel_id = ${channelId} and revealed_on = current_date`) as unknown[];
  if (!seen) {
    const [{ n }] = (await q`select count(*)::int as n from contact_reveals where brand_id = ${u.id} and revealed_on = current_date`) as { n: number }[];
    if (n >= REVEALS_PER_DAY) return { error: "limit" };
    await q`insert into contact_reveals (brand_id, channel_id) values (${u.id}, ${channelId}) on conflict do nothing`;
  }
  return { email: c.public_email };
}

/** "Remove my contact": stop showing the channel's email (anyone may ask; it only ever hides data). */
export async function removeContact(input: string): Promise<string | null> {
  const q = db();
  const id = input.match(/UC[\w-]{22}/)?.[0];
  const handle = input.match(/@[\w.-]{3,}/)?.[0]?.toLowerCase();
  const [c] = (await q`select channel_id from creators where channel_id = ${id ?? ""} or lower(handle) = ${handle ?? "-"} limit 1`) as { channel_id: string }[];
  if (!c) return null;
  await q`insert into contact_optouts (channel_id) values (${c.channel_id}) on conflict do nothing`;
  await q`update creators set public_email = null where channel_id = ${c.channel_id}`;
  return c.channel_id;
}

const unsubscribeToken = (email: string) => sign(`unsubscribe:${email}`);
export const unsubscribeUrl = (email: string) => `${site.url}/unsubscribe?e=${encodeURIComponent(email)}&t=${encodeURIComponent(unsubscribeToken(email))}`;

export async function unsubscribe(email: string, token: string): Promise<boolean> {
  if (!email || token !== unsubscribeToken(email)) return false;
  await db()`insert into email_unsubscribes (email) values (${email.toLowerCase()}) on conflict do nothing`;
  return true;
}

/** Send through Resend's HTTP API. Without RESEND_API_KEY / EMAIL_FROM nothing is sent (returns false). */
async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  if (!key || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, headers: { "List-Unsubscribe": `<${unsubscribeUrl(to)}>` } }),
  });
  return res.ok;
}

export type InviteResult = "sent" | "already" | "limit" | "unavailable" | "off";

/**
 * Offers need a claimed channel, so for a creator who isn't on ScoutBlack yet a brand can invite them: one email to the address
 * the creator published, saying a brand wants to work with them (never who or what: the address isn't verified). One
 * email per channel per brand, at most a few per channel per week across brands, never to an unsubscribed address.
 */
export async function inviteCreator(channelId: string, brandId: string): Promise<InviteResult> {
  try {
    const q = db();
    const [prev] = (await q`select 1 from contact_invites where channel_id = ${channelId} and brand_id = ${brandId}`) as unknown[];
    if (prev) return "already";
    const [c] = (await q`
      select c.name, c.public_email from creators c
      where c.channel_id = ${channelId} and c.public_email is not null
        and not exists (select 1 from channel_connections x where x.channel_id = c.channel_id)
        and not exists (select 1 from contact_optouts o where o.channel_id = c.channel_id)
        and not exists (select 1 from email_unsubscribes u where u.email = c.public_email)
`) as { name: string; public_email: string }[];
    if (!c) return "unavailable"; // claimed meanwhile, no public email, opted out or unsubscribed
    const [{ n }] = (await q`select count(*)::int as n from contact_invites where channel_id = ${channelId} and sent_at > now() - interval '7 days'`) as { n: number }[];
    if (n >= INVITES_PER_CHANNEL_PER_WEEK) return "limit";
    const sent = await sendEmail(c.public_email, "A brand wants to work with you on ScoutBlack",
      [
        `Hi ${c.name},`,
        "",
        "A brand on ScoutBlack wants to work with your YouTube channel.",
        "Claim your channel to receive their offer: sign in with Google and connect YouTube (this proves the channel is yours).",
        "",
        `Claim your channel: ${site.url}/api/auth/google/start?role=creator`,
        "",
        "We found this address in your channel's public description. We won't email you about the same brand again.",
        `Don't want these emails? ${unsubscribeUrl(c.public_email)}`,
      ].join("\n"));
    if (!sent) return "off"; // no email provider configured (RESEND_API_KEY / EMAIL_FROM)
    await q`insert into contact_invites (channel_id, brand_id) values (${channelId}, ${brandId}) on conflict do nothing`;
    return "sent";
  } catch (e) {
    console.error("invite failed", e instanceof Error ? e.message : e);
    return "off";
  }
}
