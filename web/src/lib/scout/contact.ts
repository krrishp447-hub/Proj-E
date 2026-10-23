// Ways to reach a creator. Pure. Only what the creator published themselves: channel links, and an email they wrote
// in their own channel or video description. YouTube's hidden "View email address" (sign-in + CAPTCHA) is never read.

export const youtubeUrl = (channelId: string) => `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`;
export const aboutUrl = (channelId: string) => `${youtubeUrl(channelId)}/about`;

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const BUSINESS = /business|enquir|inquir|collab|sponsor|promotion|brand|contact|partnership|work with/i;
const JUNK = /noreply|no-reply|example\.|@(?:sentry|wixpress)\.|\.(?:png|jpe?g|gif|webp)$/i;

/** The creator's public business email: one on a line that says business/collab/contact wins, else the first one. */
export function publicEmail(texts: string[]): string | null {
  let first: string | null = null;
  for (const text of texts) {
    for (const line of text.split(/\n/)) {
      for (const m of line.match(EMAIL) ?? []) {
        const email = m.toLowerCase().replace(/\.+$/, "");
        if (JUNK.test(email)) continue;
        if (BUSINESS.test(line)) return email;
        first ??= email;
      }
    }
  }
  return first;
}
