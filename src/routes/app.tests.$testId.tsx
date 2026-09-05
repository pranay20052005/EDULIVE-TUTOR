import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock, Lock, XCircle, Loader2 } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState, PageHeader } from "@/components/ui-kit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { dateTimeOf } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/db/client";
import { getStudentTestFn, submitTestAttemptFn } from "@/lib/server/test-functions";
import type { StudentSanitizedQuestion, SubmitTestResult } from "@/lib/server/test-functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/tests/$testId")({
  head: ({ params }) => {
    const title = "Attempt Test — EduLive";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: `Attempt timed test ${params.testId} on EduLive with instant server-side evaluation and analytics.`,
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content:
            "Timed mock test with server-side grading, answer key review, and instant results.",
        },
      ],
    };
  },
  component: TestRunner,
});

function TestRunner() {
  const { testId } = Route.useParams();
  const { student, isEnrolled } = useSession();
  const queryClient = useQueryClient();

  const studentLookupId = student?.id || student?.userId || "";

  // Secure test retrieval with answers stripped on the server
  const {
    data: testData,
    isLoading: testLoading,
    isError,
  } = useQuery({
    queryKey: ["student-test", testId, studentLookupId],
    queryFn: async () => {
      if (!testId || !studentLookupId) return null;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return getStudentTestFn({
        data: {
          testId,
          studentId: studentLookupId,
          authToken: session?.access_token,
        },
      });
    },
    enabled: !!testId && !!studentLookupId,
  });

  const test = testData?.test;
  const questions = useMemo(() => testData?.questions || [], [testData?.questions]);
  const existingAttempt = testData?.existingAttempt;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<SubmitTestResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (test && !secondsLeft && !existingAttempt && !result) {
      setSecondsLeft((test.duration_min || 30) * 60);
    }
  }, [test, secondsLeft, existingAttempt, result]);

  useEffect(() => {
    if (existingAttempt && !result) {
      setResult({
        attemptId: existingAttempt.id,
        score: existingAttempt.score ?? existingAttempt.marks_obtained ?? 0,
        totalMarks: existingAttempt.total_marks || test?.total_marks || 100,
        percentage: Number(existingAttempt.percentage) || 0,
        correctCount: 0,
        totalQuestions: questions.length,
        status: existingAttempt.status || "graded",
        submittedAt: existingAttempt.submitted_at || existingAttempt.created_at,
        questionResults: [],
      });
    }
  }, [existingAttempt, result, test, questions]);

  useEffect(() => {
    if (result || !test) return;
    const id = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [result, test]);

  // Server-side authoritative grading
  const finalize = async () => {
    if (!test || !studentLookupId || submitting) return;
    setSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const evaluation = await submitTestAttemptFn({
        data: {
          testId: test.id,
          studentId: studentLookupId,
          answers,
          authToken: session?.access_token,
        },
      });

      setResult(evaluation);
      queryClient.invalidateQueries({ queryKey: ["student-test", testId] });
      queryClient.invalidateQueries({ queryKey: ["test-attempt", testId] });
      queryClient.invalidateQueries({ queryKey: ["test-attempts"] });
      toast.success("Test submitted & evaluated successfully!");
    } catch (err: any) {
      console.error("Error submitting test:", err);
      toast.error(err.message || "Failed to submit test. Please try again.");
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  useEffect(() => {
    if (!result && test && secondsLeft === 0 && questions.length > 0) {
      finalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result, test, questions]);

  if (testLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Loading test…" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (isError || !test) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={Lock}
          title="Test not found or access restricted"
          body="This test could not be found or you may not be actively enrolled in its subject."
          action={
            <Button asChild>
              <Link to="/app/courses">Browse courses</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (test.subject_id && !isEnrolled(test.subject_id)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Test locked" />
        <EmptyState
          icon={Lock}
          title="You're not enrolled in this subject"
          body="Enroll in this subject to attempt its tests."
          action={
            <Button asChild>
              <Link to="/app/courses">Browse courses</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const now = Date.now();
  const notStarted = test.starts_at ? now < new Date(test.starts_at).getTime() : false;
  const ended = test.ends_at ? now > new Date(test.ends_at).getTime() : false;

  if ((notStarted || ended) && !result) {
    return (
      <div className="space-y-6">
        <PageHeader title={test.title} subtitle={test.subject?.name || "Subject"} />
        <EmptyState
          icon={Clock}
          title={notStarted ? "This test isn't open yet" : "This test window has closed"}
          body={`Available ${dateTimeOf(test.starts_at || "")} — ${dateTimeOf(test.ends_at || "")}.`}
          action={
            <Button asChild variant="outline">
              <Link to="/app/tests">Back to tests</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (result) {
    const scoreVal = result.score ?? 0;
    const totalMarks = result.totalMarks || test.total_marks || 100;
    const pct = result.percentage ?? Math.round((scoreVal / totalMarks) * 100);
    const passingMarks = test.passing_marks || Math.round(totalMarks * 0.4);
    const isPassed = scoreVal >= passingMarks;

    return (
      <div className="space-y-6">
        <PageHeader title="Test Results & Evaluation" subtitle={test.title} />
        <div className="surface p-6 text-center">
          <p className="text-sm text-muted-foreground">Your score (Evaluated Server-Side)</p>
          <p className="mt-1 text-5xl font-semibold">
            {scoreVal}
            <span className="text-xl text-muted-foreground">/{totalMarks}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pct}% · {result.correctCount} correct of {result.totalQuestions || questions.length}{" "}
            questions ·{" "}
            <span className={cn("font-semibold", isPassed ? "text-success" : "text-destructive")}>
              {isPassed ? "Passed" : "Not passed"}
            </span>
          </p>
          <Button asChild className="mt-5">
            <Link to="/app/tests">Back to tests</Link>
          </Button>
        </div>

        {/* Detailed Question Review if available */}
        {result.questionResults && result.questionResults.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground px-1">Answer Breakdown</h3>
            {result.questionResults.map((qr, i) => (
              <div key={qr.questionId} className="surface p-4">
                <div className="flex items-start gap-2">
                  {qr.isCorrect ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {i + 1}. {qr.questionText}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Your answer:{" "}
                      <span
                        className={cn(
                          "font-medium",
                          qr.isCorrect ? "text-success" : "text-destructive",
                        )}
                      >
                        {qr.studentAnswer || "Not answered"}
                      </span>{" "}
                      · Correct answer:{" "}
                      <span className="font-medium text-foreground">{qr.correctAnswer}</span> ·
                      Marks: {qr.marksAwarded}/{qr.maxMarks}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="space-y-6">
        <PageHeader title={test.title} />
        <EmptyState
          icon={Lock}
          title="No questions in this test"
          body="Your teacher has not added questions to this test yet."
        />
      </div>
    );
  }

  const q = questions[current]!;
  const answeredCount = questions.filter(
    (x) => answers[x.id] != null && answers[x.id] !== "",
  ).length;
  const options: string[] = Array.isArray(q.options) ? q.options : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={test.title}
        subtitle={`${questions.length} questions · ${test.total_marks} marks`}
        action={
          <span className="inline-flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-medium">
            <Clock className="size-4" />
            {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
            {String(secondsLeft % 60).padStart(2, "0")}
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="surface p-5">
          <p className="text-xs text-muted-foreground">
            Question {current + 1} of {questions.length} · {q.marks || 1} marks
          </p>
          <p className="mt-2 text-base font-medium">{q.text}</p>

          {q.type === "short" ? (
            <Textarea
              className="mt-4"
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              placeholder="Type your answer…"
              aria-label={`Answer for question ${current + 1}`}
            />
          ) : (
            <div className="mt-4 space-y-2">
              {options.map((opt, i) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: String(i) }))}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left text-sm transition-all",
                    answers[q.id] === String(i)
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
            >
              Previous
            </Button>
            {current < questions.length - 1 ? (
              <Button onClick={() => setCurrent((c) => c + 1)}>Next</Button>
            ) : (
              <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit test"}
              </Button>
            )}
          </div>
        </div>

        <aside className="surface h-max p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            Questions · {answeredCount}/{questions.length} answered
          </p>
          <div className="mt-3 grid grid-cols-6 gap-2 lg:grid-cols-4">
            {questions.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setCurrent(i)}
                className={cn(
                  "grid size-9 place-items-center rounded-lg text-sm font-medium transition-colors",
                  i === current
                    ? "bg-primary text-primary-foreground"
                    : answers[x.id] != null && answers[x.id] !== ""
                      ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <Button
            className="mt-4 w-full"
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit test"}
          </Button>
        </aside>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this test?</AlertDialogTitle>
            <AlertDialogDescription>
              You've answered {answeredCount} of {questions.length} questions. Once submitted, your
              answers will be evaluated authoritatively on the server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Keep reviewing</AlertDialogCancel>
            <AlertDialogAction onClick={finalize} disabled={submitting}>
              {submitting ? "Evaluating…" : "Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
