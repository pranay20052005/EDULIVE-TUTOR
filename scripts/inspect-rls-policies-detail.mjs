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

  console.log("=== RLS POLICIES FOR STUDENTS, TEACHERS, USERS, ADMINS ===");
  const res = await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename IN ('students', 'teachers', 'users', 'admins', 'test_attempts', 'attendance')
    ORDER BY tablename, cmd;
  `);
  console.table(res.rows);

  console.log("\n=== ADMINS TABLE CONTENT ===");
  const adminRes = await client.query(`SELECT * FROM admins;`);
  console.table(adminRes.rows);

  await client.end();
}

main();
