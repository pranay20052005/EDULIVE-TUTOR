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

  const tables = [
    "chapters",
    "question_papers",
    "assignment_submissions",
    "test_questions",
    "test_answers",
    "announcements",
    "subscription_plans",
    "settings",
  ];

  for (const t of tables) {
    const res = await client.query(
      `
      SELECT policyname, cmd, roles, qual, with_check
      FROM pg_policies
      WHERE tablename = $1;
    `,
      [t],
    );
    console.log(`\nTable [${t}]: ${res.rows.length} policies`);
    for (const r of res.rows) {
      console.log(`  - ${r.policyname} (${r.cmd})`);
    }
  }

  await client.end();
}

main();
