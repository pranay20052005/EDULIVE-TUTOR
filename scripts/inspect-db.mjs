import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const projectIdMatch = SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/);
const projectId = projectIdMatch ? projectIdMatch[1] : null;

const dbConfig = {
  host: `db.${projectId}.pooler.supabase.com`,
  port: 6543,
  database: "postgres",
  user: "postgres",
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

async function main() {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    console.log("✓ Connected to Postgres");

    // 1. Check policies on enrollments and payments
    const policiesRes = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename IN ('enrollments', 'payments', 'users', 'students', 'teachers')
      ORDER BY tablename, policyname;
    `);
    console.log("\n=== RLS POLICIES ===");
    console.table(
      policiesRes.rows.map((r) => ({
        table: r.tablename,
        policy: r.policyname,
        cmd: r.cmd,
        roles: r.roles,
      })),
    );

    // 2. Check enums
    const enumRes = await client.query(`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname IN ('payment_status', 'enrollment_status', 'user_role', 'publish_status')
      ORDER BY t.typname, e.enumsortorder;
    `);
    console.log("\n=== ENUMS ===");
    console.table(enumRes.rows);

    // 3. Check existing users
    const usersRes = await client.query(`
      SELECT id, email, role, name FROM users;
    `);
    console.log("\n=== USERS ===");
    console.table(usersRes.rows);

    // 4. Check existing teachers
    const teachersRes = await client.query(`
      SELECT t.id, t.user_id, u.email, u.name
      FROM teachers t
      JOIN users u ON t.user_id = u.id;
    `);
    console.log("\n=== TEACHERS ===");
    console.table(teachersRes.rows);

    // 5. Check existing students
    const studentsRes = await client.query(`
      SELECT s.id, s.user_id, u.email, u.name
      FROM students s
      JOIN users u ON s.user_id = u.id;
    `);
    console.log("\n=== STUDENTS ===");
    console.table(studentsRes.rows);

    // 6. Check existing subjects
    const subjectsRes = await client.query(`
      SELECT id, name, price_inr, teacher_id, status FROM subjects;
    `);
    console.log("\n=== SUBJECTS ===");
    console.table(subjectsRes.rows);

    // 7. Check enrollments
    const enrollmentsRes = await client.query(`
      SELECT * FROM enrollments;
    `);
    console.log("\n=== ENROLLMENTS ===");
    console.table(enrollmentsRes.rows);

    // 8. Check payments
    const paymentsRes = await client.query(`
      SELECT * FROM payments;
    `);
    console.log("\n=== PAYMENTS ===");
    console.table(paymentsRes.rows);
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await client.end();
  }
}

main();
