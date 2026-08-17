import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock, Lock, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { CardSkeleton, EmptyState, PageHeader, SectionTitle } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dateTimeOf } from "@/lib/format";
import { useStudentEnrollments } from "@/lib/db/hooks";
import { testService } from "@/lib/db";
import { useSession } from "@/lib/session";
import type { FacultyTest } from "@/lib/db/types";

export const Route = createFileRoute("/app/tests/")({
  head: () => ({
    meta: [
      { title: "Tests — EduLive" },
      {
        name: "description",
        content: "Timed tests published by faculty with instant evaluation and answer keys.",
      },
      { property: "og:title", content: "Tests — EduLive" },
      { property: "og:description", content: "Attempt tests and see instant scores." },
    ],
  }),
  component: TestsPage,
});

function windowState(t: FacultyTest): "upcoming" | "open" | "closed" {
  const now = Date.now();
  if (now < new Date(t.starts_at || "").getTime()) return "upcoming";
  if (now > new Date(t.ends_at || "").getTime()) return "closed";
  return "open";
}

function TestsPage() {
  const { student } = useSession();
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useStudentEnrollments(
    student?.id,
  );

  const enrolledSubjectIds = enrollments.map((e: any) => e.subject_id);

  const { data: allTests = [], isLoading: testsLoading } = useQuery({
    queryKey: ["tests-by-subjects", enrolledSubjectIds],
    queryFn: async () => {
      if (!enrolledSubjectIds.length) return [];
      const results = await Promise.all(
        enrolledSubjectIds.map((id: string) => testService.listBySubject(id)),
      );
      return results
        .flat()
        .sort(
          (a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
        );
    },
    enabled: enrolledSubjectIds.length > 0,
  });

  if (enrolledSubjectIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tests" subtitle="Timed tests with automatic evaluation" />
        <EmptyState
          icon={Lock}
          title="You're not enrolled in any subject yet"
          body="Enroll in a course to unlock its tests."
          action={
            <Button asChild>
              <Link to="/app/courses">Browse courses</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (enrollmentsLoading || testsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tests" subtitle="Loading your tests…" />
        <CardSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tests"
        subtitle="Timed tests with automatic evaluation, published by your faculty"
      />
      <section>
        <SectionTitle title="Available tests" />
        {allTests.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No tests published yet"
            body="Your faculty hasn't published any tests for your subjects."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {allTests.map((t: any) => {
              const state = windowState(t);
              return <TestCard key={t.id} test={t} state={state} studentId={student?.id} />;
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function TestCard({
  test,
  state,
  studentId,
}: {
  test: FacultyTest;
  state: "upcoming" | "open" | "closed";
  studentId: string | undefined;
}) {
  const { data: attempt } = useQuery({
    queryKey: ["test-attempt", test.id, studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const results = await testService.getStudentAttempt(test.id, studentId);
      return results;
    },
    enabled: !!studentId,
  });

  return (
    <article className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-warning/20 text-warning-foreground">
          <Trophy className="size-5" />
        </span>
        <Badge variant="outline">{test.total_marks} marks</Badge>
      </div>
      <p className="mt-4 truncate text-sm font-semibold">{test.title}</p>
      <p className="truncate text-xs text-muted-foreground">{test.subject?.name ?? "Subject"}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {test.total_marks ?? 0} marks · {test.duration_min ?? 0} min
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3.5" />
        {dateTimeOf(test.starts_at || "")} — {dateTimeOf(test.ends_at || "")}
      </p>
      {attempt ? (
        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-success">
          <CheckCircle2 className="size-3.5" /> Scored {attempt.marks_obtained ?? 0}/
          {test.total_marks}
        </p>
      ) : null}
      <Button asChild className="mt-4 w-full" size="sm" disabled={state !== "open" && !attempt}>
        <Link to="/app/tests/$testId" params={{ testId: test.id }}>
          {state === "upcoming" && !attempt
            ? "Opens soon"
            : state === "closed" && !attempt
              ? "Window closed"
              : attempt
                ? "Re-attempt"
                : "Start test"}
        </Link>
      </Button>
    </article>
  );
}
