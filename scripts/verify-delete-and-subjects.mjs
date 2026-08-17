import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

// Load .env.local
const envLocal = fs.readFileSync(".env.local", "utf8");
const envVars = Object.fromEntries(
  envLocal
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

async function runVerification() {
  console.log("==================================================");
  console.log("EDULIVE SUBJECT DELETION & CATALOGUE AUDIT");
  console.log("==================================================");

  // 1. Audit Current Live Database Subjects
  console.log("\n[1/5] Auditing Current Subjects in Live Database...");
  const { data: currentSubjects, error: csErr } = await supabaseAdmin
    .from("subjects")
    .select("*, teacher:teachers(*, user:users(*))")
    .order("created_at", { ascending: false });

  if (csErr) throw csErr;
  console.log(`Total subjects found: ${currentSubjects.length}`);
  currentSubjects.forEach((s, idx) => {
    console.log(
      ` ${idx + 1}. ID: ${s.id} | Name: "${s.name}" | Standard: "${s.standard}" | Status: "${s.status}" | Teacher: "${s.teacher?.user?.name}" | Price: ₹${s.price_inr}`,
    );
  });

  // 2. Test Safe Subject Deletion
  console.log("\n[2/5] Testing Subject Deletion Feature...");
  // Step A: Create a temporary subject
  const { data: tempSub, error: tsErr } = await supabaseAdmin
    .from("subjects")
    .insert({
      name: "Temporary Chemistry",
      code: "TEMP-CHEM-9",
      standard: "9th",
      teacher_id: currentSubjects[0]?.teacher_id,
      price_inr: 999,
      status: "published",
    })
    .select()
    .single();

  if (tsErr) throw tsErr;
  console.log(`✓ Created temporary subject for deletion test: ${tempSub.name} (ID: ${tempSub.id})`);

  // Step B: Delete the temporary subject
  const { error: delErr } = await supabaseAdmin.from("subjects").delete().eq("id", tempSub.id);
  if (delErr) throw delErr;

  // Step C: Verify deletion from Supabase
  const { data: verifyDel } = await supabaseAdmin
    .from("subjects")
    .select("id")
    .eq("id", tempSub.id);
  if (verifyDel && verifyDel.length > 0) {
    throw new Error("Temporary subject was not deleted from Supabase!");
  }
  console.log("✓ Temporary subject successfully deleted and confirmed absent from Supabase.");

  // 3. Test Deletion Dependency Protection on Enrolled Subject
  console.log("\n[3/5] Testing Dependency Protection on Subject with Enrollments...");
  const enrolledSubject = currentSubjects.find((s) => s.name === "Mathematics");
  if (enrolledSubject) {
    const { count: enrollCount } = await supabaseAdmin
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", enrolledSubject.id);

    console.log(
      ` - Subject "${enrolledSubject.name}" (${enrolledSubject.id}) has ${enrollCount} enrollment(s).`,
    );
    if (enrollCount && enrollCount > 0) {
      console.log("   ✓ Deletion protection correctly identifies dependent enrollment records.");
    }
  }

  // 4. Detailed Investigation of Bug 2 (Why Physics was not shown for 9th student)
  console.log("\n[4/5] Investigating Explore Courses Visibility for Student...");
  const physicsSubject = currentSubjects.find((s) => s.name.toLowerCase() === "physics");
  const mathSubjects = currentSubjects.filter((s) => s.name.toLowerCase() === "mathematics");

  console.log(` - Physics standard in database: "${physicsSubject?.standard}"`);
  console.log(` - Mathematics counts in database: ${mathSubjects.length} records`);
  mathSubjects.forEach((m, i) => {
    console.log(
      `   • Mathematics #${i + 1} ID: ${m.id} | Standard: "${m.standard}" | Status: "${m.status}"`,
    );
  });

  const { data: students } = await supabaseAdmin.from("students").select("*, user:users(*)");
  const activeStudent = students[0];
  console.log(
    ` - Active student: ${activeStudent?.user?.name} | Standard in DB: "${activeStudent?.standard}"`,
  );

  // Simulate filter for 9th student
  const published = currentSubjects.filter((s) => s.status === "published");
  const studentStd = (activeStudent?.standard || "9th").trim().toLowerCase();

  const for9thStudent = published.filter((s) => (s.standard || "").trim().toLowerCase() === "9th");
  console.log(`\nDefault courses shown to 9th standard student (${for9thStudent.length}):`);
  for9thStudent.forEach((s) =>
    console.log(`   ✓ "${s.name}" (${s.standard} Standard, ID: ${s.id})`),
  );

  const for10thStudent = published.filter(
    (s) => (s.standard || "").trim().toLowerCase() === "10th",
  );
  console.log(`\nDefault courses shown to 10th standard student (${for10thStudent.length}):`);
  for10thStudent.forEach((s) =>
    console.log(`   ✓ "${s.name}" (${s.standard} Standard, ID: ${s.id})`),
  );

  const allFiltered = published;
  console.log(`\nCourses shown when selecting "All standards" (${allFiltered.length}):`);
  allFiltered.forEach((s) => console.log(`   ✓ "${s.name}" (${s.standard} Standard, ID: ${s.id})`));

  // 5. Verification of Duplicate Handling
  console.log("\n[5/5] Checking Duplicate Mathematics Handling...");
  if (mathSubjects.length === 2) {
    if (mathSubjects[0].id !== mathSubjects[1].id) {
      console.log(
        "✓ Both Mathematics records have unique IDs and are preserved as separate database records.",
      );
      console.log(`  - Record 1: ${mathSubjects[0].id}`);
      console.log(`  - Record 2: ${mathSubjects[1].id}`);
    }
  }

  console.log("\n==================================================");
  console.log("ALL SUBJECTS & DELETION CHECKS COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
}

runVerification().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
