import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  CancelButton,
  ConfirmDialog,
  ContentEmpty,
  ContentError,
  ContentLoading,
  FieldError,
  FileField,
  FormActions,
  PublishToggle,
  StatusBadge,
  SubjectPicker,
} from "@/components/faculty/content-shared";
import { PageHeader } from "@/components/ui-kit";
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
import { dateTimeOf, fromDDMMYYYY, maskDOB, toDDMMYYYY } from "@/lib/format";
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
  fileName: string;
  dueDate: string;
  dueTime: string;
  maxMarks: string;
  status: PublishStatus;
}

const emptyForm = (subjectId: string): FormState => ({
  id: "",
  subjectId,
  title: "",
  description: "",
  instructions: "",
  fileName: "",
  dueDate: "",
  dueTime: "18:00",
  maxMarks: "100",
  status: "draft",
});

function TeacherAssignments() {
  const { teacher } = useSession();
  const { data: subjects = [], isLoading: subjectsLoading } = useTeacherSubjects(teacher.id);
  const queryClient = useQueryClient();

  const {
    data: assignments = [],
    isLoading: assignmentsLoading,
    error,
  } = useQuery({
    queryKey: ["teacher-assignments", teacher.id],
    queryFn: () => (teacher.id ? assignmentService.listByTeacher(teacher.id) : Promise.resolve([])),
    enabled: !!teacher.id,
  });

  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(subjects[0]?.id ?? ""));
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
    setForm(emptyForm(subjects[0]?.id ?? ""));
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
      fileName: "",
      dueDate: toDDMMYYYY(a.due_at.slice(0, 10)),
      dueTime: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      maxMarks: String(a.max_marks || 100),
      status: a.status,
    });
    setErrors({});
    setDialogOpen(true);
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.subjectId) next.subjectId = "Select a subject.";
    if (!form.title.trim()) next.title = "Title is required.";
    if (!form.description.trim()) next.description = "Description is required.";
    const iso = fromDDMMYYYY(form.dueDate);
    if (!iso) next.dueDate = "Use DD/MM/YYYY format.";
    if (!/^\d{2}:\d{2}$/.test(form.dueTime)) next.dueTime = "Enter a valid time.";
    const marks = Number(form.maxMarks);
    if (!form.maxMarks.trim() || Number.isNaN(marks) || marks <= 0)
      next.maxMarks = "Enter valid max marks.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    const isEdit = !!form.id;
    const iso = fromDDMMYYYY(form.dueDate);
    const dueAt = new Date(`${iso}T${form.dueTime}:00`).toISOString();

    try {
      if (isEdit) {
        await assignmentService.update(form.id, {
          subject_id: form.subjectId,
          title: form.title.trim(),
          description: form.description.trim(),
          instructions: form.instructions.trim(),
          due_at: dueAt,
          max_marks: Number(form.maxMarks),
          status: form.status,
        });
        toast.success("Assignment updated");
      } else {
        await assignmentService.create({
          subject_id: form.subjectId,
          teacher_id: teacher.id,
          title: form.title.trim(),
          description: form.description.trim(),
          instructions: form.instructions.trim(),
          due_at: dueAt,
          max_marks: Number(form.maxMarks),
          status: form.status,
        });
        toast.success("Assignment created");
      }
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save assignment");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await assignmentService.delete(deleteId);
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast.success("Assignment deleted");
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete assignment");
    }
  }

  async function handleToggleStatus(id: string, status: PublishStatus) {
    try {
      await assignmentService.updateStatus(id, status);
      queryClient.invalidateQueries({ queryKey: ["teacher-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      toast.success(status === "published" ? "Assignment published" : "Assignment moved to draft");
    } catch (err: any) {
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
        subtitle="Create and track assignments for your students"
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New assignment
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
              <Button onClick={openCreate}>
                <Plus className="size-4" /> New assignment
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((a: FacultyAssignment) => {
            return (
              <div key={a.id} className="surface flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {subjectOf(a.subject_id)?.name ?? "Subject"}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
                <p className="text-xs text-muted-foreground">
                  Due {dateTimeOf(a.due_at)} · {a.max_marks} marks
                </p>
                <button
                  type="button"
                  onClick={() => setSummaryFor(a)}
                  className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
                >
                  <Users className="size-3.5" /> View submissions
                </button>
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <PublishToggle
                    status={a.status}
                    onChange={(status) => handleToggleStatus(a.id, status)}
                  />
                  <div className="flex gap-1">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit assignment" : "New assignment"}</DialogTitle>
          </DialogHeader>
          {subjects.length === 0 ? (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                <p className="font-medium">No subjects assigned</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You need to have at least one subject assigned to create assignments. You can
                  create or manage subjects in the My Subjects portal.
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
                  <Label htmlFor="fa-subject">Subject</Label>
                  <SubjectPicker
                    subjects={subjects}
                    value={form.subjectId}
                    onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
                    id="fa-subject"
                  />
                  <FieldError error={errors.subjectId} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fa-title">Title</Label>
                  <Input
                    id="fa-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    aria-invalid={!!errors.title}
                  />
                  <FieldError error={errors.title} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fa-description">Description</Label>
                  <Textarea
                    id="fa-description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    aria-invalid={!!errors.description}
                  />
                  <FieldError error={errors.description} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fa-instructions">Instructions</Label>
                  <Textarea
                    id="fa-instructions"
                    value={form.instructions}
                    onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                    aria-invalid={!!errors.instructions}
                  />
                  <FieldError error={errors.instructions} />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fa-due-date">Due date</Label>
                    <Input
                      id="fa-due-date"
                      placeholder="DD/MM/YYYY"
                      value={form.dueDate}
                      onChange={(e) => setForm((f) => ({ ...f, dueDate: maskDOB(e.target.value) }))}
                      aria-invalid={!!errors.dueDate}
                    />
                    <FieldError error={errors.dueDate} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fa-due-time">Due time</Label>
                    <Input
                      id="fa-due-time"
                      type="time"
                      value={form.dueTime}
                      onChange={(e) => setForm((f) => ({ ...f, dueTime: e.target.value }))}
                      aria-invalid={!!errors.dueTime}
                    />
                    <FieldError error={errors.dueTime} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fa-marks">Max marks</Label>
                    <Input
                      id="fa-marks"
                      type="number"
                      min="1"
                      value={form.maxMarks}
                      onChange={(e) => setForm((f) => ({ ...f, maxMarks: e.target.value }))}
                      aria-invalid={!!errors.maxMarks}
                    />
                    <FieldError error={errors.maxMarks} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <FormActions>
                  <CancelButton onClick={() => setDialogOpen(false)} />
                  <Button onClick={handleSubmit}>{form.id ? "Save changes" : "Create"}</Button>
                </FormActions>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!summaryFor} onOpenChange={(open) => !open && setSummaryFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submissions — {summaryFor?.title}</DialogTitle>
          </DialogHeader>
          {summaryFor ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="surface p-3">
                <p className="text-2xl font-semibold">{subjectEnrollments.length}</p>
                <p className="text-xs text-muted-foreground">Enrolled</p>
              </div>
              <div className="surface p-3">
                <p className="text-2xl font-semibold text-success">{submissions.length}</p>
                <p className="text-xs text-muted-foreground">Submitted</p>
              </div>
              <div className="surface p-3">
                <p className="text-2xl font-semibold text-warning-foreground">
                  {Math.max(0, subjectEnrollments.length - submissions.length)}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete this assignment?"
        description="This will remove the assignment permanently for all enrolled students. This cannot be undone."
        onConfirm={handleDelete}
      />
    </div>
  );
}
