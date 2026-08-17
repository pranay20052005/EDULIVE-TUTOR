import { Link, createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  Lock,
  FileText,
  PlayCircle,
  Trophy,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { ClassRow } from "@/components/live-class-card";
import { CardSkeleton, EmptyState, LiveBadge, PageHeader, ProgressBar } from "@/components/ui-kit";
import { useSession } from "@/lib/session";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dateTimeOf, relative } from "@/lib/format";
import {
  useSubject,
  useChaptersBySubject,
  useScheduledClassesBySubject,
  useRecordingsBySubject,
  useMaterialsBySubject,
  useAssignmentsBySubject,
  useStudentTestAttempts,
} from "@/lib/db/hooks";
import { testService } from "@/lib/db";
import type {
  Subject,
  Chapter,
  ScheduledClass,
  Material,
  FacultyAssignment,
  FacultyTest,
  TestAttempt,
  Recording,
} from "@/lib/db/types";

export const Route = createFileRoute("/app/subjects/$subjectId")({
  head: () => ({
    meta: [
      { title: "Subject — EduLive" },
      {
        name: "description",
        content:
          "Chapters, live classes, recordings, notes, assignments and tests for this subject.",
      },
      { property: "og:title", content: "Subject" },
      { property: "og:description", content: "Everything for this subject in one place." },
    ],
  }),
  component: SubjectDetail,
});

function SubjectDetail() {
  const { subjectId } = Route.useParams();
  const { isEnrolled } = useSession();
  const { data: subject, isLoading } = useSubject(subjectId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Subject" subtitle="Loading course content…" />
        <CardSkeleton rows={4} />
      </div>
    );
  }

  if (!subject) {
    return (
      <EmptyState
        icon={Lock}
        title="Subject not found"
        body="The requested course could not be located."
      />
    );
  }

  if (!isEnrolled(subjectId)) return <NotEnrolled subject={subject} />;

  return <SubjectContent subject={subject} />;
}

function NotEnrolled({ subject }: { subject: Subject }) {
  const teacherName = subject.teacher?.user?.name || "EduLive Faculty";
  return (
    <div className="space-y-6">
      <PageHeader
        title={subject.name}
        subtitle={`${subject.standard || "10th"} Standard · ${teacherName}`}
      />
      <EmptyState
        icon={Lock}
        title="You're not enrolled in this course."
        body="Purchase this course to unlock its live classes, recordings, notes, assignments, tests and progress tracking."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline">
              <Link to="/app/courses/$subjectId" params={{ subjectId: subject.id }}>
                View Course
              </Link>
            </Button>
            <Button asChild>
              <Link to="/app/checkout/$subjectId" params={{ subjectId: subject.id }}>
                Purchase Course
              </Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}

function SubjectContent({ subject }: { subject: Subject }) {
  const { student } = useSession();
  const subjectId = subject.id;

  const { data: chapters = [] } = useChaptersBySubject(subjectId);
  const { data: scheduledClasses = [] } = useScheduledClassesBySubject(subjectId);
  const { data: recordings = [] } = useRecordingsBySubject(subjectId);
  const { data: materials = [] } = useMaterialsBySubject(subjectId);
  const { data: assignments = [] } = useAssignmentsBySubject(subjectId);
  const { data: attempts = [] } = useStudentTestAttempts(student?.id);

  const { data: tests = [] } = useQuery({
    queryKey: ["subject-tests", subjectId],
    queryFn: () => testService.listBySubject(subjectId, { status: "published" }),
    enabled: !!subjectId,
  });

  const upcoming = scheduledClasses
    .filter((c: ScheduledClass) => c.status !== "completed")
    .sort(
      (a: ScheduledClass, b: ScheduledClass) => +new Date(a.starts_at) - +new Date(b.starts_at),
    );

  const teacherName = subject.teacher?.user?.name || "EduLive Faculty";

  return (
    <div className="space-y-6">
      <PageHeader
        title={subject.name}
        subtitle={`${teacherName} · ${subject.standard || "10th"} Standard`}
        action={
          upcoming[0] ? (
            <Button asChild>
              <Link to="/classroom/$classId" params={{ classId: upcoming[0].id }}>
                {upcoming[0].status === "live" ? "Join live class" : "Next class"}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="surface p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall progress</span>
          <span className="text-muted-foreground">0%</span>
        </div>
        <ProgressBar value={0} className="mt-3" />
      </div>

      <Tabs defaultValue="chapters">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="chapters">Chapters</TabsTrigger>
          <TabsTrigger value="live">Live classes</TabsTrigger>
          <TabsTrigger value="recordings">Recordings</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="tests">Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="chapters" className="mt-4">
          {chapters.length ? (
            <div className="surface p-2 sm:p-4">
              <Accordion type="single" collapsible defaultValue={chapters[0]?.id ?? ""}>
                {chapters.map((c: Chapter, i: number) => (
                  <AccordionItem key={c.id} value={c.id}>
                    <AccordionTrigger className="px-2 text-left">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold">
                          {c.chapter_order ?? i + 1}
                        </span>
                        <span className="truncate text-sm font-medium">{c.title}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2 px-2">
                      <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
                        {c.description || "Chapter lessons and learning goals."}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No chapters listed"
              body="Chapters for this subject will appear here once published."
            />
          )}
        </TabsContent>

        <TabsContent value="live" className="mt-4 space-y-3">
          {upcoming.length ? (
            upcoming.map((c: ScheduledClass) => <ClassRow key={c.id} cls={c} />)
          ) : (
            <EmptyState
              icon={PlayCircle}
              title="No upcoming classes"
              body="Your teacher hasn't scheduled the next session yet."
            />
          )}
        </TabsContent>

        <TabsContent value="recordings" className="mt-4 space-y-3">
          {recordings.map((r: Recording) => (
            <div key={r.id} className="surface flex items-center gap-4 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <PlayCircle className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.topic || "Topic"} · {r.duration_min || 45} min · recorded{" "}
                  {relative(r.created_at)}
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link to="/app/recordings">Watch</Link>
              </Button>
            </div>
          ))}
          {recordings.length === 0 ? (
            <EmptyState
              icon={PlayCircle}
              title="No recordings yet"
              body="Recordings appear here after each live class ends."
            />
          ) : null}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 grid gap-3 sm:grid-cols-2">
          {materials.map((m: Material) => (
            <div key={m.id} className="surface flex items-start gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-foreground">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.file_type} ·{" "}
                  {m.file_size_kb ? `${Math.round(m.file_size_kb / 10) / 100} MB` : "PDF"} ·{" "}
                  {relative(m.created_at)}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="shrink-0" asChild>
                <a href={m.file_url || "#"} target="_blank" rel="noopener noreferrer">
                  <Download className="size-4" />
                </a>
              </Button>
            </div>
          ))}
          {materials.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No material yet"
              body="Notes and worksheets will appear here."
            />
          ) : null}
        </TabsContent>

        <TabsContent value="assignments" className="mt-4 space-y-3">
          {assignments.map((a: FacultyAssignment) => (
            <div key={a.id} className="surface flex items-center gap-3 p-4">
              <ClipboardList className="size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">Due {dateTimeOf(a.due_at)}</p>
              </div>
              <Badge variant="secondary" className="shrink-0 capitalize">
                {a.status}
              </Badge>
            </div>
          ))}
          {assignments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Nothing due"
              body="No assignments for this subject right now."
            />
          ) : null}
        </TabsContent>

        <TabsContent value="tests" className="mt-4 space-y-3">
          {tests.map((t: FacultyTest) => {
            const attempt = attempts.find((att: TestAttempt) => att.test_id === t.id);
            return (
              <div key={t.id} className="surface flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Trophy className="size-5 shrink-0 text-warning-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.duration_min} min · {t.total_marks} marks
                      {attempt ? ` · Scored ${attempt.marks_obtained ?? 0}/${t.total_marks}` : ""}
                    </p>
                  </div>
                </div>
                <Button asChild size="sm" className="shrink-0">
                  <Link to="/app/tests/$testId" params={{ testId: t.id }}>
                    {attempt ? "Re-attempt" : "Start"}
                  </Link>
                </Button>
              </div>
            );
          })}
          {tests.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No tests available"
              body="Tests scheduled by your faculty will appear here."
            />
          ) : null}
        </TabsContent>
      </Tabs>

      {upcoming.some((c: ScheduledClass) => c.status === "live") ? (
        <div className="flex items-center gap-2 text-sm">
          <LiveBadge /> <span className="text-muted-foreground">A class is running right now.</span>
        </div>
      ) : null}
    </div>
  );
}
