// Apply db/schema.sql to the database in DATABASE_URL.
//   npm run db:migrate          (reads .env.local)
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (add it to .env.local, or run `vercel env pull .env.local`)");
const sql = neon(url);

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of schema) await sql.query(statement); // HTTP driver: one statement per call
console.log(`Applied ${schema.length} statements.`);
