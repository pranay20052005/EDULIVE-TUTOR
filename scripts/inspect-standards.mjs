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

  console.log("=== ALL SUBJECTS IN DATABASE ===");
  const subjectsRes = await client.query(`
    SELECT *
    FROM subjects
    ORDER BY standard, name;
  `);
  console.table(subjectsRes.rows);

  console.log("\n=== ALL STUDENTS IN DATABASE ===");
  const studentsRes = await client.query(`
    SELECT s.id, s.user_id, s.standard, s.board, u.name, u.email
    FROM students s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC
    LIMIT 10;
  `);
  console.table(studentsRes.rows);

  await client.end();
}

main();
