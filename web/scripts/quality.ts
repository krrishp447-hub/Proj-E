// Data-quality audits (segregation + calculations), see src/lib/scout/audit.ts.
//   npm run quality            recent audit history (the ingest audits every 100 new creators automatically)
//   npm run quality -- --now   audit the most recent 100 creators right now and print the result
import { neon } from "@neondatabase/serverless";
import { freshnessCheck, runAudits } from "../src/server/audit.ts";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error("Set DATABASE_URL in .env.local");
const sql = neon(DATABASE_URL);

const print = (r: { from: number; to: number; passed: boolean; checks: { name: string; passed: boolean; summary: string; failures: string[] }[] }, when = "") => {
  console.log(`\n${r.passed ? "PASS" : "FAIL"}  creators #${r.from + 1}–${r.to}${when}`);
  for (const c of r.checks) {
    console.log(`  ${c.passed ? "✓" : "✗"} ${c.name}: ${c.summary}`);
    for (const f of c.failures) console.log(`      · ${f}`);
  }
};

const fresh = await freshnessCheck(sql);
console.log(`${fresh.passed ? "✓" : "✗"} ${fresh.name}: ${fresh.summary}`);
for (const f of fresh.failures) console.log(`    · ${f}`);

if (process.argv.includes("--now")) {
  for (const r of await runAudits(sql, { latest: true })) print(r, " (on demand)");
} else {
  const rows = (await sql`select run_at::text, from_n, to_n, passed, checks from quality_audits order by to_n desc, id desc limit 5`) as
    { run_at: string; from_n: number; to_n: number; passed: boolean; checks: { name: string; passed: boolean; summary: string; failures: string[] }[] }[];
  if (!rows.length) console.log("No audits yet: the next ingest sets the baseline, then audits every 100 new creators.");
  for (const r of rows) print({ from: r.from_n, to: r.to_n, passed: r.passed, checks: r.checks }, ` · ${r.run_at.slice(0, 16)}`);
}
