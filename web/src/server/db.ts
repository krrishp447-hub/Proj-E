import "server-only";
import { neon } from "@neondatabase/serverless";

/** Postgres over HTTP (Neon via the Vercel Marketplace). Null until DATABASE_URL is configured. */
export const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
