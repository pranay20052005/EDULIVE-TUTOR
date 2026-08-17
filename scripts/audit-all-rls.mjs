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
  console.log("✓ Connected to Supabase PostgreSQL");

  // 1. Tables and RLS status
  const tablesRes = await client.query(`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);
  console.log("\n=== TABLES & RLS STATUS ===");
  console.table(tablesRes.rows);

  // 2. All policies in public schema
  const polRes = await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, cmd, policyname;
  `);
  console.log("\n=== ALL POLICIES IN PUBLIC SCHEMA ===");
  console.table(
    polRes.rows.map((r) => ({
      table: r.tablename,
      policy: r.policyname,
      cmd: r.cmd,
      roles: Array.isArray(r.roles) ? r.roles.join(", ") : String(r.roles),
      qual: (r.qual || "").slice(0, 50),
      with_check: (r.with_check || "").slice(0, 50),
    })),
  );

  // 3. Enums
  const enumRes = await client.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder;
  `);
  console.log("\n=== ALL ENUMS ===");
  console.table(enumRes.rows);

  await client.end();
}

main();
