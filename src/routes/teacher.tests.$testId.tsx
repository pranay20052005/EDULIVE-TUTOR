import { Link, createFileRoute } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { TestBuilder } from "@/components/test-builder";
import { EmptyState, PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { testService } from "@/lib/db";

export const Route = createFileRoute("/teacher/tests/$testId")({
  head: () => ({
    meta: [
      { title: "Edit test — EduLive Faculty" },
      { name: "description", content: "Edit questions, marks and publish settings for this test." },
      { property: "og:title", content: "Edit test — EduLive Faculty" },
      { property: "og:description", content: "Update this test before publishing." },
    ],
  }),
  component: EditTest,
});

function EditTest() {
  const { testId } = Route.useParams();
  const { data: test, isLoading } = useQuery({
    queryKey: ["teacher-test", testId],
    queryFn: () => testService.getWithQuestions(testId),
    enabled: !!testId,
  });

  if (isLoading) return null;

  if (!test) {
    return (
      <div className="space-y-6">
        <PageHeader title="Test not found" subtitle="This test may have been deleted" />
        <EmptyState
          icon={FileQuestion}
          title="We couldn't find that test"
          body="It may have been removed. Go back to your test list to continue."
          action={
            <Button asChild>
              <Link to="/teacher/tests">Back to tests</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={test.title || "Edit test"} subtitle="Edit test details and questions" />
      <TestBuilder test={test} />
    </div>
  );
}
