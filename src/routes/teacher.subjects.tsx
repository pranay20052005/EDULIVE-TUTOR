import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpen, ClipboardList, FileQuestion, FileText, Users, Video } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  enrollmentService,
  materialService,
  questionPaperService,
  assignmentService,
  recordingService,
} from "@/lib/db";
import { useTeacherSubjects } from "@/lib/db/hooks";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/teacher/subjects")({
  head: () => ({
    meta: [
      { title: "My Subjects — EduLive Faculty" },
      {
        name: "description",
        content: "Subjects assigned to you, with quick links to manage content.",
      },
      { property: "og:title", content: "My Subjects — EduLive Faculty" },
      {
        property: "og:description",
        content: "Manage notes, tests, assignments and recordings by subject.",
      },
    ],
  }),
  component: TeacherSubjects,
});

function TeacherSubjects() {
  const { teacher } = useSession();
  const { data: subjects = [], isLoading: subjectsLoading } = useTeacherSubjects(teacher.id);

  const subjectIds = subjects.map((s) => s.id);
  const { data: subjectStats = [] } = useQuery({
    queryKey: ["teacher-subject-stats", subjectIds],
    queryFn: async () => {
      if (!subjectIds.length) return [];
      const entries = await Promise.all(
        subjectIds.map(async (subjectId) => {
          const [students, notes, papers, assignments, recordings] = await Promise.all([
            enrollmentService.getSubjectEnrollments(subjectId),
            materialService.listBySubject(subjectId),
            questionPaperService.listBySubject(subjectId),
            assignmentService.listBySubject(subjectId),
            recordingService.listBySubject(subjectId),
          ]);
          return {
            subjectId,
            students: students.length,
            notes: notes.length,
            papers: papers.length,
            assignments: assignments.length,
            recordings: recordings.length,
          };
        }),
      );
      return entries;
    },
    enabled: subjectIds.length > 0,
  });

  if (subjectsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Subjects" subtitle="Loading your subjects…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Subjects"
        subtitle={`${subjects.length} subject${subjects.length === 1 ? "" : "s"} assigned to you`}
      />

      {subjects.length === 0 ? (
        <div className="surface flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <BookOpen className="size-6" />
          </span>
          <div>
            <p className="font-semibold">No subjects assigned yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Reach out to the academics team to get subjects assigned to your profile.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => {
            const stats = subjectStats.find((entry) => entry.subjectId === s.id) ?? {
              students: 0,
              notes: 0,
              papers: 0,
              assignments: 0,
              recordings: 0,
            };
            const students = stats.students;
            const notes = stats.notes;
            const papers = stats.papers;
            const assignments = stats.assignments;
            const recordings = stats.recordings;

            return (
              <div key={s.id} className="surface flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.standard} Standard</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 gap-1">
                    <Users className="size-3" /> {students}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <span className="flex items-center gap-1">
                    <FileText className="size-3.5" /> {notes} notes
                  </span>
                  <span className="flex items-center gap-1">
                    <FileQuestion className="size-3.5" /> {papers} papers
                  </span>
                  <span className="flex items-center gap-1">
                    <ClipboardList className="size-3.5" /> {assignments} tasks
                  </span>
                  <span className="flex items-center gap-1">
                    <Video className="size-3.5" /> {recordings} videos
                  </span>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/teacher/notes">Notes</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/teacher/question-papers">Question Papers</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/teacher/assignments">Assignments</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/teacher/recordings">Recordings</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
