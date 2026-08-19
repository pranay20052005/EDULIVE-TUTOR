import { Link, createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Download, Lock, Upload } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { CardSkeleton, EmptyState, PageHeader } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toDDMMYYYY } from "@/lib/format";
import { useStudentEnrollments } from "@/lib/db/hooks";
import { assignmentService, assignmentSubmissionService } from "@/lib/db";
import { useSession } from "@/lib/session";
import type { Assignment } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/assignments")({
  head: () => ({
    meta: [
      { title: "Assignments — EduLive" },
      {
        name: "description",
        content: "Track and submit assignments published by faculty for your enrolled subjects.",
      },
      { property: "og:title", content: "Assignments — EduLive" },
      { property: "og:description", content: "Submit assignments before the due date." },
    ],
  }),
  component: AssignmentsPage,
});

type UiStatus = "pending" | "submitted" | "overdue";

function statusOf(a: Assignment, submittedIds: string[]): UiStatus {
  if (submittedIds.includes(a.id)) return "submitted";
  if (new Date(a.due_at).getTime() < Date.now()) return "overdue";
  return "pending";
}

const tone: Record<UiStatus, string> = {
  pending: "bg-warning/20 text-warning-foreground",
  submitted: "bg-success/15 text-success",
  overdue: "bg-destructive/12 text-destructive",
};

function AssignmentsPage() {
  const { student } = useSession();
  const queryClient = useQueryClient();
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useStudentEnrollments(
    student?.id,
  );
  const enrolledSubjectIds = enrollments.map((e: any) => e.subject_id);

  const { data: allAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["assignments-by-subjects", enrolledSubjectIds],
    queryFn: async () => {
      if (!enrolledSubjectIds.length) return [];
      const results = await Promise.all(
        enrolledSubjectIds.map((id: string) => assignmentService.listBySubject(id)),
      );
      return results
        .flat()
        .sort((a: any, b: any) => new Date(b.due_at).getTime() - new Date(a.due_at).getTime());
    },
    enabled: enrolledSubjectIds.length > 0,
  });

  const { data: mySubmissions = [] } = useQuery({
    queryKey: ["student-submissions", student?.id],
    queryFn: async () => {
      if (!student?.id) return [];
      return assignmentSubmissionService.listByStudent(student.id);
    },
    enabled: !!student?.id,
  });

  const [localSubmittedIds, setLocalSubmittedIds] = useState<string[]>([]);
  const submittedIds = [
    ...new Set([...mySubmissions.map((s) => s.assignment_id), ...localSubmittedIds]),
  ];

  const [active, setActive] = useState<Assignment | null>(null);
  const [fileName, setFileName] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ fileName?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const filters = ["all", "pending", "submitted", "overdue"] as const;

  const openSubmit = (a: Assignment) => {
    setActive(a);
    setFileName("");
    setNote("");
    setErrors({});
  };

  const submit = async () => {
    if (!fileName.trim()) {
      setErrors({ fileName: "Please enter the file name you are submitting." });
      return;
    }
    if (!active || !student?.id) return;
    setSubmitting(true);
    try {
      await assignmentSubmissionService.submitAssignment({
        assignment_id: active.id,
        student_id: student.id,
        submission_text: note.trim() || undefined,
        submission_url: fileName.trim(),
      });
      setLocalSubmittedIds((p) => [...p, active.id]);
      queryClient.invalidateQueries({ queryKey: ["student-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions"] });
      toast.success(`Submitted "${fileName.trim()}" for ${active.title}`);
      setActive(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit assignment");
    } finally {
      setSubmitting(false);
    }
  };

  if (enrolledSubjectIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Assignments" subtitle="Assignments from your enrolled subjects" />
        <EmptyState
          icon={Lock}
          title="You're not enrolled in any subject yet"
          body="Enroll in a course to see and submit assignments."
          action={
            <Button asChild>
              <Link to="/app/courses">Browse courses</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (enrollmentsLoading || assignmentsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Assignments" subtitle="Loading your assignments…" />
        <CardSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        subtitle={`${allAssignments.length} assignments across your subjects`}
      />
      <Tabs defaultValue="all">
        <TabsList className="w-full justify-start overflow-x-auto">
          {filters.map((f) => (
            <TabsTrigger key={f} value={f} className="capitalize">
              {f}
            </TabsTrigger>
          ))}
        </TabsList>
        {filters.map((f) => {
          const list = allAssignments.filter(
            (a: any) => f === "all" || statusOf(a, submittedIds) === f,
          );
          return (
            <TabsContent key={f} value={f} className="mt-4 space-y-3">
              {list.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Nothing here"
                  body="No assignments match this filter."
                />
              ) : (
                list.map((a: any) => {
                  const status = statusOf(a, submittedIds);
                  return (
                    <article
                      key={a.id}
                      className={cn(
                        "surface p-4 sm:p-5",
                        status === "overdue" && "border-destructive/30",
                      )}
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{a.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {a.subject?.name ?? "Subject"} ·{" "}
                            {a.created_by_teacher?.user?.name ?? "Faculty"}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {a.description}
                          </p>
                          <p
                            className={cn(
                              "mt-2 text-xs",
                              status === "overdue"
                                ? "font-medium text-destructive"
                                : "text-muted-foreground",
                            )}
                          >
                            Due {toDDMMYYYY(a.due_at)} · {a.max_marks} marks
                          </p>
                          {a.file_url ? (
                            <a
                              href={a.file_url}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                            >
                              <Download className="size-3.5" />{" "}
                              {a.file_name || "Download Teacher Attachment"}
                            </a>
                          ) : null}
                        </div>
                        <Badge
                          className={`shrink-0 capitalize ${tone[status]}`}
                          variant="secondary"
                        >
                          {status}
                        </Badge>
                      </div>
                      {status !== "submitted" ? (
                        <Button size="sm" className="mt-4" onClick={() => openSubmit(a)}>
                          <Upload className="size-4" /> Submit work
                        </Button>
                      ) : null}
                    </article>
                  );
                })
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent>
          {active ? (
            <>
              <DialogHeader>
                <DialogTitle>Submit — {active.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">{active.description}</p>
                <div className="space-y-1.5">
                  <Label htmlFor="file-name">File name</Label>
                  <Input
                    id="file-name"
                    value={fileName}
                    onChange={(e) => {
                      setFileName(e.target.value);
                      if (errors.fileName) setErrors({});
                    }}
                    placeholder="e.g. my-homework.pdf"
                    aria-invalid={!!errors.fileName}
                  />
                  {errors.fileName ? (
                    <p className="text-xs text-destructive">{errors.fileName}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note">Note to faculty (optional)</Label>
                  <Textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Any comments about your submission…"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setActive(null)}>
                  Cancel
                </Button>
                <Button onClick={submit}>Submit</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
