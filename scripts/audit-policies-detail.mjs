import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const client = new Client({
  host: "aws-0-ap-south-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.jrknrglxivqmddoqqcjh",
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();

  const polRes = await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, cmd, policyname;
  `);

  console.log("TOTAL POLICIES:", polRes.rows.length);
  for (const r of polRes.rows) {
    console.log(
      `\nTable: [${r.tablename}] | Policy: [${r.policyname}] | Cmd: [${r.cmd}] | Roles: [${r.roles}]`,
    );
    if (r.qual) console.log(`  USING: ${r.qual}`);
    if (r.with_check) console.log(`  WITH CHECK: ${r.with_check}`);
  }

  await client.end();
}

main();
