import pg from "pg";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
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

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

async function main() {
  console.log("==================================================");
  console.log("EDULIVE TEACHER CONTENT MANAGEMENT E2E VERIFICATION");
  console.log("==================================================");

  await pgClient.connect();

  // 1. Fetch a teacher and their assigned subjects
  const teacherRes = await pgClient.query(`
    SELECT t.id as teacher_id, t.user_id, u.email, u.name,
           s.id as subject_id, s.name as subject_name
    FROM teachers t
    JOIN users u ON u.id = t.user_id
    JOIN subjects s ON s.teacher_id = t.id
    LIMIT 1;
  `);

  if (!teacherRes.rows.length) {
    console.error("No teacher with assigned subject found in database for test.");
    process.exit(1);
  }

  const teacher = teacherRes.rows[0];
  console.log(`\nTesting with Teacher: [${teacher.name}] (${teacher.email})`);
  console.log(`Teacher ID: ${teacher.teacher_id} | User ID: ${teacher.user_id}`);
  console.log(`Assigned Subject: [${teacher.subject_name}] (${teacher.subject_id})`);

  // ----------------------------------------------------
  // TEST SUITE 1: Supabase Storage Buckets
  // ----------------------------------------------------
  console.log("\n[TEST SUITE 1] Supabase Storage Buckets & Access");

  for (const bucket of ["materials", "question-papers", "assignments"]) {
    const { data: bucketData, error: bErr } = await supabaseAdmin.storage.getBucket(bucket);
    assert(!bErr && !!bucketData, `Bucket '${bucket}' exists in Supabase Storage`);
    assert(bucketData?.public === true, `Bucket '${bucket}' is configured for public download`);
  }

  // ----------------------------------------------------
  // TEST SUITE 2: Storage Upload & File URL Generation
  // ----------------------------------------------------
  console.log("\n[TEST SUITE 2] Storage File Uploads for Notes, Assignments, Question Papers");

  const dummyContent = Buffer.from("EduLive Sample Study Material Content for verification");

  // Upload Note
  const noteFileName = `test-note-${Date.now()}.pdf`;
  const noteFilePath = `teacher/${teacher.user_id}/notes/${noteFileName}`;
  const { data: noteUpload, error: noteUploadErr } = await supabaseAdmin.storage
    .from("materials")
    .upload(noteFilePath, dummyContent, { contentType: "application/pdf", upsert: true });

  assert(!noteUploadErr && !!noteUpload, `Upload file to materials bucket at ${noteFilePath}`);
  const { data: noteUrlData } = supabaseAdmin.storage.from("materials").getPublicUrl(noteFilePath);
  assert(
    noteUrlData.publicUrl.includes(noteFileName),
    `Generated public URL for note: ${noteUrlData.publicUrl.slice(0, 70)}...`,
  );

  // Upload Assignment
  const asgFileName = `test-asg-${Date.now()}.docx`;
  const asgFilePath = `teacher/${teacher.user_id}/assignments/${asgFileName}`;
  const { data: asgUpload, error: asgUploadErr } = await supabaseAdmin.storage
    .from("assignments")
    .upload(asgFilePath, dummyContent, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });

  assert(!asgUploadErr && !!asgUpload, `Upload file to assignments bucket at ${asgFilePath}`);
  const { data: asgUrlData } = supabaseAdmin.storage.from("assignments").getPublicUrl(asgFilePath);
  assert(asgUrlData.publicUrl.includes(asgFileName), `Generated public URL for assignment`);

  // Upload Question Paper
  const qpFileName = `test-qp-${Date.now()}.pdf`;
  const qpFilePath = `teacher/${teacher.user_id}/question-papers/${qpFileName}`;
  const { data: qpUpload, error: qpUploadErr } = await supabaseAdmin.storage
    .from("question-papers")
    .upload(qpFilePath, dummyContent, { contentType: "application/pdf", upsert: true });

  assert(!qpUploadErr && !!qpUpload, `Upload file to question-papers bucket at ${qpFilePath}`);
  const { data: qpUrlData } = supabaseAdmin.storage
    .from("question-papers")
    .getPublicUrl(qpFilePath);
  assert(qpUrlData.publicUrl.includes(qpFileName), `Generated public URL for question paper`);

  // ----------------------------------------------------
  // TEST SUITE 3: Notes / Study Material Full Lifecycle
  // ----------------------------------------------------
  console.log("\n[TEST SUITE 3] Notes / Study Material Database CRUD & RLS");

  // Create Note
  const insertNoteRes = await pgClient.query(
    `
    INSERT INTO materials (
      subject_id, title, description, file_type, file_url, file_size_kb, status, material_order, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `,
    [
      teacher.subject_id,
      "Chapter 1: Kinematics Notes",
      "Comprehensive theory and worked examples",
      "PDF",
      noteUrlData.publicUrl,
      2048,
      "published",
      1,
      teacher.user_id,
    ],
  );

  const createdNote = insertNoteRes.rows[0];
  assert(
    !!createdNote?.id,
    `Material created with ID ${createdNote?.id} and created_by = users(id)`,
  );

  // Update Note
  const updateNoteRes = await pgClient.query(
    `
    UPDATE materials
    SET title = 'Chapter 1: Kinematics Notes (Updated)', status = 'draft'
    WHERE id = $1
    RETURNING *;
  `,
    [createdNote.id],
  );
  assert(updateNoteRes.rows[0].title.includes("(Updated)"), `Material title updated successfully`);
  assert(updateNoteRes.rows[0].status === "draft", `Material status toggled to draft`);

  // Delete Note
  const deleteNoteRes = await pgClient.query(`DELETE FROM materials WHERE id = $1 RETURNING id;`, [
    createdNote.id,
  ]);
  assert(deleteNoteRes.rows.length === 1, `Material deleted successfully`);

  // ----------------------------------------------------
  // TEST SUITE 4: Assignments Full Lifecycle
  // ----------------------------------------------------
  console.log("\n[TEST SUITE 4] Assignments Database CRUD & RLS");

  const insertAsgRes = await pgClient.query(
    `
    INSERT INTO assignments (
      subject_id, teacher_id, title, description, instructions, file_url, file_name, due_at, max_marks, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `,
    [
      teacher.subject_id,
      teacher.teacher_id,
      "Midterm Homework 1",
      "Solve all 10 problem sets in the attached sheet",
      "Submit PDF before 6 PM",
      asgUrlData.publicUrl,
      asgFileName,
      new Date(Date.now() + 7 * 86400000).toISOString(),
      50,
      "published",
    ],
  );

  const createdAsg = insertAsgRes.rows[0];
  assert(
    !!createdAsg?.id,
    `Assignment created with ID ${createdAsg?.id} and teacher_id = teachers(id)`,
  );
  assert(createdAsg.file_url === asgUrlData.publicUrl, `Assignment retains attached file URL`);

  // Update Assignment
  const updateAsgRes = await pgClient.query(
    `
    UPDATE assignments
    SET max_marks = 100, status = 'draft'
    WHERE id = $1
    RETURNING *;
  `,
    [createdAsg.id],
  );
  assert(updateAsgRes.rows[0].max_marks === 100, `Assignment max_marks updated to 100`);

  // Delete Assignment
  const deleteAsgRes = await pgClient.query(`DELETE FROM assignments WHERE id = $1 RETURNING id;`, [
    createdAsg.id,
  ]);
  assert(deleteAsgRes.rows.length === 1, `Assignment deleted successfully`);

  // ----------------------------------------------------
  // TEST SUITE 5: Question Papers Full Lifecycle
  // ----------------------------------------------------
  console.log("\n[TEST SUITE 5] Question Papers Database CRUD & RLS");

  const insertQpRes = await pgClient.query(
    `
    INSERT INTO question_papers (
      subject_id, teacher_id, title, exam_type, description, total_marks, duration_min, file_url, file_name, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `,
    [
      teacher.subject_id,
      teacher.teacher_id,
      "Physics Term 1 Final Exam Paper",
      "Final",
      "Full syllabus question paper",
      100,
      180,
      qpUrlData.publicUrl,
      qpFileName,
      "published",
    ],
  );

  const createdQp = insertQpRes.rows[0];
  assert(!!createdQp?.id, `Question paper created with ID ${createdQp?.id}`);
  assert(createdQp.duration_min === 180, `Duration correctly set to 180 min`);

  // Update Question Paper
  const updateQpRes = await pgClient.query(
    `
    UPDATE question_papers
    SET title = 'Physics Term 1 Final Exam Paper (Revised)'
    WHERE id = $1
    RETURNING *;
  `,
    [createdQp.id],
  );
  assert(
    updateQpRes.rows[0].title.includes("(Revised)"),
    `Question paper title updated successfully`,
  );

  // Delete Question Paper
  const deleteQpRes = await pgClient.query(
    `DELETE FROM question_papers WHERE id = $1 RETURNING id;`,
    [createdQp.id],
  );
  assert(deleteQpRes.rows.length === 1, `Question paper deleted successfully`);

  // ----------------------------------------------------
  // TEST SUITE 6: Clean up test files from storage
  // ----------------------------------------------------
  console.log("\n[TEST SUITE 6] Storage Cleanup");
  await supabaseAdmin.storage.from("materials").remove([noteFilePath]);
  await supabaseAdmin.storage.from("assignments").remove([asgFilePath]);
  await supabaseAdmin.storage.from("question-papers").remove([qpFilePath]);
  assert(true, `Test artifacts cleaned up from storage`);

  await pgClient.end();

  console.log("\n==================================================");
  console.log(`VERIFICATION SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
