import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpen, Compass } from "lucide-react";

import { CardSkeleton, EmptyState, PageHeader, ProgressBar } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dateTimeOf } from "@/lib/format";
import {
  useStudentEnrollments,
  useChaptersBySubject,
  useScheduledClassesBySubject,
} from "@/lib/db/hooks";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/app/subjects/")({
  head: () => ({
    meta: [
      { title: "My subjects — EduLive" },
      {
        name: "description",
        content: "Subjects you have purchased, with progress and your next live class.",
      },
      { property: "og:title", content: "My subjects — EduLive" },
      { property: "og:description", content: "Track progress subject by subject." },
    ],
  }),
  component: SubjectsPage,
});

function SubjectsPage() {
  const { student } = useSession();
  const { data: enrollments = [], isLoading } = useStudentEnrollments(student?.id);

  if (isLoading && !student?.id) {
    return (
      <div className="space-y-8">
        <PageHeader title="My subjects" subtitle="Loading your enrolled courses…" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        title="My subjects"
        subtitle={`${enrollments.length} enrolled · ${student?.standard || "10th"} Standard · ${student?.board || "CBSE"}`}
        action={
          <Button asChild variant="outline">
            <Link to="/app/courses">
              <Compass className="size-4" /> Explore courses
            </Link>
          </Button>
        }
      />

      {enrollments.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {enrollments.map((enrollment: any) => (
            <SubjectCard key={enrollment.id} enrollment={enrollment} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No subjects yet"
          body="You haven't purchased any course so far. Explore the catalogue and enroll whenever you're ready — nothing is charged until you choose."
          action={
            <Button asChild>
              <Link to="/app/courses">
                <Compass className="size-4" /> Explore courses
              </Link>
            </Button>
          }
        />
      )}
    </div>
  );
}

function SubjectCard({ enrollment }: { enrollment: any }) {
  const { data: chapters = [] } = useChaptersBySubject(enrollment.subject_id);
  const { data: classes = [] } = useScheduledClassesBySubject(enrollment.subject_id);
  const nextClass = classes?.find((c: any) => c.status !== "completed");

  return (
    <Link
      to="/app/subjects/$subjectId"
      params={{ subjectId: enrollment.subject_id }}
      className="surface group block p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/20 text-primary transition-transform duration-300 group-hover:scale-105">
          <BookOpen className="size-5" />
        </span>
        <Badge variant="secondary">{chapters.length} chapters</Badge>
      </div>
      <p className="mt-4 truncate text-lg font-semibold">{enrollment.subject?.name}</p>
      <p className="truncate text-xs text-muted-foreground">
        {enrollment.subject?.teacher?.user?.name ?? "Faculty"}
      </p>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{enrollment.progress ?? 0}% completed</span>
        <span>{nextClass ? dateTimeOf(nextClass.starts_at) : "—"}</span>
      </div>
      <ProgressBar value={enrollment.progress ?? 0} className="mt-2" />
    </Link>
  );
}
