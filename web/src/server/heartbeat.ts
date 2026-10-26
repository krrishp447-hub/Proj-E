import "server-only";

/**
 * Tell an outside monitor how the nightly job went (healthchecks.io: HEALTHCHECK_URL = the check's ping URL). A missing
 * ping (the job never ran) or a /fail ping (it ran but something's wrong) emails the owner. No URL set: does nothing.
 * Never throws: monitoring must not break the job it watches.
 */
export async function heartbeat(ok: boolean, message: string) {
  const url = process.env.HEALTHCHECK_URL;
  if (!url) return;
  await fetch(ok ? url : `${url.replace(/\/$/, "")}/fail`, { method: "POST", body: message.slice(0, 10_000), signal: AbortSignal.timeout(5_000) }).catch(() => {});
}

export const DB_WARN_BYTES = 400 * 1024 * 1024; // of Neon's free 512 MB: time to trim or upgrade
