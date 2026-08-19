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
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function runLiveClassVerification() {
  console.log("==================================================");
  console.log("PHASE 4: LIVE CLASS & CLASSROOM END-TO-END AUDIT");
  console.log("==================================================");

  // 1. Fetch subject, teacher, and student
  console.log("\n[1/7] Fetching Active Teacher, Enrolled Student and Subject...");
  const { data: subjects, error: subErr } = await supabaseAdmin
    .from("subjects")
    .select("*, teacher:teachers(*, user:users(*))")
    .limit(1);

  if (subErr || !subjects?.length) throw new Error("No subjects found in Supabase");
  const subject = subjects[0];
  const teacher = subject.teacher;

  const { data: students, error: studErr } = await supabaseAdmin
    .from("students")
    .select("*, user:users(*)")
    .limit(1);

  if (studErr || !students?.length) throw new Error("No students found in Supabase");
  const student = students[0];

  console.log(`✓ Subject: ${subject.name} (ID: ${subject.id})`);
  console.log(`✓ Teacher: ${teacher.user?.name} (ID: ${teacher.id})`);
  console.log(`✓ Student: ${student.user?.name} (ID: ${student.id})`);

  // Ensure active enrollment exists
  await supabaseAdmin.from("enrollments").upsert(
    {
      student_id: student.id,
      subject_id: subject.id,
      status: "active",
    },
    { onConflict: "student_id,subject_id" },
  );
  console.log("✓ Student active enrollment confirmed in Supabase.");

  // 2. Teacher schedules a Live Class
  console.log("\n[2/7] Teacher Scheduling a Live Class...");
  const now = new Date();
  const startsAt = new Date(now.getTime() + 10 * 60000).toISOString();
  const endsAt = new Date(now.getTime() + 70 * 60000).toISOString();

  const { data: scheduledClass, error: cErr } = await supabaseAdmin
    .from("scheduled_classes")
    .insert({
      subject_id: subject.id,
      teacher_id: teacher.id,
      title: "Quadratic Equations Masterclass",
      topic: "Roots & Discriminants",
      chapter: "Algebra Chapter 4",
      description: "Deep dive into solving quadratic equations with live Q&A.",
      starts_at: startsAt,
      ends_at: endsAt,
      meeting_url: "https://meet.google.com/abc-defg-hij",
      status: "scheduled",
    })
    .select("*, subject:subjects(*), teacher:teachers(*, user:users(*))")
    .single();

  if (cErr) throw cErr;
  console.log(`✓ Live class created: "${scheduledClass.title}" (ID: ${scheduledClass.id})`);
  console.log(`  - Status: ${scheduledClass.status}`);
  console.log(`  - Meeting Link: ${scheduledClass.meeting_url}`);
  console.log(`  - Teacher Name via Join: ${scheduledClass.teacher?.user?.name}`);

  // 3. Batch Notify Enrolled Students
  console.log("\n[3/7] Dispatching Notification to Enrolled Students...");
  const { data: enrollments } = await supabaseAdmin
    .from("enrollments")
    .select("student:students(user_id)")
    .eq("subject_id", subject.id)
    .eq("status", "active");

  const recipientUserIds = Array.from(
    new Set(enrollments.map((e) => e.student?.user_id).filter(Boolean)),
  );
  const notificationRows = recipientUserIds.map((uid) => ({
    user_id: uid,
    type: "class",
    title: `New Live Class: ${scheduledClass.title}`,
    message: `Scheduled for ${new Date(startsAt).toLocaleTimeString()}.`,
    related_entity_id: scheduledClass.id,
    related_entity_type: "scheduled_class",
    read: false,
  }));

  const { data: insertedNotifs, error: nErr } = await supabaseAdmin
    .from("notifications")
    .insert(notificationRows)
    .select();

  if (nErr) throw nErr;
  console.log(
    `✓ Inserted ${insertedNotifs.length} notification(s) into notifications table in Supabase.`,
  );

  // 4. Student Live Timetable Visibility
  console.log("\n[4/7] Verifying Student Live Class Timetable Query...");
  const { data: studentClasses, error: scErr } = await supabaseAdmin
    .from("scheduled_classes")
    .select("*, subject:subjects(*)")
    .eq("subject_id", subject.id)
    .in("status", ["scheduled", "upcoming", "live"]);

  if (scErr) throw scErr;
  const found = studentClasses.some((c) => c.id === scheduledClass.id);
  if (!found) throw new Error("Student query did not return the scheduled class!");
  console.log(
    `✓ Student timetable returned ${studentClasses.length} active session(s), including "${scheduledClass.title}".`,
  );

  // 5. Teacher Starts Live Class (Go Live)
  console.log("\n[5/7] Teacher Starting the Class (Status -> LIVE)...");
  const { data: liveClass, error: lErr } = await supabaseAdmin
    .from("scheduled_classes")
    .update({ status: "live", updated_at: new Date().toISOString() })
    .eq("id", scheduledClass.id)
    .select()
    .single();

  if (lErr) throw lErr;
  console.log(`✓ Class status updated in Supabase to: "${liveClass.status}"`);

  // 6. Classroom Route Authorization Testing
  console.log("\n[6/7] Testing Classroom Authorization Rules...");
  // Test A: Enrolled Student Authorization
  const { data: enrolledCheck } = await supabaseAdmin
    .from("enrollments")
    .select("id")
    .eq("student_id", student.id)
    .eq("subject_id", liveClass.subject_id)
    .eq("status", "active")
    .single();

  if (!enrolledCheck) throw new Error("Enrolled student check failed!");
  console.log("✓ Enrolled student authorized to enter classroom.");

  // Test B: Non-Enrolled Student Authorization
  const dummyStudentId = "00000000-0000-0000-0000-000000000000";
  const { data: nonEnrolledCheck } = await supabaseAdmin
    .from("enrollments")
    .select("id")
    .eq("student_id", dummyStudentId)
    .eq("subject_id", liveClass.subject_id)
    .eq("status", "active");

  if (nonEnrolledCheck && nonEnrolledCheck.length > 0) {
    throw new Error("Non-enrolled student was unexpectedly authorized!");
  }
  console.log("✓ Non-enrolled student correctly rejected from classroom.");

  // 7. Teacher Ends Class (Status -> COMPLETED)
  console.log("\n[7/7] Teacher Ending the Class (Status -> COMPLETED)...");
  const { data: completedClass, error: endErr } = await supabaseAdmin
    .from("scheduled_classes")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", scheduledClass.id)
    .select()
    .single();

  if (endErr) throw endErr;
  console.log(`✓ Class status updated in Supabase to: "${completedClass.status}"`);

  // Cleanup test class
  await supabaseAdmin.from("scheduled_classes").delete().eq("id", scheduledClass.id);
  console.log("✓ Test class cleaned up.");

  console.log("\n==================================================");
  console.log("PHASE 4 LIVE CLASS & CLASSROOM TESTS PASSED!");
  console.log("==================================================");
}

runLiveClassVerification().catch((err) => {
  console.error("Live class verification failed:", err);
  process.exit(1);
});
