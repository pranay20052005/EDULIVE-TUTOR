import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Plus,
  Radio,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { CardSkeleton, EmptyState, PageHeader, SectionTitle, StatCard } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dateTimeOf, greeting, relative, timeOf } from "@/lib/format";
import {
  enrollmentService,
  testService,
  scheduledClassService,
  assignmentService,
  materialService,
  questionPaperService,
} from "@/lib/db";
import { useTeacherSubjects } from "@/lib/db/hooks";
import { useLiveClassRealtime } from "@/lib/db/realtime";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/teacher/")({
  head: () => ({
    meta: [
      { title: "Faculty dashboard — EduLive" },
      {
        name: "description",
        content: "Start live classes, review submissions and track your students' progress.",
      },
      { property: "og:title", content: "Faculty dashboard — EduLive" },
      { property: "og:description", content: "Your classes, students and pending reviews." },
    ],
  }),
  component: TeacherHome,
});

function TeacherHome() {
  const { session, teacher } = useSession();

  // Listen to realtime live class updates
  useLiveClassRealtime();

  const { data: subjects = [], isLoading: subjectsLoading } = useTeacherSubjects(teacher.id);
  const mySubjectIds = subjects.map((s) => s.id);

  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: ["teacher-classes", teacher.id],
    queryFn: async () => (teacher.id ? scheduledClassService.listByTeacher(teacher.id) : []),
    enabled: !!teacher.id,
  });

  const { data: tests = [], isLoading: testsLoading } = useQuery({
    queryKey: ["teacher-tests", teacher.id],
    queryFn: async () => (teacher.id ? testService.listByTeacher(teacher.id) : []),
    enabled: !!teacher.id,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["teacher-assignments", teacher.id],
    queryFn: async () => (teacher.id ? assignmentService.listByTeacher(teacher.id) : []),
    enabled: !!teacher.id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["teacher-materials", session?.id, mySubjectIds],
    queryFn: async () =>
      session?.id ? materialService.listByTeacher(session.id, mySubjectIds) : [],
    enabled: !!session?.id,
  });

  const { data: questionPapers = [] } = useQuery({
    queryKey: ["teacher-question-papers", teacher.id],
    queryFn: async () => (teacher.id ? questionPaperService.listByTeacher(teacher.id) : []),
    enabled: !!teacher.id,
  });

  const { data: studentCount = 0, isLoading: rosterLoading } = useQuery({
    queryKey: ["teacher-student-count", teacher.id],
    queryFn: async () => {
      if (!teacher.id || mySubjectIds.length === 0) return 0;
      const enrollments = await Promise.all(
        mySubjectIds.map((subjectId) => enrollmentService.getSubjectEnrollments(subjectId)),
      );
      const ids = new Set(enrollments.flat().map((entry) => entry.student_id));
      return ids.size;
    },
    enabled: !!teacher.id,
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysSchedule = classes
    .filter((c) => mySubjectIds.includes(c.subject_id) && c.starts_at.slice(0, 10) === todayStr)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const pendingReviews = assignments.filter((a) => a.status === "published").length;

  const allContent = [...tests, ...classes, ...assignments, ...notes, ...questionPapers].filter(
    (c: any) => (c.subject_id ? mySubjectIds.includes(c.subject_id) : true),
  );
  const published = allContent.filter((c: any) => c.status === "published").length;

  const activity = [...allContent]
    .sort((a: any, b: any) => +new Date(b.created_at || 0) - +new Date(a.created_at || 0))
    .slice(0, 8);

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "Subject";

  if (subjectsLoading || classesLoading || testsLoading || rosterLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Faculty dashboard" subtitle="Loading your teaching day…" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} rows={2} />
          ))}
        </div>
        <CardSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting()}, ${teacher.name.split(" ")[0]}`}
        subtitle="Here is your teaching day"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subjects" value={`${mySubjectIds.length}`} icon={BookOpen} />
        <StatCard label="Students" value={`${studentCount}`} icon={Users} tone="accent" />
        <StatCard
          label="Pending reviews"
          value={`${pendingReviews}`}
          hint="assignments to grade"
          icon={ClipboardList}
          tone="warning"
        />
        <StatCard
          label="Published content"
          value={`${published}`}
          hint={`${allContent.length} total items`}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      <section>
        <SectionTitle title="Today's schedule" />
        {todaysSchedule.length ? (
          <div className="space-y-3">
            {todaysSchedule.map((c) => (
              <div key={c.id} className="surface flex items-center gap-4 p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Radio className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {subjects.find((s) => s.id === c.subject_id)?.name ?? "Subject"} ·{" "}
                    {timeOf(c.starts_at)} – {timeOf(c.ends_at)}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link to="/teacher/live">Open</Link>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="No classes scheduled today"
            body="Head to Live Classes to schedule your next session."
          />
        )}
      </section>

      <section>
        <SectionTitle title="Quick actions" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickAction
            to="/teacher/assignments?new=true"
            icon={ClipboardList}
            label="Add New Assignment"
          />
          <QuickAction to="/teacher/tests/new" icon={Trophy} label="Add Test" />
          <QuickAction
            to="/teacher/question-papers?new=true"
            icon={FileText}
            label="Add Question Paper"
          />
          <QuickAction to="/teacher/notes?new=true" icon={BookOpen} label="Upload Notes" />
          <QuickAction to="/teacher/live?new=true" icon={Video} label="Schedule Live Class" />
          <QuickAction to="/teacher/attendance" icon={CalendarDays} label="Mark Attendance" />
        </div>
      </section>

      <section className="surface p-5">
        <SectionTitle title="Recent activity" />
        {activity.length ? (
          <div className="space-y-3">
            {activity.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {subjectName(c.subject_id)} · {relative(c.created_at)}
                  </p>
                </div>
                <Badge
                  variant={c.status === "published" ? "secondary" : "outline"}
                  className="shrink-0 capitalize"
                >
                  {c.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No activity yet"
            body="Content you create will show up here."
          />
        )}
      </section>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof FileText;
  label: string;
}) {
  return (
    <Button asChild variant="outline" className="h-auto justify-start gap-3 p-4">
      <Link to={to}>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <span className="flex flex-1 items-center justify-between text-sm font-medium">
          {label}
          <Plus className="size-4 text-muted-foreground" />
        </span>
      </Link>
    </Button>
  );
}
