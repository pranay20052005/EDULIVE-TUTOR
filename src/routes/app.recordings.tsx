import { Link, createFileRoute } from "@tanstack/react-router";
import { Lock, PlayCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CardSkeleton, EmptyState, PageHeader, ProgressBar } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordingService } from "@/lib/db";
import { useStudentEnrollments } from "@/lib/db/hooks";
import { relative } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Recording } from "@/lib/db/types";

export const Route = createFileRoute("/app/recordings")({
  head: () => ({
    meta: [
      { title: "Recorded classes — EduLive" },
      {
        name: "description",
        content: "Watch recorded lessons published by your faculty for enrolled subjects.",
      },
      { property: "og:title", content: "Recorded classes — EduLive" },
      { property: "og:description", content: "Resume any lesson from where you stopped." },
    ],
  }),
  component: RecordingsPage,
});

function RecordingsPage() {
  const { student, isEnrolled } = useSession();
  const { data: enrollments = [] } = useStudentEnrollments(student?.id);
  const enrolledIds = useMemo(
    () =>
      enrollments.length > 0
        ? enrollments.map((e: any) => e.subject_id)
        : student.subjectIds.filter((id) => isEnrolled(id)),
    [enrollments, student.subjectIds, isEnrolled],
  );

  const { data: allRecordings = [], isLoading } = useQuery({
    queryKey: ["recordings-published"],
    queryFn: () => recordingService.listPublished(),
  });

  const recordings = useMemo(
    () => allRecordings.filter((r: Recording) => enrolledIds.includes(r.subject_id)),
    [allRecordings, enrolledIds],
  );

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [active, setActive] = useState<Recording | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});

  const filtered = useMemo(
    () =>
      recordings.filter((r: Recording) => {
        if (subjectFilter !== "all" && r.subject_id !== subjectFilter) return false;
        if (
          search &&
          !`${r.title} ${r.topic || ""} ${r.description || ""}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [recordings, subjectFilter, search],
  );

  if (enrolledIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Recorded classes"
          subtitle="Watch recorded sessions from your subjects"
        />
        <EmptyState
          icon={Lock}
          title="You're not enrolled in any subject yet"
          body="Enroll in a course to unlock its recorded classes."
          action={
            <Button asChild>
              <Link to="/app/courses">Browse courses</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Recorded classes" subtitle="Loading your recordings…" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recorded classes"
        subtitle={`${recordings.length} recordings from subjects you are enrolled in`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or topic…"
            className="pl-9"
            aria-label="Search recordings"
          />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by subject">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {enrollments.map((e: any) => (
              <SelectItem key={e.subject_id} value={e.subject_id}>
                {e.subject?.name || e.subject_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={PlayCircle}
          title="No recordings found"
          body="Try changing your filters or search term."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r: Recording) => {
            const pct = progress[r.id] ?? 0;
            return (
              <article key={r.id} className="surface overflow-hidden">
                <button
                  type="button"
                  className="hero-gradient grid aspect-video w-full place-items-center text-white"
                  onClick={() => setActive(r)}
                  aria-label={`Watch ${r.title}`}
                >
                  <PlayCircle className="size-10 opacity-90" />
                </button>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium">{r.title}</p>
                    <Badge variant="secondary" className="shrink-0">
                      {r.duration_min || 45} min
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {r.subject?.name || r.subject_id}
                  </p>
                  <ProgressBar value={pct} className="mt-3" />
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" className="flex-1" onClick={() => setActive(r)}>
                      {pct > 0 ? "Resume" : "Watch"}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="sm:max-w-lg">
          {active ? (
            <>
              <DialogHeader>
                <DialogTitle>{active.title}</DialogTitle>
              </DialogHeader>
              <div className="hero-gradient grid aspect-video place-items-center rounded-xl text-white">
                <PlayCircle className="size-14 opacity-90" />
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  {active.description || "Class recording session."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {active.subject?.name || active.subject_id} · {active.topic || "Topic"} ·{" "}
                  {active.duration_min || 45} min · published {relative(active.created_at)}
                </p>
              </div>
              <ProgressBar value={progress[active.id] ?? 0} className="mt-2" />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    setProgress((p) => ({
                      ...p,
                      [active.id]: Math.min(100, (p[active.id] ?? 0) + 25),
                    }))
                  }
                >
                  Simulate watch +25%
                </Button>
                <Button onClick={() => setActive(null)}>Close</Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
