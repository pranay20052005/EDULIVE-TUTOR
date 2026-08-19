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

async function runRecordingsVerification() {
  console.log("==================================================");
  console.log("PHASE 4: RECORDINGS & WATCH PROGRESS END-TO-END AUDIT");
  console.log("==================================================");

  // 1. Fetch subject, teacher, student
  console.log("\n[1/6] Fetching Teacher, Enrolled Student and Subject...");
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

  console.log(`✓ Subject: ${subject.name} (Subject ID: ${subject.id})`);
  console.log(`✓ Teacher: ${teacher.user?.name} (User ID: ${teacher.user_id})`);
  console.log(`✓ Student: ${student.user?.name} (Student ID: ${student.id})`);

  // 2. Teacher Creates and Publishes a Recording
  console.log("\n[2/6] Teacher Creating & Publishing a Recording...");
  const { data: recording, error: rErr } = await supabaseAdmin
    .from("recordings")
    .insert({
      subject_id: subject.id,
      title: "Trigonometric Identities & Applications",
      topic: "Trigonometry Chapter 8",
      description: "Mastering sin, cos, tan identities with solved board exam questions.",
      video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      duration_min: 50,
      status: "published",
      created_by: teacher.user_id,
    })
    .select("*, subject:subjects(*)")
    .single();

  if (rErr) throw rErr;
  console.log(`✓ Recording created: "${recording.title}" (ID: ${recording.id})`);
  console.log(`  - Status: ${recording.status}`);
  console.log(`  - Duration: ${recording.duration_min} minutes`);
  console.log(`  - Video URL: ${recording.video_url}`);

  // 3. Enrolled Student Queries Published Recordings
  console.log("\n[3/6] Student Querying Published Recordings for Enrolled Subjects...");
  const { data: studentRecordings, error: srErr } = await supabaseAdmin
    .from("recordings")
    .select("*, subject:subjects(*)")
    .eq("status", "published")
    .eq("subject_id", subject.id);

  if (srErr) throw srErr;
  const foundRec = studentRecordings.some((r) => r.id === recording.id);
  if (!foundRec) throw new Error("Created recording was not returned for student!");
  console.log(
    `✓ Enrolled student successfully retrieved ${studentRecordings.length} recording(s).`,
  );

  // 4. Student Starts Watching -> Save Progress in PostgreSQL
  console.log("\n[4/6] Student Watches Lesson -> Saving Progress to student_recording_progress...");
  const initialWatchedSec = 600; // 10 minutes in
  const initialPct = 20;

  const { data: progressRow, error: pErr } = await supabaseAdmin
    .from("student_recording_progress")
    .upsert(
      {
        student_id: student.id,
        recording_id: recording.id,
        progress_percent: initialPct,
        watched_seconds: initialWatchedSec,
        completed: false,
        last_watched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,recording_id" },
    )
    .select()
    .single();

  if (pErr) throw pErr;
  console.log(`✓ Progress recorded in Supabase (ID: ${progressRow.id})`);
  console.log(`  - Progress: ${progressRow.progress_percent}%`);
  console.log(`  - Watched Seconds: ${progressRow.watched_seconds}s`);
  console.log(`  - Completed: ${progressRow.completed}`);

  // 5. Simulate Page Refresh -> Resume Playback from Saved Position
  console.log("\n[5/6] Simulating Refresh -> Resuming Playback from PostgreSQL...");
  const { data: fetchedProgress, error: fpErr } = await supabaseAdmin
    .from("student_recording_progress")
    .select("*")
    .eq("student_id", student.id)
    .eq("recording_id", recording.id)
    .single();

  if (fpErr) throw fpErr;
  if (
    fetchedProgress.watched_seconds !== initialWatchedSec ||
    fetchedProgress.progress_percent !== initialPct
  ) {
    throw new Error("Persisted watch progress does not match saved values!");
  }
  console.log(
    `✓ Restored watch progress: ${fetchedProgress.progress_percent}% at ${fetchedProgress.watched_seconds}s.`,
  );

  // 6. Student Completes Recording -> Update to 100% / Completed
  console.log("\n[6/6] Student Completes Video -> Updating Progress to 100% / Completed...");
  const { data: completedProgress, error: cpErr } = await supabaseAdmin
    .from("student_recording_progress")
    .upsert(
      {
        student_id: student.id,
        recording_id: recording.id,
        progress_percent: 100,
        watched_seconds: 3000,
        completed: true,
        last_watched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,recording_id" },
    )
    .select()
    .single();

  if (cpErr) throw cpErr;
  console.log(
    `✓ Lesson completed status saved in PostgreSQL: completed=${completedProgress.completed}, percent=${completedProgress.progress_percent}%`,
  );

  // Cleanup test recording
  await supabaseAdmin.from("student_recording_progress").delete().eq("recording_id", recording.id);
  await supabaseAdmin.from("recordings").delete().eq("id", recording.id);
  console.log("✓ Test recording and progress records cleaned up.");

  console.log("\n==================================================");
  console.log("PHASE 4 RECORDINGS & WATCH PROGRESS CHECKS PASSED!");
  console.log("==================================================");
}

runRecordingsVerification().catch((err) => {
  console.error("Recordings verification failed:", err);
  process.exit(1);
});
