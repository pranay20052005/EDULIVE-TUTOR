import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
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
  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL");
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        "..",
        "supabase",
        "migrations",
        "20250818000001_production_rls_lockdown.sql",
      ),
      "utf8",
    );
    console.log("Applying 20250818000001_production_rls_lockdown.sql...");
    await client.query(sql);
    console.log("✅ Successfully applied 20250818000001_production_rls_lockdown.sql");
  } catch (err) {
    console.error("❌ Error applying migration:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
