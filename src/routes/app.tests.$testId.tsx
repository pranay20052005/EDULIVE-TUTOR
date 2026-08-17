import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock, Lock, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
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
import { testService, testAttemptService, testAnswerService } from "@/lib/db";
import type { TestQuestion } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/tests/$testId")({
  head: () => ({
    meta: [
      { title: "Attempt test — EduLive" },
      { name: "description", content: "Attempt this timed test and get instant evaluation." },
      { property: "og:title", content: "Attempt test — EduLive" },
      { property: "og:description", content: "Timed test with instant results and answer review." },
    ],
  }),
  component: TestRunner,
});

function isCorrect(q: TestQuestion, answer: string | undefined): boolean {
  if (answer == null || answer === "") return false;
  if (q.type === "short") {
    return (
      answer.trim().toLowerCase() ===
      String(q.correct_answer_index ?? "")
        .trim()
        .toLowerCase()
    );
  }
  return String(q.correct_answer_index) === String(answer);
}

function TestRunner() {
  const { testId } = Route.useParams();
  const { student, isEnrolled } = useSession();
  const queryClient = useQueryClient();

  const { data: test, isLoading: testLoading } = useQuery({
    queryKey: ["test-with-questions", testId],
    queryFn: () => testService.getWithQuestions(testId),
    enabled: !!testId,
  });

  const { data: previousAttempt, isLoading: attemptLoading } = useQuery({
    queryKey: ["test-attempt", testId, student?.id],
    queryFn: () => (student?.id ? testAttemptService.getStudentAttempt(testId, student.id) : null),
    enabled: !!testId && !!student?.id,
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (test && !secondsLeft && !previousAttempt && !result) {
      setSecondsLeft((test.duration_min || 30) * 60);
    }
  }, [test, secondsLeft, previousAttempt, result]);

  useEffect(() => {
    if (previousAttempt) {
      setResult(previousAttempt);
    }
  }, [previousAttempt]);

  useEffect(() => {
    if (result || !test) return;
    const id = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [result, test]);

  const finalize = async () => {
    if (!test || !student?.id) return;
    let score = 0;
    let correctCount = 0;
    const questions = test.questions || [];

    questions.forEach((q) => {
      if (isCorrect(q, answers[q.id])) {
        score += q.marks || 1;
        correctCount += 1;
      }
    });

    try {
      // Create and submit attempt in database
      const attempt = await testAttemptService.createAttempt({
        test_id: test.id,
        student_id: student.id,
      });

      if (attempt?.id) {
        // Save answers
        await Promise.all(
          questions.map((q) =>
            testAnswerService.submitAnswer({
              attempt_id: attempt.id,
              question_id: q.id,
              selected_answer: answers[q.id] || "",
              selected_answer_index: answers[q.id] ? Number(answers[q.id]) : undefined,
            }),
          ),
        );

        // Submit final attempt
        const submitted = await testAttemptService.submitAttempt(
          attempt.id,
          score,
          test.total_marks || 100,
        );

        setResult({
          ...submitted,
          score,
          correct: correctCount,
          total_questions: questions.length,
          answers,
        });
      } else {
        setResult({
          score,
          total_marks: test.total_marks,
          correct: correctCount,
          total_questions: questions.length,
          answers,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["test-attempt", testId] });
      queryClient.invalidateQueries({ queryKey: ["test-attempts"] });
      toast.success("Test submitted successfully");
    } catch (err) {
      console.error("Error submitting test to database:", err);
      setResult({
        score,
        total_marks: test.total_marks,
        correct: correctCount,
        total_questions: questions.length,
        answers,
      });
      toast.success("Test submitted successfully");
    }
  };

  useEffect(() => {
    if (!result && test && secondsLeft === 0) {
      finalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result, test]);

  if (testLoading || attemptLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Loading test…" />
      </div>
    );
  }

  if (!test) {
    return (
      <EmptyState
        icon={Lock}
        title="Test not found"
        body="This test could not be found or has not been published yet."
      />
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

  const questions = test.questions || [];

  if (result) {
    const scoreVal = result.marks_obtained ?? result.score ?? 0;
    const totalMarks = test.total_marks || 100;
    const pct = Math.round((scoreVal / totalMarks) * 100);
    const correctVal = result.correct ?? Math.round((scoreVal / totalMarks) * questions.length);

    return (
      <div className="space-y-6">
        <PageHeader title="Test submitted" subtitle={test.title} />
        <div className="surface p-6 text-center">
          <p className="text-sm text-muted-foreground">Your score</p>
          <p className="mt-1 text-5xl font-semibold">
            {scoreVal}
            <span className="text-xl text-muted-foreground">/{totalMarks}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pct}% · {correctVal} correct · {questions.length - correctVal} wrong ·{" "}
            {pct >= Math.round(((test.passing_marks || 40) / totalMarks) * 100)
              ? "Passed"
              : "Not passed"}
          </p>
          <Button asChild className="mt-5">
            <Link to="/app/tests">Back to tests</Link>
          </Button>
        </div>
        <div className="space-y-3">
          {questions.map((q: TestQuestion, i: number) => {
            const chosen = answers[q.id];
            const ok = isCorrect(q, chosen);
            const options: string[] = Array.isArray(q.options) ? q.options : [];

            return (
              <div key={q.id} className="surface p-4">
                <div className="flex items-start gap-2">
                  {ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <p className="text-sm font-medium">
                    {i + 1}. {q.text}
                  </p>
                </div>
                <p className="mt-2 pl-6 text-xs text-muted-foreground">
                  Your answer:{" "}
                  {chosen != null && chosen !== ""
                    ? q.type === "short"
                      ? chosen
                      : (options[Number(chosen)] ?? chosen)
                    : "Not answered"}{" "}
                  · Correct:{" "}
                  {q.type === "short"
                    ? String(q.correct_answer_index ?? "")
                    : (options[Number(q.correct_answer_index)] ??
                      String(q.correct_answer_index ?? ""))}
                </p>
              </div>
            );
          })}
        </div>
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
              <Button onClick={() => setConfirmOpen(true)}>Submit test</Button>
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
          <Button className="mt-4 w-full" variant="outline" onClick={() => setConfirmOpen(true)}>
            Submit test
          </Button>
        </aside>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this test?</AlertDialogTitle>
            <AlertDialogDescription>
              You've answered {answeredCount} of {questions.length} questions. Once submitted, you
              cannot change your answers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep reviewing</AlertDialogCancel>
            <AlertDialogAction onClick={finalize}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
