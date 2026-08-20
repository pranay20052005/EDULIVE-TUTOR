import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const pgClient = new pg.Client({
  host: "aws-0-ap-south-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.jrknrglxivqmddoqqcjh",
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await pgClient.connect();
  console.log("✓ Connected to Postgres");

  // 1. Foreign keys
  const fkRes = await pgClient.query(`
    SELECT
      tc.table_name, 
      kcu.column_name, 
      tc.constraint_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name IN ('enrollments', 'payments', 'students', 'teachers', 'scheduled_classes')
    ORDER BY tc.table_name, kcu.column_name;
  `);
  console.log("\n=== FOREIGN KEYS ===");
  console.table(fkRes.rows);

  // 2. Users
  const usersRes = await pgClient.query(
    "SELECT id, email, role, name, phone FROM users ORDER BY created_at;",
  );
  console.log("\n=== USERS ===");
  console.table(usersRes.rows);

  // 3. Students
  const studentsRes = await pgClient.query("SELECT id, user_id, board, standard FROM students;");
  console.log("\n=== STUDENTS ===");
  console.table(studentsRes.rows);

  // 4. Teachers
  const teachersRes = await pgClient.query("SELECT id, user_id, qualification FROM teachers;");
  console.log("\n=== TEACHERS ===");
  console.table(teachersRes.rows);

  // 5. Enrollments
  const enrollRes = await pgClient.query(
    "SELECT id, student_id, subject_id, status, enrollment_type, payment_id FROM enrollments;",
  );
  console.log("\n=== ENROLLMENTS ===");
  console.table(enrollRes.rows);

  // 6. Payments
  const payRes = await pgClient.query(
    "SELECT id, student_id, subject_id, amount_inr, status, provider, provider_order_id, provider_payment_id FROM payments;",
  );
  console.log("\n=== PAYMENTS ===");
  console.table(payRes.rows);

  // 7. Scheduled Classes
  const classRes = await pgClient.query(
    "SELECT id, title, topic, subject_id, teacher_id, status, meeting_url, starts_at, ends_at FROM scheduled_classes;",
  );
  console.log("\n=== SCHEDULED CLASSES ===");
  console.table(classRes.rows);

  await pgClient.end();
}

main().catch(console.error);
