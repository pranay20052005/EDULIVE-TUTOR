import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { FileQuestion, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { questionPaperService } from "@/lib/db";
import { fromDDMMYYYY, maskDOB, toDDMMYYYY } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { PublishStatus, QuestionPaper } from "@/lib/db/types";

export const Route = createFileRoute("/teacher/question-papers")({
  head: () => ({
    meta: [
      { title: "Question Papers — EduLive Faculty" },
      { name: "description", content: "Upload and publish question papers for your subjects." },
      { property: "og:title", content: "Question Papers — EduLive Faculty" },
      {
        property: "og:description",
        content: "Manage exam question papers and availability windows.",
      },
    ],
  }),
  component: TeacherPapers,
});

const EXAM_TYPES = ["Unit test", "Midterm", "Final", "Mock"];

interface FormState {
  id: string;
  subjectId: string;
  title: string;
  examType: string;
  description: string;
  fileUrl: string;
  totalMarks: string;
  durationMin: string;
  availableFrom: string;
  availableUntil: string;
  status: PublishStatus;
}

const emptyForm = (subjectId: string): FormState => ({
  id: "",
  subjectId,
  title: "",
  examType: "Unit test",
  description: "",
  fileUrl: "",
  totalMarks: "100",
  durationMin: "180",
  availableFrom: "",
  availableUntil: "",
  status: "draft",
});

function TeacherPapers() {
  const { teacher } = useSession();
  const queryClient = useQueryClient();
  const { data: subjects = [], isLoading: subjectsLoading } = useTeacherSubjects(teacher.id);

  const {
    data: papers = [],
    isLoading: papersLoading,
    error,
  } = useQuery({
    queryKey: ["teacher-question-papers", teacher.id],
    queryFn: () =>
      teacher.id ? questionPaperService.listByTeacher(teacher.id) : Promise.resolve([]),
    enabled: !!teacher.id,
  });

  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(subjects[0]?.id ?? ""));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const searchState = useRouterState({ select: (s) => s.location.search }) as {
    new?: string | boolean;
  };

  useEffect(() => {
    if (searchState?.new === true || searchState?.new === "true" || searchState?.new === "1") {
      openCreate();
    }
  }, [searchState?.new, subjects]);

  const filtered = useMemo(
    () =>
      papers
        .filter((p: QuestionPaper) => subjectFilter === "all" || p.subject_id === subjectFilter)
        .filter((p: QuestionPaper) => statusFilter === "all" || p.status === statusFilter)
        .filter((p: QuestionPaper) =>
          search.trim() ? p.title.toLowerCase().includes(search.trim().toLowerCase()) : true,
        )
        .sort(
          (a: QuestionPaper, b: QuestionPaper) => +new Date(b.created_at) - +new Date(a.created_at),
        ),
    [papers, subjectFilter, statusFilter, search],
  );

  const subjectOf = (id: string) => subjects.find((s) => s.id === id);

  function openCreate() {
    setForm(emptyForm(subjects[0]?.id ?? ""));
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(p: QuestionPaper) {
    setForm({
      id: p.id,
      subjectId: p.subject_id,
      title: p.title,
      examType: p.exam_type || "Unit test",
      description: p.description || "",
      fileUrl: p.file_url || "",
      totalMarks: String(p.total_marks || 100),
      durationMin: String(p.duration_min || 180),
      availableFrom: p.available_from ? toDDMMYYYY(p.available_from.slice(0, 10)) : "",
      availableUntil: p.available_until ? toDDMMYYYY(p.available_until.slice(0, 10)) : "",
      status: p.status,
    });
    setErrors({});
    setDialogOpen(true);
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.subjectId) next.subjectId = "Select a subject.";
    if (!form.title.trim()) next.title = "Title is required.";
    const marks = Number(form.totalMarks);
    if (!form.totalMarks.trim() || Number.isNaN(marks) || marks <= 0)
      next.totalMarks = "Enter valid total marks.";
    const duration = Number(form.durationMin);
    if (!form.durationMin.trim() || Number.isNaN(duration) || duration <= 0)
      next.durationMin = "Enter valid duration.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    const isEdit = !!form.id;
    const fromIso = form.availableFrom ? fromDDMMYYYY(form.availableFrom) || undefined : undefined;
    const untilIso = form.availableUntil
      ? fromDDMMYYYY(form.availableUntil) || undefined
      : undefined;

    try {
      if (isEdit) {
        await questionPaperService.update(form.id, {
          title: form.title.trim(),
          exam_type: form.examType,
          description: form.description.trim(),
          file_url: form.fileUrl.trim() || "#",
          total_marks: Number(form.totalMarks),
          duration_min: Number(form.durationMin),
          available_from: fromIso,
          available_until: untilIso,
          status: form.status,
        });
        toast.success("Question paper updated");
      } else {
        await questionPaperService.create({
          subject_id: form.subjectId,
          teacher_id: teacher.id,
          title: form.title.trim(),
          exam_type: form.examType,
          description: form.description.trim(),
          file_url: form.fileUrl.trim() || "#",
          total_marks: Number(form.totalMarks),
          duration_min: Number(form.durationMin),
          available_from: fromIso,
          available_until: untilIso,
          status: form.status,
        });
        toast.success("Question paper uploaded");
      }
      queryClient.invalidateQueries({ queryKey: ["teacher-question-papers"] });
      queryClient.invalidateQueries({ queryKey: ["question-papers"] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save question paper");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await questionPaperService.delete(deleteId);
      queryClient.invalidateQueries({ queryKey: ["teacher-question-papers"] });
      queryClient.invalidateQueries({ queryKey: ["question-papers"] });
      toast.success("Question paper deleted");
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete question paper");
    }
  }

  async function handleToggleStatus(id: string, status: PublishStatus) {
    try {
      await questionPaperService.updateStatus(id, status);
      queryClient.invalidateQueries({ queryKey: ["teacher-question-papers"] });
      queryClient.invalidateQueries({ queryKey: ["question-papers"] });
      toast.success(status === "published" ? "Paper published" : "Paper moved to draft");
    } catch (err: any) {
      toast.error(err.message || "Failed to update paper status");
    }
  }

  if (subjectsLoading || papersLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Question Papers" subtitle="Exam papers for your subjects" />
        <ContentLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Question Papers" subtitle="Exam papers for your subjects" />
        <ContentError message={(error as Error).message} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question Papers"
        subtitle="Upload and publish exam papers with availability windows"
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Upload paper
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
            aria-label="Search question papers"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <ContentEmpty
          icon={FileQuestion}
          title="No question papers found"
          body={
            subjects.length === 0
              ? "You have no subjects assigned yet."
              : "Upload your first paper or adjust your filters."
          }
          action={
            subjects.length > 0 ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" /> Upload paper
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p: QuestionPaper) => (
            <div key={p.id} className="surface flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {subjectOf(p.subject_id)?.name ?? "Subject"} · {p.exam_type}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
              <p className="text-xs text-muted-foreground">
                {p.total_marks} marks · {p.duration_min} min
              </p>
              {p.available_from && (
                <p className="text-xs text-muted-foreground">
                  Available {toDDMMYYYY(p.available_from.slice(0, 10))}
                  {p.available_until ? ` – ${toDDMMYYYY(p.available_until.slice(0, 10))}` : ""}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <PublishToggle
                  status={p.status}
                  onChange={(status) => handleToggleStatus(p.id, status)}
                />
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit paper"
                    onClick={() => openEdit(p)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete paper"
                    onClick={() => setDeleteId(p.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit question paper" : "Upload question paper"}</DialogTitle>
          </DialogHeader>
          {subjects.length === 0 ? (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                <p className="font-medium">No subjects assigned</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You need to have at least one subject assigned to upload question papers. You can
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
                  <Label htmlFor="qp-subject">Subject</Label>
                  <SubjectPicker
                    subjects={subjects}
                    value={form.subjectId}
                    onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
                    id="qp-subject"
                  />
                  <FieldError error={errors.subjectId} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qp-title">Title</Label>
                  <Input
                    id="qp-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    aria-invalid={!!errors.title}
                  />
                  <FieldError error={errors.title} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qp-exam-type">Exam type</Label>
                  <Select
                    value={form.examType}
                    onValueChange={(v) => setForm((f) => ({ ...f, examType: v }))}
                  >
                    <SelectTrigger id="qp-exam-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXAM_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qp-description">Description</Label>
                  <Textarea
                    id="qp-description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    aria-invalid={!!errors.description}
                  />
                  <FieldError error={errors.description} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="qp-marks">Total marks</Label>
                    <Input
                      id="qp-marks"
                      type="number"
                      min="1"
                      value={form.totalMarks}
                      onChange={(e) => setForm((f) => ({ ...f, totalMarks: e.target.value }))}
                      aria-invalid={!!errors.totalMarks}
                    />
                    <FieldError error={errors.totalMarks} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qp-duration">Duration (min)</Label>
                    <Input
                      id="qp-duration"
                      type="number"
                      min="1"
                      value={form.durationMin}
                      onChange={(e) => setForm((f) => ({ ...f, durationMin: e.target.value }))}
                      aria-invalid={!!errors.durationMin}
                    />
                    <FieldError error={errors.durationMin} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="qp-from">Available from</Label>
                    <Input
                      id="qp-from"
                      placeholder="DD/MM/YYYY"
                      value={form.availableFrom}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, availableFrom: maskDOB(e.target.value) }))
                      }
                      aria-invalid={!!errors.availableFrom}
                    />
                    <FieldError error={errors.availableFrom} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qp-until">Available until</Label>
                    <Input
                      id="qp-until"
                      placeholder="DD/MM/YYYY"
                      value={form.availableUntil}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, availableUntil: maskDOB(e.target.value) }))
                      }
                      aria-invalid={!!errors.availableUntil}
                    />
                    <FieldError error={errors.availableUntil} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <FormActions>
                  <CancelButton onClick={() => setDialogOpen(false)} />
                  <Button onClick={handleSubmit}>{form.id ? "Save changes" : "Upload"}</Button>
                </FormActions>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete this question paper?"
        description="This will remove the paper permanently for all enrolled students. This cannot be undone."
        onConfirm={handleDelete}
      />
    </div>
  );
}
