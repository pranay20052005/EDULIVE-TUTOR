import { createFileRoute } from "@tanstack/react-router";

import { TestBuilder } from "@/components/test-builder";
import { PageHeader } from "@/components/ui-kit";
import { useTeacherSubjects } from "@/lib/db/hooks";
import { useSession } from "@/lib/session";
import type { FacultyTest } from "@/lib/db/types";

export const Route = createFileRoute("/teacher/tests/new")({
  head: () => ({
    meta: [
      { title: "New test — EduLive Faculty" },
      {
        name: "description",
        content: "Build a new test with MCQ, true/false and short-answer questions.",
      },
      { property: "og:title", content: "New test — EduLive Faculty" },
      { property: "og:description", content: "Create and publish a new test." },
    ],
  }),
  component: NewTest,
});

function NewTest() {
  const { teacher } = useSession();
  const { data: mySubjects = [] } = useTeacherSubjects(teacher.id);

  const blank: FacultyTest & { questions: any[] } = {
    id: "",
    subject_id: mySubjects[0]?.id ?? "",
    teacher_id: teacher.id,
    title: "",
    description: "",
    instructions: "All questions are compulsory. There is no negative marking.",
    duration_min: 30,
    total_marks: 0,
    passing_marks: 40,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    status: "draft",
    questions: [],
    created_at: new Date().toISOString(),
  };

  return (
    <div className="space-y-6">
      <PageHeader title="New test" subtitle="Build a test for your subject" />
      <TestBuilder test={blank} />
    </div>
  );
}
