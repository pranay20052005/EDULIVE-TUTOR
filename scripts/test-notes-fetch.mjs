import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log("=== TESTING NOTES & QUESTION PAPERS FETCH ===");

  // 1. Get a student with active enrollments
  const { data: enrollments } = await adminClient
    .from("enrollments")
    .select("*, student:students(*, user:users(*))")
    .eq("status", "active")
    .limit(1);

  if (!enrollments || !enrollments.length) {
    throw new Error("No active enrollments found in database");
  }
  const enr = enrollments[0];
  console.log(`Found enrolled student: ${enr.student?.user?.email} in subject ${enr.subject_id}`);

  // 2. Fetch materials for this subject
  const { data: materials, error: mErr } = await adminClient
    .from("materials")
    .select("*, subject:subjects(*), chapter:chapters(*), creator:users(*)")
    .eq("subject_id", enr.subject_id);

  if (mErr) throw new Error(`Materials fetch failed: ${mErr.message}`);
  console.log(`✓ Materials for subject (${materials.length} items):`);
  console.table(
    materials.map((m) => ({
      id: m.id,
      title: m.title,
      subject: m.subject?.name,
      chapter: m.chapter?.title,
      file_type: m.file_type,
    })),
  );

  // 3. Fetch question papers for this subject
  const { data: papers, error: qErr } = await adminClient
    .from("question_papers")
    .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
    .eq("subject_id", enr.subject_id);

  if (qErr) throw new Error(`Question papers fetch failed: ${qErr.message}`);
  console.log(`✓ Question papers for subject (${papers.length} items):`);
  console.table(
    papers.map((p) => ({
      id: p.id,
      title: p.title,
      exam_type: p.exam_type,
      marks: p.total_marks,
    })),
  );

  console.log("\n🎉 NOTES & QUESTION PAPERS QUERIES VERIFIED SUCCESSFULLY!");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
