import { Link, createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Download, FileUp, Loader2, Lock, Upload, X } from "lucide-react";
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
import { assignmentService, assignmentSubmissionService, materialService } from "@/lib/db";
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
  const { student, session } = useSession();
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ file?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const filters = ["all", "pending", "submitted", "overdue"] as const;

  const openSubmit = (a: Assignment) => {
    setActive(a);
    setSelectedFile(null);
    setFileName("");
    setNote("");
    setErrors({});
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setErrors({ file: "File size exceeds maximum 50MB limit." });
        return;
      }
      setSelectedFile(file);
      setFileName(file.name);
      setErrors({});
    }
  };

  const submit = async () => {
    if (!selectedFile && !fileName.trim()) {
      setErrors({ file: "Please select an assignment file to submit." });
      return;
    }
    if (!active || !student?.id) return;
    setSubmitting(true);
    try {
      let finalFileUrl = fileName.trim();

      // Upload real file to Supabase Storage if selected
      if (selectedFile) {
        const uploadRes = await materialService.uploadFile(
          selectedFile,
          session?.id || student?.userId,
        );
        finalFileUrl = uploadRes.url;
      }

      await assignmentSubmissionService.submitAssignment({
        assignment_id: active.id,
        student_id: student.id,
        submission_text: note.trim() || undefined,
        submission_url: finalFileUrl,
      });

      setLocalSubmittedIds((p) => [...p, active.id]);
      queryClient.invalidateQueries({ queryKey: ["student-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["assignment-submissions"] });
      toast.success(`Submitted "${selectedFile?.name || fileName.trim()}" for ${active.title}!`);
      setActive(null);
    } catch (err: any) {
      console.error("Assignment submit error:", err);
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
        <DialogContent className="max-w-md">
          {active ? (
            <>
              <DialogHeader>
                <DialogTitle>Submit — {active.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">{active.description}</p>

                {/* Real File Selection */}
                <div className="space-y-1.5">
                  <Label htmlFor="assignment-file">
                    Upload Assignment File (PDF, DOCX, Images)
                  </Label>
                  {selectedFile ? (
                    <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-3">
                      <div className="min-w-0 pr-2">
                        <p className="truncate text-xs font-medium text-foreground">
                          {selectedFile.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setSelectedFile(null);
                          setFileName("");
                        }}
                      >
                        <X className="size-3.5 mr-1" /> Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-4 text-center cursor-pointer hover:border-primary/50 transition-colors">
                      <FileUp className="size-6 text-muted-foreground" />
                      <span className="text-xs font-medium text-primary">
                        Browse or drag files to upload
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        PDF, DOC, DOCX, PNG, JPG up to 50MB
                      </span>
                      <input
                        id="assignment-file"
                        type="file"
                        className="sr-only"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.txt"
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                  {errors.file ? <p className="text-xs text-destructive">{errors.file}</p> : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="note">Note to faculty (optional)</Label>
                  <Textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Any comments about your submission…"
                    className="text-xs"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setActive(null)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="size-3.5 mr-1.5 animate-spin" /> Uploading…
                    </>
                  ) : (
                    "Submit Assignment"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
