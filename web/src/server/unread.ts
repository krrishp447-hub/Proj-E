import "server-only";
import { sql } from "./db";

/** Remember a brief Scout couldn't read, so the word maps can learn from real searches. Never fails a search. */
export async function logUnread(query: string) {
  const q = query.trim().toLowerCase().slice(0, 200);
  if (!sql || !q) return;
  // anyone can search: cap the table so junk can't grow it without bound
  await sql`
    insert into unread_searches (query) select ${q} where (select count(*) from unread_searches) < 10000
    on conflict (query) do update set n = unread_searches.n + 1, last_at = now()`.catch(() => {});
}
