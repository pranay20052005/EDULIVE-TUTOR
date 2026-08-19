import pg from "pg";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !serviceKey || !dbPassword) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

const pgClient = new pg.Client({
  host: "aws-0-ap-south-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.jrknrglxivqmddoqqcjh",
  password: dbPassword,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log("==================================================");
  console.log("PROVISIONING STORAGE BUCKETS & RLS POLICIES");
  console.log("==================================================");

  // 1. Create storage buckets if missing
  const buckets = ["materials", "question-papers", "assignments", "recordings"];
  for (const bucketName of buckets) {
    const { data: existing, error: getErr } = await supabaseAdmin.storage.getBucket(bucketName);
    if (getErr || !existing) {
      console.log(`Creating bucket: ${bucketName}...`);
      const { error: createErr } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 52428800, // 50MB
      });
      if (createErr) {
        console.warn(`Warning creating bucket ${bucketName}:`, createErr.message);
      } else {
        console.log(`✓ Bucket ${bucketName} created successfully.`);
      }
    } else {
      console.log(`✓ Bucket ${bucketName} already exists.`);
      await supabaseAdmin.storage.updateBucket(bucketName, { public: true });
    }
  }

  // 2. Connect to Postgres to configure policies
  await pgClient.connect();
  console.log("Connected to PostgreSQL database.");

  console.log("\nApplying RLS policies for materials, assignments, question_papers...");

  const sqlStatements = [
    // ----------------------------------------------------
    // MATERIALS TABLE POLICIES
    // ----------------------------------------------------
    `DROP POLICY IF EXISTS "materials_insert_teacher" ON materials;`,
    `CREATE POLICY "materials_insert_teacher" ON materials
      FOR INSERT TO authenticated
      WITH CHECK (
        (created_by = auth.uid()) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      );`,

    `DROP POLICY IF EXISTS "materials_select_own_teacher" ON materials;`,
    `CREATE POLICY "materials_select_own_teacher" ON materials
      FOR SELECT TO authenticated
      USING (
        (created_by = auth.uid()) OR
        (EXISTS (
          SELECT 1 FROM subjects
          WHERE subjects.id = materials.subject_id
          AND subjects.teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())
        )) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      );`,

    `DROP POLICY IF EXISTS "materials_select_published" ON materials;`,
    `CREATE POLICY "materials_select_published" ON materials
      FOR SELECT TO public
      USING (status = 'published'::publish_status);`,

    `DROP POLICY IF EXISTS "materials_update_teacher_or_admin" ON materials;`,
    `CREATE POLICY "materials_update_teacher_or_admin" ON materials
      FOR UPDATE TO authenticated
      USING (
        (created_by = auth.uid()) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      )
      WITH CHECK (
        (created_by = auth.uid()) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      );`,

    `DROP POLICY IF EXISTS "materials_delete_teacher_or_admin" ON materials;`,
    `CREATE POLICY "materials_delete_teacher_or_admin" ON materials
      FOR DELETE TO authenticated
      USING (
        (created_by = auth.uid()) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      );`,

    // ----------------------------------------------------
    // ASSIGNMENTS TABLE POLICIES
    // ----------------------------------------------------
    `DROP POLICY IF EXISTS "assignments_insert_teacher" ON assignments;`,
    `CREATE POLICY "assignments_insert_teacher" ON assignments
      FOR INSERT TO authenticated
      WITH CHECK (
        (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      );`,

    `DROP POLICY IF EXISTS "assignments_select_own_teacher" ON assignments;`,
    `CREATE POLICY "assignments_select_own_teacher" ON assignments
      FOR SELECT TO authenticated
      USING (
        (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      );`,

    `DROP POLICY IF EXISTS "assignments_select_published" ON assignments;`,
    `CREATE POLICY "assignments_select_published" ON assignments
      FOR SELECT TO public
      USING (status = 'published'::publish_status);`,

    `DROP POLICY IF EXISTS "assignments_update_teacher_or_admin" ON assignments;`,
    `CREATE POLICY "assignments_update_teacher_or_admin" ON assignments
      FOR UPDATE TO authenticated
      USING (
        (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      )
      WITH CHECK (
        (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      );`,

    `DROP POLICY IF EXISTS "assignments_delete_teacher_or_admin" ON assignments;`,
    `CREATE POLICY "assignments_delete_teacher_or_admin" ON assignments
      FOR DELETE TO authenticated
      USING (
        (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      );`,

    // ----------------------------------------------------
    // QUESTION PAPERS TABLE POLICIES
    // ----------------------------------------------------
    `DROP POLICY IF EXISTS "question_papers_insert_teacher_or_admin" ON question_papers;`,
    `CREATE POLICY "question_papers_insert_teacher_or_admin" ON question_papers
      FOR INSERT TO authenticated
      WITH CHECK (
        (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      );`,

    `DROP POLICY IF EXISTS "question_papers_select_own_teacher" ON question_papers;`,
    `CREATE POLICY "question_papers_select_own_teacher" ON question_papers
      FOR SELECT TO authenticated
      USING (
        (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      );`,

    `DROP POLICY IF EXISTS "question_papers_select_published" ON question_papers;`,
    `CREATE POLICY "question_papers_select_published" ON question_papers
      FOR SELECT TO public
      USING (status = 'published'::publish_status);`,

    `DROP POLICY IF EXISTS "question_papers_update_teacher_or_admin" ON question_papers;`,
    `CREATE POLICY "question_papers_update_teacher_or_admin" ON question_papers
      FOR UPDATE TO authenticated
      USING (
        (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      )
      WITH CHECK (
        (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      );`,

    `DROP POLICY IF EXISTS "question_papers_delete_teacher_or_admin" ON question_papers;`,
    `CREATE POLICY "question_papers_delete_teacher_or_admin" ON question_papers
      FOR DELETE TO authenticated
      USING (
        (teacher_id = (SELECT teachers.id FROM teachers WHERE teachers.user_id = auth.uid())) OR
        (EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid()))
      );`,

    // ----------------------------------------------------
    // STORAGE OBJECTS POLICIES
    // ----------------------------------------------------
    `DROP POLICY IF EXISTS "storage_materials_public_read" ON storage.objects;`,
    `CREATE POLICY "storage_materials_public_read" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'materials');`,

    `DROP POLICY IF EXISTS "storage_materials_auth_insert" ON storage.objects;`,
    `CREATE POLICY "storage_materials_auth_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'materials');`,

    `DROP POLICY IF EXISTS "storage_materials_auth_update" ON storage.objects;`,
    `CREATE POLICY "storage_materials_auth_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'materials')
      WITH CHECK (bucket_id = 'materials');`,

    `DROP POLICY IF EXISTS "storage_materials_auth_delete" ON storage.objects;`,
    `CREATE POLICY "storage_materials_auth_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'materials');`,

    `DROP POLICY IF EXISTS "storage_qp_public_read" ON storage.objects;`,
    `CREATE POLICY "storage_qp_public_read" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'question-papers');`,

    `DROP POLICY IF EXISTS "storage_qp_auth_insert" ON storage.objects;`,
    `CREATE POLICY "storage_qp_auth_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'question-papers');`,

    `DROP POLICY IF EXISTS "storage_qp_auth_update" ON storage.objects;`,
    `CREATE POLICY "storage_qp_auth_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'question-papers')
      WITH CHECK (bucket_id = 'question-papers');`,

    `DROP POLICY IF EXISTS "storage_qp_auth_delete" ON storage.objects;`,
    `CREATE POLICY "storage_qp_auth_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'question-papers');`,

    `DROP POLICY IF EXISTS "storage_assignments_public_read" ON storage.objects;`,
    `CREATE POLICY "storage_assignments_public_read" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'assignments');`,

    `DROP POLICY IF EXISTS "storage_assignments_auth_insert" ON storage.objects;`,
    `CREATE POLICY "storage_assignments_auth_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'assignments');`,

    `DROP POLICY IF EXISTS "storage_assignments_auth_update" ON storage.objects;`,
    `CREATE POLICY "storage_assignments_auth_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'assignments')
      WITH CHECK (bucket_id = 'assignments');`,

    `DROP POLICY IF EXISTS "storage_assignments_auth_delete" ON storage.objects;`,
    `CREATE POLICY "storage_assignments_auth_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'assignments');`,
  ];

  for (const sql of sqlStatements) {
    try {
      await pgClient.query(sql);
    } catch (err) {
      console.error("SQL Error on:", sql.slice(0, 60), "...", err.message);
      throw err;
    }
  }

  console.log("✓ All RLS and Storage policies applied successfully!");

  await pgClient.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
