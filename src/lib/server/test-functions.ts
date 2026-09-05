/**
 * Server Functions for Secure Test Taking & Server-Side Evaluation
 * Ensures test answer keys are never sent to the client browser prior to test completion
 * and grades attempts authoritatively on the server with anti-tampering verification.
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  authenticateAndResolveStudent,
  extractAuthToken,
  getServerSupabase,
} from "./payment-functions.ts";

export interface StudentSanitizedQuestion {
  id: string;
  test_id: string;
  type: "mcq" | "truefalse" | "short";
  text: string;
  options?: any;
  marks: number;
  difficulty?: string;
  question_order?: number;
}

export interface StudentTestResponse {
  test: {
    id: string;
    subject_id: string;
    title: string;
    description?: string;
    duration_min: number;
    total_marks: number;
    passing_marks?: number;
    starts_at?: string;
    ends_at?: string;
    status: string;
    subject?: {
      id: string;
      name: string;
      standard: string;
    };
  };
  questions: StudentSanitizedQuestion[];
  existingAttempt?: any;
}

export interface AuthoritativeQuestion {
  id: string;
  test_id?: string;
  type: string;
  text?: string;
  options?: any;
  marks: number;
  difficulty?: string;
  question_order?: number;
  correct_answer_index?: number;
  correct_answer?: string;
}

export interface EvaluationResult {
  score: number;
  totalMarks: number;
  percentage: number;
  correctCount: number;
  totalQuestions: number;
  questionResults: Array<{
    questionId: string;
    questionText: string;
    studentAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    marksAwarded: number;
    maxMarks: number;
  }>;
  dbAnswersToInsert: Array<{
    attempt_id?: string;
    question_id: string;
    selected_answer: string;
    selected_answer_index?: number;
    is_correct: boolean;
    marks_awarded: number;
  }>;
}

/**
 * Authoritative Server-Side Evaluation Engine
 * Pure business logic for grading tests authoritatively against verified database answer keys.
 * Exported so that automated test suites test the exact production implementation.
 */
export function evaluateTestAnswers(params: {
  questions: AuthoritativeQuestion[];
  answers: Record<string, string>;
  attemptId?: string;
}): EvaluationResult {
  const { questions, answers, attemptId } = params;

  let calculatedScore = 0;
  let totalPossibleMarks = 0;
  let correctCount = 0;

  const questionResults: EvaluationResult["questionResults"] = [];
  const dbAnswersToInsert: EvaluationResult["dbAnswersToInsert"] = [];

  for (const q of questions) {
    const qMarks = Number(q.marks) > 0 ? Number(q.marks) : 1;
    totalPossibleMarks += qMarks;

    const studentAnswer = (answers[q.id] || "").trim();
    let isCorrect = false;

    if (studentAnswer.length > 0) {
      if (q.type === "mcq" || q.type === "truefalse") {
        const studentIndex = Number(studentAnswer);
        const correctIndex = Number(q.correct_answer_index);
        isCorrect = !isNaN(studentIndex) && !isNaN(correctIndex) && studentIndex === correctIndex;
      } else if (q.type === "short") {
        const expected = String(q.correct_answer || q.correct_answer_index || "")
          .trim()
          .toLowerCase();
        isCorrect = studentAnswer.toLowerCase() === expected;
      }
    }

    const awarded = isCorrect ? qMarks : 0;
    if (isCorrect) {
      calculatedScore += qMarks;
      correctCount += 1;
    }

    let correctDisplay = "";
    if (q.options && Array.isArray(q.options) && q.correct_answer_index != null) {
      correctDisplay = q.options[q.correct_answer_index] || String(q.correct_answer_index);
    } else {
      correctDisplay = String(q.correct_answer || q.correct_answer_index || "");
    }

    questionResults.push({
      questionId: q.id,
      questionText: q.text || "",
      studentAnswer,
      correctAnswer: correctDisplay,
      isCorrect,
      marksAwarded: awarded,
      maxMarks: qMarks,
    });

    dbAnswersToInsert.push({
      attempt_id: attemptId,
      question_id: q.id,
      selected_answer: studentAnswer,
      selected_answer_index: !isNaN(Number(studentAnswer)) ? Number(studentAnswer) : undefined,
      is_correct: isCorrect,
      marks_awarded: awarded,
    });
  }

  const percentage =
    totalPossibleMarks > 0
      ? Math.round((calculatedScore / totalPossibleMarks) * 100 * 100) / 100
      : 0;

  return {
    score: calculatedScore,
    totalMarks: totalPossibleMarks,
    percentage,
    correctCount,
    totalQuestions: questions.length,
    questionResults,
    dbAnswersToInsert,
  };
}

/**
 * Validates test availability window and attempt duration on the server.
 */
export function validateTestTimingAndAvailability(params: {
  test: {
    status?: string;
    starts_at?: string;
    ends_at?: string;
    duration_min?: number;
  };
  attempt?: {
    started_at?: string;
    status?: string;
  } | null;
  now?: Date;
}): void {
  const { test, attempt } = params;
  const now = params.now || new Date();

  if (test.status && test.status !== "published") {
    throw new Error("Test is not published or currently unavailable.");
  }

  if (test.starts_at && now.getTime() < new Date(test.starts_at).getTime()) {
    throw new Error(`Test has not started yet. Starts at: ${test.starts_at}`);
  }

  if (test.ends_at && now.getTime() > new Date(test.ends_at).getTime()) {
    throw new Error(`Test has ended. Ended at: ${test.ends_at}`);
  }

  if (test.duration_min && attempt?.started_at) {
    const startedTime = new Date(attempt.started_at).getTime();
    const elapsedMs = now.getTime() - startedTime;
    const maxAllowedMs = (test.duration_min + 2) * 60 * 1000; // 2 minutes network latency grace period

    if (elapsedMs > maxAllowedMs) {
      throw new Error("Test duration has expired. Submission rejected.");
    }
  }
}

export interface GetStudentTestParams {
  testId: string;
  studentId?: string;
  authToken?: string;
  authenticatedUserId?: string;
}

/**
 * Core business logic: Get Test For Student
 * Strips correct answers and answer indexes before returning to student client.
 */
export async function getStudentTestInternal(
  supabase: SupabaseClient<any, any, any>,
  params: GetStudentTestParams,
): Promise<StudentTestResponse> {
  const { testId, studentId, authToken, authenticatedUserId } = params;
  if (!testId) {
    throw new Error("testId is required.");
  }

  // 1. Authenticate student
  const studentInfo = await authenticateAndResolveStudent(supabase, {
    authToken,
    clientStudentId: studentId,
    explicitUserId: authenticatedUserId,
  });

  // 2. Fetch test details
  const { data: test, error: testErr } = await supabase
    .from("tests")
    .select("*, subject:subjects(id, name, standard)")
    .eq("id", testId)
    .single();

  if (testErr || !test) {
    throw new Error("Test not found or unavailable.");
  }

  // 3. Verify student is enrolled in the test subject
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("student_id", studentInfo.studentId)
    .eq("subject_id", test.subject_id)
    .eq("status", "active")
    .maybeSingle();

  if (!enrollment) {
    throw new Error("You must be actively enrolled in this subject to take the test.");
  }

  // 4. Validate test availability window
  validateTestTimingAndAvailability({ test });

  // 5. Fetch questions (raw) - explicitly omitting correct answers
  const { data: rawQuestions, error: qErr } = await supabase
    .from("test_questions")
    .select("id, test_id, type, text, options, marks, difficulty, question_order")
    .eq("test_id", testId)
    .order("question_order", { ascending: true });

  if (qErr) {
    throw new Error(`Failed to load questions: ${qErr.message}`);
  }

  const questions = rawQuestions ?? [];

  // 6. Check for previous student attempt
  let { data: attempt } = await supabase
    .from("test_attempts")
    .select("*")
    .eq("test_id", testId)
    .eq("student_id", studentInfo.studentId)
    .order("created_at", { ascending: false })
    .maybeSingle();

  // If no attempt exists, start an in_progress attempt
  if (!attempt) {
    const { data: newAttempt } = await supabase
      .from("test_attempts")
      .insert({
        test_id: testId,
        student_id: studentInfo.studentId,
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    attempt = newAttempt;
  }

  return {
    test,
    questions: questions.map((q: any) => ({
      id: q.id,
      test_id: q.test_id,
      type: q.type,
      text: q.text,
      options: q.options,
      marks: q.marks || 1,
      difficulty: q.difficulty,
      question_order: q.question_order,
    })),
    existingAttempt: attempt || null,
  };
}

/**
 * Server Function: Get Test For Student
 */
export const getStudentTestFn = createServerFn({ method: "POST" })
  .validator((data: { testId: string; studentId?: string; authToken?: string }) => data)
  .handler(async ({ data }): Promise<StudentTestResponse> => {
    const supabase = getServerSupabase();
    const token = await extractAuthToken(data.authToken);
    return getStudentTestInternal(supabase, {
      ...data,
      authToken: token,
    });
  });

export interface SubmitTestPayload {
  testId: string;
  studentId?: string;
  answers: Record<string, string>; // questionId -> answer text or option index
  authToken?: string;
  authenticatedUserId?: string;
}

export interface SubmitTestResult {
  attemptId: string;
  score: number;
  totalMarks: number;
  percentage: number;
  correctCount: number;
  totalQuestions: number;
  status: string;
  submittedAt: string;
  questionResults: Array<{
    questionId: string;
    questionText: string;
    studentAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    marksAwarded: number;
    maxMarks: number;
  }>;
}

/**
 * Core business logic: Submit Test Attempt & Grade Server-Side
 * Authoritatively grades each question against true database answers, preventing client score spoofing.
 */
export async function submitTestAttemptInternal(
  supabase: SupabaseClient<any, any, any>,
  data: SubmitTestPayload,
): Promise<SubmitTestResult> {
  const { testId, studentId, answers = {}, authToken, authenticatedUserId } = data;
  if (!testId) {
    throw new Error("Missing required testId parameter.");
  }

  // 1. Authenticate student
  const studentInfo = await authenticateAndResolveStudent(supabase, {
    authToken,
    clientStudentId: studentId,
    explicitUserId: authenticatedUserId,
  });

  // 2. Fetch test details
  const { data: test, error: testErr } = await supabase
    .from("tests")
    .select("id, subject_id, total_marks, duration_min, status, starts_at, ends_at")
    .eq("id", testId)
    .single();

  if (testErr || !test) {
    throw new Error("Test not found.");
  }

  // 3. Verify student is enrolled in the subject
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, status")
    .eq("student_id", studentInfo.studentId)
    .eq("subject_id", test.subject_id)
    .eq("status", "active")
    .maybeSingle();

  if (!enrollment) {
    throw new Error("Student is not actively enrolled in this subject.");
  }

  // 4. Fetch the student's attempt record
  const { data: attempt, error: attemptErr } = await supabase
    .from("test_attempts")
    .select("*")
    .eq("test_id", testId)
    .eq("student_id", studentInfo.studentId)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (attemptErr || !attempt) {
    throw new Error(
      "No active test attempt found for this student. You must start the test first.",
    );
  }

  // 5. Enforce Attempt Ownership
  if (attempt.student_id !== studentInfo.studentId) {
    throw new Error("Unauthorized: You cannot submit another student's test attempt.");
  }

  // 6. Enforce Submission State & Replay Prevention
  if (attempt.status === "graded" || attempt.status === "submitted") {
    throw new Error(
      "Test attempt has already been submitted and finalized. Duplicate submission rejected.",
    );
  }

  // 7. Enforce Duration & Timing Constraints Server-Side
  const now = new Date();
  validateTestTimingAndAvailability({
    test,
    attempt,
    now,
  });

  // 8. Fetch authoritative questions with answer keys
  const { data: rawQuestions, error: qErr } = await supabase
    .from("test_questions")
    .select("*")
    .eq("test_id", testId)
    .order("question_order", { ascending: true });

  const questions: AuthoritativeQuestion[] = rawQuestions ?? [];

  if (qErr || questions.length === 0) {
    throw new Error("No questions found for this test.");
  }

  // 9. Authoritative server-side grading computation
  const evaluation = evaluateTestAnswers({
    questions,
    answers,
    attemptId: attempt.id,
  });

  // 10. Persist answers
  if (evaluation.dbAnswersToInsert.length > 0) {
    await supabase.from("test_answers").delete().eq("attempt_id", attempt.id);
    await supabase.from("test_answers").insert(evaluation.dbAnswersToInsert);
  }

  const nowIso = now.toISOString();

  // 11. Atomic Finalization of Attempt (only update if still in_progress)
  const { error: updateErr } = await supabase
    .from("test_attempts")
    .update({
      score: evaluation.score,
      marks_obtained: evaluation.score,
      total_marks: evaluation.totalMarks || test.total_marks,
      percentage: evaluation.percentage,
      status: "graded",
      submitted_at: nowIso,
    })
    .eq("id", attempt.id)
    .eq("status", "in_progress");

  if (updateErr) {
    throw new Error(`Failed to finalize test attempt: ${updateErr.message}`);
  }

  return {
    attemptId: attempt.id,
    score: evaluation.score,
    totalMarks: evaluation.totalMarks || test.total_marks,
    percentage: evaluation.percentage,
    correctCount: evaluation.correctCount,
    totalQuestions: evaluation.totalQuestions,
    status: "graded",
    submittedAt: nowIso,
    questionResults: evaluation.questionResults,
  };
}

/**
 * Server Function: Submit Test Attempt & Grade Server-Side
 */
export const submitTestAttemptFn = createServerFn({ method: "POST" })
  .validator((data: SubmitTestPayload) => data)
  .handler(async ({ data }): Promise<SubmitTestResult> => {
    const supabase = getServerSupabase();
    const token = await extractAuthToken(data.authToken);
    return submitTestAttemptInternal(supabase, {
      ...data,
      authToken: token,
    });
  });
