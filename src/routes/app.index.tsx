import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarCheck,
  Compass,
  Megaphone,
  PlayCircle,
  TrendingUp,
  Trophy,
} from "lucide-react";

import { HeroClassCard } from "@/components/live-class-card";
import {
  CardSkeleton,
  EmptyState,
  PageHeader,
  ProgressBar,
  SectionTitle,
  StatCard,
} from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dateTimeOf, greeting, relative } from "@/lib/format";
import {
  useStudentEnrollments,
  usePublishedAnnouncements,
  useStudentAttendanceSummary,
  useScheduledClassesBySubjects,
  useStudentTestAttempts,
} from "@/lib/db/hooks";
import { useLiveClassRealtime } from "@/lib/db/realtime";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Student dashboard — EduLive" },
      {
        name: "description",
        content:
          "Your EduLive dashboard: upcoming live class, subject progress, recent results and announcements.",
      },
      { property: "og:title", content: "Student dashboard — EduLive" },
      {
        property: "og:description",
        content: "Live class countdown, progress and results at a glance.",
      },
    ],
  }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const { student } = useSession();

  // Listen to realtime class status changes
  useLiveClassRealtime();

  const { data: enrollments = [], isLoading: loadingEnrollments } = useStudentEnrollments(
    student?.id,
  );
  const { data: announcements = [] } = usePublishedAnnouncements();
  const { data: attendanceSummary } = useStudentAttendanceSummary(student?.id);
  const { data: testAttempts = [] } = useStudentTestAttempts(student?.id);

  // Get all upcoming/live classes for enrolled subjects
  const enrolledSubjectIds = (enrollments ?? []).map((e: any) => e.subject_id);
  const { data: allUpcomingClasses = [] } = useScheduledClassesBySubjects(enrolledSubjectIds);
  const upcoming = (allUpcomingClasses ?? []).filter(
    (c: any) => c.status !== "completed" && c.status !== "cancelled" && c.status !== "draft",
  );

  const hero = upcoming.find((c: any) => c.status === "live") ?? upcoming[0];
  const recent = testAttempts[0];

  // Calculate overall progress from enrollments
  const overall =
    enrollments.length > 0
      ? Math.round(
          (enrollments ?? []).reduce((s: number, e: any) => s + (e.progress ?? 0), 0) /
            enrollments.length,
        )
      : 0;

  if (loadingEnrollments && !student?.id) {
    return (
      <div className="space-y-8">
        <PageHeader
          title={`${greeting()}, ${student?.name?.split(" ")[0] ?? "Student"} 👋`}
          subtitle="Loading your dashboard…"
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}, ${student?.name?.split(" ")[0] ?? "Student"} 👋`}
        subtitle={`${student?.standard || "10th"} Standard · ${student?.board || "CBSE"} · ${enrollments.length} enrolled ${enrollments.length === 1 ? "subject" : "subjects"}`}
        action={
          <Button asChild variant="outline">
            <Link to="/app/results">View performance</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance"
          value={`${attendanceSummary?.percentage ?? 0}%`}
          hint={`${attendanceSummary?.presentCount ?? 0} classes attended`}
          icon={CalendarCheck}
          tone="success"
        />
        <StatCard
          label="Overall progress"
          value={`${overall}%`}
          hint="Across enrolled subjects"
          icon={TrendingUp}
        />
        <StatCard
          label="Recent test"
          value={recent ? `${recent.marks_obtained ?? 0}/${recent.test?.total_marks ?? "—"}` : "—"}
          hint={recent?.test?.title ?? "No tests yet"}
          icon={Trophy}
          tone="warning"
        />
        <StatCard
          label="Learning time"
          value={`${attendanceSummary?.percentage ?? 0}h`}
          hint={`${enrollments.length ?? 0} subjects enrolled`}
          icon={PlayCircle}
          tone="accent"
        />
      </div>

      {hero ? <HeroClassCard cls={hero} /> : null}

      <section>
        <SectionTitle title="My subjects" action="Explore courses →" to="/app/courses" />
        {enrollments.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="You haven't enrolled in a course yet"
            body="Browse courses available for your standard and purchase whenever you're ready."
            action={
              <Button asChild>
                <Link to="/app/courses">Explore courses</Link>
              </Button>
            }
          />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(enrollments ?? []).map((enrollment: any) => (
            <Link
              key={enrollment.id}
              to="/app/subjects/$subjectId"
              params={{ subjectId: enrollment.subject_id }}
              className="surface block p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{enrollment.subject?.name ?? "Subject"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {enrollment.subject?.teacher?.user?.name ?? "Faculty"}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {enrollment.progress ?? 0}%
                </Badge>
              </div>
              <ProgressBar value={enrollment.progress ?? 0} className="mt-4" />
              <p className="mt-3 text-xs text-muted-foreground">
                {upcoming.find((c: any) => c.subject_id === enrollment.subject_id)
                  ? `Next class: ${dateTimeOf(
                      upcoming.find((c: any) => c.subject_id === enrollment.subject_id)
                        ?.starts_at ?? new Date(),
                    )}`
                  : "No class scheduled"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionTitle title="Continue learning" action="All recordings" to="/app/recordings" />
          <div className="space-y-3">
            {enrollments.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No lessons yet"
                body="Enroll in courses to start learning."
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Your learning materials will appear here soon.
              </p>
            )}
          </div>

          <div className="mt-6">
            <SectionTitle title="Recent results" action="All results" to="/app/results" />
            <div className="grid gap-3 sm:grid-cols-2">
              {testAttempts.slice(0, 4).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No test attempts yet. Take a test to see your results here.
                </p>
              ) : (
                testAttempts.slice(0, 4).map((attempt: any) => (
                  <div key={attempt.id} className="surface p-4">
                    <p className="truncate text-sm font-medium">{attempt.test?.title ?? "Test"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {relative(attempt.submitted_at || attempt.created_at)}
                    </p>
                    <div className="mt-3 flex items-end justify-between">
                      <p className="text-2xl font-semibold">
                        {attempt.marks_obtained ?? 0}
                        <span className="text-sm text-muted-foreground">
                          /{attempt.test?.total_marks}
                        </span>
                      </p>
                      <Badge
                        variant="secondary"
                        className={
                          (attempt.marks_obtained ?? 0) / (attempt.test?.total_marks ?? 1) >= 0.75
                            ? "bg-success/15 text-success"
                            : "bg-warning/20"
                        }
                      >
                        {Math.round(
                          ((attempt.marks_obtained ?? 0) / (attempt.test?.total_marks ?? 1)) * 100,
                        )}
                        %
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          <SectionTitle title="Announcements" />
          {(announcements ?? []).slice(0, 3).map((a: any) => (
            <div key={a.id} className="surface p-4">
              <div className="flex items-center gap-2 text-primary">
                <Megaphone className="size-4" />
                <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{a.body}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {relative(a.published_at || a.created_at)}
              </p>
            </div>
          ))}
          {announcements.length === 0 ? (
            <div className="surface p-4">
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            </div>
          ) : null}
          <div className="surface p-4">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-accent-foreground" />
              <p className="text-sm font-medium">Add another subject</p>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Browse available courses to expand your learning.
            </p>
            <Button asChild size="sm" className="mt-3 w-full">
              <Link to="/app/courses">Browse courses</Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
