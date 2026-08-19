import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { Download, FileQuestion, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { fromDDMMYYYY, toDDMMYYYY } from "@/lib/format";
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

const EXAM_TYPES = ["Unit test", "Midterm", "Final", "Mock", "Practice"];

interface FormState {
  id: string;
  subjectId: string;
  title: string;
  examType: string;
  description: string;
  fileUrl: string;
  fileName: string;
  totalMarks: string;
  durationMin: string;
  availableFrom: string;
  availableUntil: string;
  status: PublishStatus;
}

const emptyForm = (subjectId: string): FormState => ({
  id: "",
  subjectId: subjectId || "",
  title: "",
  examType: "Unit test",
  description: "",
  fileUrl: "",
  fileName: "",
  totalMarks: "100",
  durationMin: "180",
  availableFrom: "",
  availableUntil: "",
  status: "draft",
});

function TeacherPapers() {
  const { session, teacher } = useSession();
  const queryClient = useQueryClient();
  const { data: subjects = [], isLoading: subjectsLoading } = useTeacherSubjects(teacher?.id);

  const {
    data: papers = [],
    isLoading: papersLoading,
    error,
  } = useQuery({
    queryKey: ["teacher-question-papers", teacher?.id],
    queryFn: () =>
      teacher?.id ? questionPaperService.listByTeacher(teacher.id) : Promise.resolve([]),
    enabled: !!teacher?.id,
  });

  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(subjects[0]?.id ?? ""));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "file", string>>>({});
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
    const defaultSubId = form.subjectId || subjects[0]?.id || "";
    setForm(emptyForm(defaultSubId));
    setSelectedFile(null);
    setIsUploading(false);
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
      fileName: p.file_name || "",
      totalMarks: String(p.total_marks || 100),
      durationMin: String(p.duration_min || 180),
      availableFrom: p.available_from ? toDDMMYYYY(p.available_from.slice(0, 10)) : "",
      availableUntil: p.available_until ? toDDMMYYYY(p.available_until.slice(0, 10)) : "",
      status: p.status,
    });
    setSelectedFile(null);
    setIsUploading(false);
    setErrors({});
    setDialogOpen(true);
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState | "file", string>> = {};
    const effectiveSubjectId = form.subjectId || subjects[0]?.id;
    if (!effectiveSubjectId) next.subjectId = "Select a subject.";
    if (!form.title.trim()) next.title = "Title is required.";
    const marks = Number(form.totalMarks);
    if (!form.totalMarks.trim() || Number.isNaN(marks) || marks <= 0)
      next.totalMarks = "Enter valid total marks.";
    const duration = Number(form.durationMin);
    if (!form.durationMin.trim() || Number.isNaN(duration) || duration <= 0)
      next.durationMin = "Enter valid duration.";
    if (!form.id && !selectedFile && !form.fileUrl) {
      next.file = "Please select a question paper file to upload.";
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
    const fromIso = form.availableFrom ? fromDDMMYYYY(form.availableFrom) || undefined : undefined;
    const untilIso = form.availableUntil
      ? fromDDMMYYYY(form.availableUntil) || undefined
      : undefined;

    setIsUploading(true);
    try {
      let fileUrl = form.fileUrl;
      let fileName = form.fileName;

      if (selectedFile) {
        const uploadRes = await questionPaperService.uploadFile(
          selectedFile,
          session?.userId || session?.id || teacher?.userId,
        );
        fileUrl = uploadRes.url;
        fileName = uploadRes.name;
      }

      if (isEdit) {
        await questionPaperService.update(form.id, {
          title: form.title.trim(),
          exam_type: form.examType,
          description: form.description.trim(),
          file_url: fileUrl,
          file_name: fileName,
          total_marks: Number(form.totalMarks) || 100,
          duration_min: Number(form.durationMin) || 180,
          available_from: fromIso,
          available_until: untilIso,
          status: form.status,
        });
        toast.success("Question paper updated successfully");
      } else {
        await questionPaperService.create({
          subject_id: effectiveSubjectId,
          teacher_id: teacher?.id,
          title: form.title.trim(),
          exam_type: form.examType,
          description: form.description.trim(),
          file_url: fileUrl || undefined,
          file_name: fileName || undefined,
          total_marks: Number(form.totalMarks) || 100,
          duration_min: Number(form.durationMin) || 180,
          available_from: fromIso,
          available_until: untilIso,
          status: form.status,
        });
        toast.success("Question paper uploaded successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["teacher-question-papers"] });
      queryClient.invalidateQueries({ queryKey: ["question-papers"] });
      setDialogOpen(false);
    } catch (err: any) {
      console.error("Failed to save question paper:", err);
      toast.error(err.message || "Failed to save question paper. Please try again.");
    } finally {
      setIsUploading(false);
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
      console.error("Failed to delete question paper:", err);
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
      console.error("Failed to update paper status:", err);
      toast.error(err.message || "Failed to update paper status");
    }
  }

  if (subjectsLoading || papersLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Question Papers" subtitle="Exams for your subjects" />
        <ContentLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Question Papers" subtitle="Exams for your subjects" />
        <ContentError message={(error as Error).message} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question Papers"
        subtitle="Upload and schedule exam question papers for your classes"
        action={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" /> Add Question Paper
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
              : "Upload your first question paper or adjust your filters."
          }
          action={
            subjects.length > 0 ? (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="size-4" /> Add Question Paper
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p: QuestionPaper) => {
            const subject = subjectOf(p.subject_id);
            return (
              <div key={p.id} className="surface flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {subject ? `${subject.name} · ${subject.standard}` : "Subject"} ·{" "}
                      {p.exam_type}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{p.duration_min} mins</span>
                  <span>{p.total_marks} marks</span>
                </div>

                {p.file_url ? (
                  <a
                    href={p.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline pt-1"
                  >
                    <Download className="size-3.5" /> {p.file_name || "Download Question Paper"}
                  </a>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-border/40">
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
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !isUploading && setDialogOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Question Paper" : "Add Question Paper"}</DialogTitle>
          </DialogHeader>
          {subjects.length === 0 ? (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                <p className="font-medium">No subjects assigned</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You need to have at least one subject assigned to upload question papers.
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
                    value={form.subjectId || subjects[0]?.id || ""}
                    onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
                    id="qp-subject"
                  />
                  <FieldError error={errors.subjectId} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qp-title">Title *</Label>
                  <Input
                    id="qp-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    aria-invalid={!!errors.title}
                    placeholder="e.g. Midterm Physics Examination"
                  />
                  <FieldError error={errors.title} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
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
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qp-duration">Duration (minutes)</Label>
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
                <div className="space-y-1.5">
                  <Label htmlFor="qp-desc">Description / syllabus coverage (optional)</Label>
                  <Textarea
                    id="qp-desc"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description or chapters covered in this paper..."
                  />
                </div>

                <FileUploadField
                  id="qp-file"
                  label="Attach Question Paper Document *"
                  selectedFile={selectedFile}
                  existingUrl={form.fileUrl}
                  existingName={form.fileName}
                  onFileSelect={(file) => setSelectedFile(file)}
                  isUploading={isUploading}
                  error={errors.file}
                  hint="Upload exam question paper PDF or Word document (up to 50MB)"
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="qp-from">Available from (optional)</Label>
                    <Input
                      id="qp-from"
                      value={form.availableFrom}
                      onChange={(e) => setForm((f) => ({ ...f, availableFrom: e.target.value }))}
                      placeholder="DD/MM/YYYY"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qp-until">Available until (optional)</Label>
                    <Input
                      id="qp-until"
                      value={form.availableUntil}
                      onChange={(e) => setForm((f) => ({ ...f, availableUntil: e.target.value }))}
                      placeholder="DD/MM/YYYY"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Publish immediately</p>
                    <p className="text-xs text-muted-foreground">
                      Make this question paper visible to all enrolled students right away.
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
                      ? "Uploading paper…"
                      : form.id
                        ? "Save changes"
                        : "Upload question paper"}
                  </Button>
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
        description="This will permanently delete the question paper for all enrolled students."
        onConfirm={handleDelete}
      />
    </div>
  );
}
