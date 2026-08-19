import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, Download, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  CancelButton,
  ConfirmDialog,
  ContentEmpty,
  ContentError,
  ContentLoading,
  FieldError,
  FileUploadField,
  FormActions,
  PublishToggle,
  StatusBadge,
  SubjectPicker,
} from "@/components/faculty/content-shared";
import { PageHeader } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTeacherSubjects } from "@/lib/db/hooks";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { assignmentService, enrollmentService, assignmentSubmissionService } from "@/lib/db";
import { dateTimeOf, fromDDMMYYYY, toDDMMYYYY } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { FacultyAssignment, PublishStatus } from "@/lib/db/types";

export const Route = createFileRoute("/teacher/assignments")({
  head: () => ({
    meta: [
      { title: "Assignments — EduLive Faculty" },
      { name: "description", content: "Create, edit and track assignments for your subjects." },
      { property: "og:title", content: "Assignments — EduLive Faculty" },
      { property: "og:description", content: "Manage homework and view submission summaries." },
    ],
  }),
  component: TeacherAssignments,
});

interface FormState {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  instructions: string;
  fileUrl: string;
  fileName: string;
  dueDate: string;
  dueTime: string;
  maxMarks: string;
  status: PublishStatus;
}

const getDefaultDueDate = () => {
  const d = new Date(Date.now() + 7 * 86400000);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const emptyForm = (subjectId: string): FormState => ({
  id: "",
  subjectId: subjectId || "",
  title: "",
  description: "",
  instructions: "",
  fileUrl: "",
  fileName: "",
  dueDate: getDefaultDueDate(),
  dueTime: "18:00",
  maxMarks: "100",
  status: "draft",
});

function TeacherAssignments() {
  const { session, teacher } = useSession();
  const { data: subjects = [], isLoading: subjectsLoading } = useTeacherSubjects(teacher?.id);
  const queryClient = useQueryClient();

  const {
    data: assignments = [],
    isLoading: assignmentsLoading,
    error,
  } = useQuery({
    queryKey: ["teacher-assignments", teacher?.id],
    queryFn: () =>
      teacher?.id ? assignmentService.listByTeacher(teacher.id) : Promise.resolve([]),
    enabled: !!teacher?.id,
  });

  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(subjects[0]?.id ?? ""));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [summaryFor, setSummaryFor] = useState<FacultyAssignment | null>(null);

  const searchState = useRouterState({ select: (s) => s.location.search }) as {
    new?: string | boolean;
  };

  useEffect(() => {
    if (searchState?.new === true || searchState?.new === "true" || searchState?.new === "1") {
      openCreate();
    }
  }, [searchState?.new, subjects]);

  const { data: submissions = [] } = useQuery({
    queryKey: ["assignment-submissions", summaryFor?.id],
    queryFn: () => (summaryFor ? assignmentSubmissionService.listByAssignment(summaryFor.id) : []),
    enabled: !!summaryFor,
  });

  const { data: subjectEnrollments = [] } = useQuery({
    queryKey: ["subject-enrollments", summaryFor?.subject_id],
    queryFn: () =>
      summaryFor?.subject_id ? enrollmentService.getSubjectEnrollments(summaryFor.subject_id) : [],
    enabled: !!summaryFor?.subject_id,
  });

  const list = useMemo(
    () =>
      assignments
        .filter((a) => subjectFilter === "all" || a.subject_id === subjectFilter)
        .filter((a) => statusFilter === "all" || a.status === statusFilter)
        .filter((a) =>
          search.trim() ? a.title.toLowerCase().includes(search.trim().toLowerCase()) : true,
        )
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [assignments, subjectFilter, statusFilter, search],
  );

  const subjectOf = (id: string) => subjects.find((s) => s.id === id);

  function openCreate() {
    const defaultSubId = form.subjectId || subjects[0]?.id || "";
    setForm(emptyForm(defaultSubId));
    setSelectedFile(null);
    setIsUploading(false);
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(a: FacultyAssignment) {
    const d = new Date(a.due_at);
    setForm({
      id: a.id,
      subjectId: a.subject_id,
      title: a.title,
      description: a.description || "",
      instructions: a.instructions || "",
      fileUrl: a.file_url || "",
      fileName: a.file_name || "",
      dueDate: toDDMMYYYY(a.due_at.slice(0, 10)),
      dueTime: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      maxMarks: String(a.max_marks || 100),
      status: a.status,
    });
    setSelectedFile(null);
    setIsUploading(false);
    setErrors({});
    setDialogOpen(true);
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    const effectiveSubjectId = form.subjectId || subjects[0]?.id;
    if (!effectiveSubjectId) next.subjectId = "Select a subject.";
    if (!form.title.trim()) next.title = "Title is required.";

    const parsedIso = fromDDMMYYYY(form.dueDate);
    if (!parsedIso && form.dueDate.trim()) next.dueDate = "Enter a valid date.";

    const marks = Number(form.maxMarks);
    if (form.maxMarks.trim() && (Number.isNaN(marks) || marks <= 0)) {
      next.maxMarks = "Enter valid max marks.";
    }

    setErrors(next);
    const isValid = Object.keys(next).length === 0;
    if (!isValid) {
      const firstError = Object.values(next)[0];
      toast.error(firstError || "Please check required fields");
    }
    return isValid;
  }

  async function handleSubmit() {
    if (!validate()) return;
    const isEdit = !!form.id;
    const effectiveSubjectId = form.subjectId || subjects[0]?.id;

    const parsedIso =
      fromDDMMYYYY(form.dueDate) || new Date(Date.now() + 7 * 86400000).toISOString();
    const datePart = parsedIso.slice(0, 10);
    const timePart = /^\d{2}:\d{2}$/.test(form.dueTime) ? form.dueTime : "18:00";
    const dueAt = new Date(`${datePart}T${timePart}:00`).toISOString();

    setIsUploading(true);
    try {
      let fileUrl = form.fileUrl;
      let fileName = form.fileName;

      if (selectedFile) {
        const uploadRes = await assignmentService.uploadAttachment(
          selectedFile,
          session?.userId || session?.id || teacher?.userId,
        );
        fileUrl = uploadRes.url;
        fileName = uploadRes.name;
      }

      if (isEdit) {
        await assignmentService.update(form.id, {
          subject_id: effectiveSubjectId,
          title: form.title.trim(),
          description: form.description.trim(),
          instructions: form.instructions.trim(),
          file_url: fileUrl,
          file_name: fileName,
          due_at: dueAt,
          max_marks: Number(form.maxMarks) || 100,
          status: form.status,
        });
        toast.success("Assignment updated successfully");
      } else {
        await assignmentService.create({
          subject_id: effectiveSubjectId,
          teacher_id: teacher?.id,
          title: form.title.trim(),
          description: form.description.trim(),
          instructions: form.instructions.trim(),
          file_url: fileUrl || undefined,
          file_name: fileName || undefined,
          due_at: dueAt,
          max_marks: Number(form.maxMarks) || 100,
          status: form.status,
        });
        toast.success("Assignment created successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignments-by-subjects"] });
      setDialogOpen(false);
    } catch (err: any) {
      console.error("Failed to save assignment:", err);
      toast.error(err.message || "Failed to save assignment. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await assignmentService.delete(deleteId);
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignments-by-subjects"] });
      toast.success("Assignment deleted");
      setDeleteId(null);
    } catch (err: any) {
      console.error("Failed to delete assignment:", err);
      toast.error(err.message || "Failed to delete assignment");
    }
  }

  async function handleToggleStatus(id: string, status: PublishStatus) {
    try {
      await assignmentService.updateStatus(id, status);
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignments-by-subjects"] });
      toast.success(status === "published" ? "Assignment published" : "Assignment moved to draft");
    } catch (err: any) {
      console.error("Failed to update assignment status:", err);
      toast.error(err.message || "Failed to update status");
    }
  }

  if (subjectsLoading || assignmentsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Assignments" subtitle="Homework for your subjects" />
        <ContentLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Assignments" subtitle="Homework for your subjects" />
        <ContentError message={(error as Error).message} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        subtitle="Create, publish and review homework for your classes"
        action={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" /> Add Assignment
          </Button>
        }
      />

      <div className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="sm:w-56">
          <SubjectPicker
            subjects={subjects}
            value={subjectFilter}
            onChange={setSubjectFilter}
            includeAll
            placeholder="All subjects"
          />
        </div>
        <div className="sm:w-44">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title"
            className="pl-9"
            aria-label="Search assignments"
          />
        </div>
      </div>

      {list.length === 0 ? (
        <ContentEmpty
          icon={ClipboardList}
          title="No assignments found"
          body={
            subjects.length === 0
              ? "You have no subjects assigned yet."
              : "Create your first assignment or adjust your filters."
          }
          action={
            subjects.length > 0 ? (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="size-4" /> Add Assignment
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => {
            const subject = subjectOf(a.subject_id);
            return (
              <div key={a.id} className="surface flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {subject ? `${subject.name} · ${subject.standard}` : "Subject"}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Due {dateTimeOf(a.due_at)}</span>
                  <span>{a.max_marks} marks</span>
                </div>

                {a.file_url ? (
                  <a
                    href={a.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline pt-1"
                  >
                    <Download className="size-3.5" /> {a.file_name || "Download Attachment"}
                  </a>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                  <PublishToggle
                    status={a.status}
                    onChange={(status) => handleToggleStatus(a.id, status)}
                  />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => setSummaryFor(a)}
                    >
                      <Users className="size-3.5" /> Submissions
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Edit assignment"
                      onClick={() => openEdit(a)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete assignment"
                      onClick={() => setDeleteId(a.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !isUploading && setDialogOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit assignment" : "Create assignment"}</DialogTitle>
          </DialogHeader>
          {subjects.length === 0 ? (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                <p className="font-medium">No subjects assigned</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You need to have at least one subject assigned to create assignments.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Close
                </Button>
                <Button asChild>
                  <Link to="/teacher/subjects">Go to My Subjects</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="asg-subject">Subject</Label>
                  <SubjectPicker
                    subjects={subjects}
                    value={form.subjectId || subjects[0]?.id || ""}
                    onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
                    id="asg-subject"
                  />
                  <FieldError error={errors.subjectId} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="asg-title">Title *</Label>
                  <Input
                    id="asg-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    aria-invalid={!!errors.title}
                    placeholder="e.g. Chapter 3 Problems"
                  />
                  <FieldError error={errors.title} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="asg-desc">Description / questions</Label>
                  <Textarea
                    id="asg-desc"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    aria-invalid={!!errors.description}
                    placeholder="Write the assignment prompt or questions..."
                  />
                  <FieldError error={errors.description} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="asg-instructions">Submission instructions (optional)</Label>
                  <Input
                    id="asg-instructions"
                    value={form.instructions}
                    onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                    placeholder="e.g. Upload a single PDF or clear handwritten photos"
                  />
                </div>

                <FileUploadField
                  id="asg-file"
                  label="Attach Question Sheet / Reference File (optional)"
                  selectedFile={selectedFile}
                  existingUrl={form.fileUrl}
                  existingName={form.fileName}
                  onFileSelect={(file) => setSelectedFile(file)}
                  isUploading={isUploading}
                  hint="Optional worksheet or problem set PDF/Doc"
                />

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="asg-due-date">Due date</Label>
                    <Input
                      id="asg-due-date"
                      value={form.dueDate}
                      onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                      placeholder="DD/MM/YYYY"
                      aria-invalid={!!errors.dueDate}
                    />
                    <FieldError error={errors.dueDate} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="asg-due-time">Due time</Label>
                    <Input
                      id="asg-due-time"
                      value={form.dueTime}
                      onChange={(e) => setForm((f) => ({ ...f, dueTime: e.target.value }))}
                      placeholder="18:00"
                      aria-invalid={!!errors.dueTime}
                    />
                    <FieldError error={errors.dueTime} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="asg-marks">Max marks</Label>
                    <Input
                      id="asg-marks"
                      type="number"
                      min="1"
                      value={form.maxMarks}
                      onChange={(e) => setForm((f) => ({ ...f, maxMarks: e.target.value }))}
                      aria-invalid={!!errors.maxMarks}
                    />
                    <FieldError error={errors.maxMarks} />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Publish immediately</p>
                    <p className="text-xs text-muted-foreground">
                      Make this assignment visible to all enrolled students right away.
                    </p>
                  </div>
                  <PublishToggle
                    status={form.status}
                    onChange={(status) => setForm((f) => ({ ...f, status }))}
                    disabled={isUploading}
                  />
                </div>
              </div>

              <DialogFooter>
                <FormActions>
                  <CancelButton onClick={() => setDialogOpen(false)} />
                  <Button onClick={handleSubmit} disabled={isUploading}>
                    {isUploading
                      ? "Uploading attachment…"
                      : form.id
                        ? "Save changes"
                        : "Create assignment"}
                  </Button>
                </FormActions>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Submissions summary dialog */}
      <Dialog open={!!summaryFor} onOpenChange={(open) => !open && setSummaryFor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submissions: {summaryFor?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="surface p-3">
                <p className="text-xs text-muted-foreground">Enrolled</p>
                <p className="text-xl font-bold">{subjectEnrollments.length}</p>
              </div>
              <div className="surface p-3">
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p className="text-xl font-bold">{submissions.length}</p>
              </div>
              <div className="surface p-3">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">
                  {Math.max(0, subjectEnrollments.length - submissions.length)}
                </p>
              </div>
            </div>

            {submissions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No submissions received yet.
              </p>
            ) : (
              <div className="space-y-2">
                {submissions.map((s) => (
                  <div
                    key={s.id}
                    className="surface flex items-center justify-between gap-3 p-3 text-xs"
                  >
                    <div>
                      <p className="font-medium">{s.student?.user?.name ?? "Student"}</p>
                      <p className="text-muted-foreground">
                        {s.student?.user?.email ?? "No email"} · Standard:{" "}
                        {s.student?.standard ?? "—"}
                      </p>
                      {s.submission_text ? (
                        <p className="mt-1 text-foreground/80 font-normal">{s.submission_text}</p>
                      ) : null}
                      {s.file_url ? (
                        <a
                          href={s.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-primary font-medium hover:underline"
                        >
                          <Download className="size-3" /> View Submitted File
                        </a>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={s.status === "graded" ? "default" : "secondary"}>
                        {s.status}
                      </Badge>
                      <p className="mt-1 text-muted-foreground">
                        {s.submitted_at ? toDDMMYYYY(s.submitted_at.slice(0, 10)) : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete this assignment?"
        description="This will permanently delete the assignment and all student submissions."
        onConfirm={handleDelete}
      />
    </div>
  );
}
