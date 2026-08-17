import { Link, createFileRoute } from "@tanstack/react-router";
import { Copy, Plus, Search, Trash2, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTeacherSubjects } from "@/lib/db/hooks";
import { CardSkeleton, EmptyState, PageHeader, SectionTitle, StatCard } from "@/components/ui-kit";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { testService } from "@/lib/db";
import { toDDMMYYYY } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { FacultyTest, PublishStatus } from "@/lib/db/types";

export const Route = createFileRoute("/teacher/tests")({
  head: () => ({
    meta: [
      { title: "Tests — EduLive Faculty" },
      { name: "description", content: "Build, publish and manage tests for your subjects." },
      { property: "og:title", content: "Tests — EduLive Faculty" },
      { property: "og:description", content: "Manage tests across all your subjects." },
    ],
  }),
  component: TeacherTests,
});

function TeacherTests() {
  const { teacher } = useSession();
  const queryClient = useQueryClient();
  const { data: mySubjects = [] } = useTeacherSubjects(teacher.id);

  const {
    data: myTests = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["teacher-tests", teacher.id],
    queryFn: () => (teacher.id ? testService.listByTeacher(teacher.id) : Promise.resolve([])),
    enabled: !!teacher.id,
  });

  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PublishStatus>("all");
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<FacultyTest | null>(null);

  const filtered = useMemo(
    () =>
      myTests
        .filter((t) => (subjectFilter === "all" ? true : t.subject_id === subjectFilter))
        .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
        .filter((t) => t.title.toLowerCase().includes(search.trim().toLowerCase())),
    [myTests, subjectFilter, statusFilter, search],
  );

  const published = myTests.filter((t) => t.status === "published").length;
  const draft = myTests.length - published;

  const togglePublish = async (t: FacultyTest) => {
    const nextStatus = t.status === "published" ? "draft" : "published";
    try {
      await testService.updateStatus(t.id, nextStatus);
      queryClient.invalidateQueries({ queryKey: ["teacher-tests"] });
      queryClient.invalidateQueries({ queryKey: ["tests"] });
      toast.success(nextStatus === "published" ? "Test published" : "Test moved to draft");
    } catch (err: any) {
      toast.error(err.message || "Failed to update test status");
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await testService.delete(toDelete.id);
      queryClient.invalidateQueries({ queryKey: ["teacher-tests"] });
      queryClient.invalidateQueries({ queryKey: ["tests"] });
      toast.success("Test deleted");
      setToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete test");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tests" subtitle="Build, publish and manage tests" />
        <div className="grid gap-4 sm:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tests" subtitle="Build, publish and manage tests" />
        <EmptyState icon={Trophy} title="Something went wrong" body={(error as Error).message} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tests"
        subtitle="Build, publish and manage tests for your subjects"
        action={
          <Button asChild>
            <Link to="/teacher/tests/new">
              <Plus className="size-4" /> New test
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total tests" value={`${myTests.length}`} icon={Trophy} />
        <StatCard label="Published" value={`${published}`} icon={Trophy} tone="success" />
        <StatCard label="Drafts" value={`${draft}`} icon={Trophy} tone="warning" />
      </div>

      <div className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tests by title"
            className="pl-9"
            aria-label="Search tests"
          />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Filter by subject">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {mySubjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} · {s.standard || "10th"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <section>
        <SectionTitle title={`Tests (${filtered.length})`} />
        {filtered.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No tests found"
            body="Try adjusting your filters or create a new test."
            action={
              <Button asChild>
                <Link to="/teacher/tests/new">
                  <Plus className="size-4" /> New test
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3">
            {filtered.map((t: FacultyTest) => (
              <div
                key={t.id}
                className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{t.title}</p>
                    <Badge
                      variant={t.status === "published" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {t.status}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {mySubjects.find((subject) => subject.id === t.subject_id)?.name ??
                      t.subject_id}{" "}
                    · {t.total_marks} marks · {t.duration_min} min
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.starts_at ? toDDMMYYYY(t.starts_at.slice(0, 10)) : ""} –{" "}
                    {t.ends_at ? toDDMMYYYY(t.ends_at.slice(0, 10)) : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
                    <Label htmlFor={`pub-${t.id}`} className="text-xs text-muted-foreground">
                      Published
                    </Label>
                    <Switch
                      id={`pub-${t.id}`}
                      checked={t.status === "published"}
                      onCheckedChange={() => togglePublish(t)}
                    />
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/teacher/tests/$testId" params={{ testId: t.id }}>
                      Edit
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setToDelete(t)}
                    aria-label="Delete test"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this test?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" will be permanently removed. Students will lose access to it. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
