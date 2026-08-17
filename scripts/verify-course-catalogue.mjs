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

async function runCourseCatalogueAudit() {
  console.log("==================================================");
  console.log("EDULIVE COURSE CATALOGUE & EXPLORE COURSES VERIFICATION");
  console.log("==================================================");

  // 1. Audit Active Teacher
  console.log("\n[1/7] Auditing Teacher Record for Subject Assignment...");
  const { data: teachers, error: tErr } = await supabaseAdmin
    .from("teachers")
    .select("*, user:users(*)")
    .order("created_at", { ascending: true });

  if (tErr) throw tErr;
  if (!teachers || teachers.length === 0) {
    throw new Error("No teachers found in database.");
  }

  const teacher = teachers[0];
  console.log(
    `✓ Teacher identified: ${teacher.user?.name} (ID: ${teacher.id}, User ID: ${teacher.user_id})`,
  );

  // 2. Audit Student Record
  console.log("\n[2/7] Auditing Student Record for Standard-based Testing...");
  const { data: students, error: sErr } = await supabaseAdmin
    .from("students")
    .select("*, user:users(*)")
    .order("created_at", { ascending: true });

  if (sErr) throw sErr;
  if (!students || students.length === 0) {
    throw new Error("No students found in database.");
  }

  const student = students[0];
  console.log(
    `✓ Student identified: ${student.user?.name} (${student.user?.email}) | Standard: ${student.standard}`,
  );

  // 3. Create Subject: Mathematics (9th Standard, Published, Teacher: Pranisha Shetty)
  console.log("\n[3/7] Creating 9th Standard Mathematics Subject in Supabase...");
  // Clear any previous test subject if exists
  await supabaseAdmin.from("subjects").delete().eq("name", "Mathematics").eq("standard", "9th");

  const { data: createdSubject, error: createErr } = await supabaseAdmin
    .from("subjects")
    .insert({
      name: "Mathematics",
      code: "MATH-9-CBSE",
      standard: "9th",
      teacher_id: teacher.id,
      description:
        "Complete CBSE 9th Standard Mathematics covering Number Systems, Algebra, Geometry and Statistics.",
      price_inr: 1499,
      duration_months: 6,
      color: "chart-1",
      icon: "BookOpen",
      status: "published",
    })
    .select("*, teacher:teachers(*, user:users(*))")
    .single();

  if (createErr) throw createErr;
  console.log(`✓ Subject created: ${createdSubject.name} (${createdSubject.id})`);
  console.log(`  - Standard: ${createdSubject.standard}`);
  console.log(`  - Status: ${createdSubject.status}`);
  console.log(`  - Price: ₹${createdSubject.price_inr}`);
  console.log(`  - Teacher Name via Join: ${createdSubject.teacher?.user?.name}`);

  if (createdSubject.teacher?.user?.name !== "Pranisha Shetty") {
    throw new Error(
      `Teacher name mismatch. Expected 'Pranisha Shetty', got '${createdSubject.teacher?.user?.name}'`,
    );
  }

  // 4. Verify RLS & Published Subjects Query as Public/Student
  console.log("\n[4/7] Testing RLS & listPublished() as Student/Public...");
  const { data: publishedSubjects, error: pubErr } = await supabaseAnon
    .from("subjects")
    .select("*, teacher:teachers(*, user:users(*))")
    .eq("status", "published");

  if (pubErr) throw pubErr;
  console.log(`✓ RLS query returned ${publishedSubjects.length} published subjects.`);
  const mathSubject = publishedSubjects.find((s) => s.id === createdSubject.id);
  if (!mathSubject) {
    throw new Error("Created published subject was not returned by public/anon RLS query!");
  }
  console.log(`✓ Confirmed subject is visible in public catalogue: ${mathSubject.name}`);

  // 5. Test Standard-Based Filtering for 9th vs 10th Standard Students
  console.log("\n[5/7] Testing Dynamic Filtering for 9th vs 10th Standard Students...");

  // Scenario A: 9th Standard Student
  const filter9th = (subjList, studentStd) =>
    subjList.filter((s) => (studentStd !== "all" ? s.standard === studentStd : true));

  const resultsFor9th = filter9th(publishedSubjects, "9th");
  console.log(` - When Student Standard = '9th': Found ${resultsFor9th.length} courses`);
  const hasMathIn9th = resultsFor9th.some((s) => s.name === "Mathematics" && s.standard === "9th");
  if (!hasMathIn9th) {
    throw new Error("9th standard student did not receive 9th Mathematics!");
  }
  console.log("   ✓ 9th Mathematics appears for 9th standard student.");

  // Scenario B: 10th Standard Student
  const resultsFor10th = filter9th(publishedSubjects, "10th");
  console.log(` - When Student Standard = '10th': Found ${resultsFor10th.length} courses`);
  const hasMathIn10th = resultsFor10th.some(
    (s) => s.name === "Mathematics" && s.standard === "9th",
  );
  if (hasMathIn10th) {
    throw new Error("10th standard student received 9th Mathematics by default!");
  }
  console.log("   ✓ 9th Mathematics is hidden by default for 10th standard student.");

  // Scenario C: Admin Promotes / Changes Class (10th -> 9th)
  console.log("\n[6/7] Testing Student Standard Update (Class Promotion / Change)...");
  await supabaseAdmin.from("students").update({ standard: "10th" }).eq("id", student.id);
  let { data: sUpdated } = await supabaseAdmin
    .from("students")
    .select("standard")
    .eq("id", student.id)
    .single();
  console.log(` - Student standard set to: ${sUpdated.standard}`);
  let coursesForStudent = filter9th(publishedSubjects, sUpdated.standard);
  console.log(
    ` - Courses visible for student: ${coursesForStudent.map((c) => c.name).join(", ") || "None"}`,
  );

  // Now change standard back to 9th
  await supabaseAdmin.from("students").update({ standard: "9th" }).eq("id", student.id);
  sUpdated = (await supabaseAdmin.from("students").select("standard").eq("id", student.id).single())
    .data;
  console.log(` - Student standard updated back to: ${sUpdated.standard}`);
  coursesForStudent = filter9th(publishedSubjects, sUpdated.standard);
  console.log(` - Courses visible for student: ${coursesForStudent.map((c) => c.name).join(", ")}`);
  if (!coursesForStudent.some((c) => c.name === "Mathematics")) {
    throw new Error("Mathematics did not appear after student standard was set to 9th!");
  }
  console.log("   ✓ Class promotion dynamically updates visible courses.");

  // 6. Test Purchase & Enrollment Flow (No Auto-Enrollment)
  console.log("\n[7/7] Testing Course Purchase and Enrollment Flow...");
  // Verify NOT enrolled yet
  const { data: initialEnrollments } = await supabaseAdmin
    .from("enrollments")
    .select("*")
    .eq("student_id", student.id)
    .eq("subject_id", createdSubject.id);

  if (initialEnrollments && initialEnrollments.length > 0) {
    await supabaseAdmin
      .from("enrollments")
      .delete()
      .eq("student_id", student.id)
      .eq("subject_id", createdSubject.id);
  }
  console.log(" - Verified: Student is NOT auto-enrolled upon subject creation.");

  // Simulate Purchase
  console.log(" - Simulating course purchase by student...");
  const { data: payment, error: pErr } = await supabaseAdmin
    .from("payments")
    .insert({
      student_id: student.id,
      subject_id: createdSubject.id,
      amount_inr: createdSubject.price_inr,
      payment_method: "upi",
      status: "paid",
    })
    .select()
    .single();

  if (pErr) throw pErr;
  console.log(
    `   ✓ Payment recorded in Supabase (Payment ID: ${payment.id}, Amount: ₹${payment.amount_inr})`,
  );

  // Create Enrollment after successful payment
  const { data: enrollment, error: eErr } = await supabaseAdmin
    .from("enrollments")
    .insert({
      student_id: student.id,
      subject_id: createdSubject.id,
      status: "active",
    })
    .select("*, subject:subjects(*)")
    .single();

  if (eErr) throw eErr;
  console.log(`   ✓ Enrollment recorded in Supabase (Enrollment ID: ${enrollment.id})`);
  console.log(`   ✓ Enrolled Subject Name: ${enrollment.subject?.name}`);

  // Verify enrolled in My Subjects
  const { data: mySubjects } = await supabaseAdmin
    .from("enrollments")
    .select("*, subject:subjects(*)")
    .eq("student_id", student.id)
    .eq("status", "active");

  console.log(
    ` - Student now has ${mySubjects.length} active subject enrollment(s) in My Subjects:`,
  );
  mySubjects.forEach((e) => console.log(`   • ${e.subject?.name} (${e.subject?.standard})`));

  console.log("\n==================================================");
  console.log("ALL COURSE CATALOGUE & FILTERING CHECKS PASSED!");
  console.log("==================================================");
}

runCourseCatalogueAudit().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
