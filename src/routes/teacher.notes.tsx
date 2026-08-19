import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { Download, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { materialService } from "@/lib/db";
import { relative } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Material, PublishStatus } from "@/lib/db/types";

export const Route = createFileRoute("/teacher/notes")({
  head: () => ({
    meta: [
      { title: "Notes & PDFs — EduLive Faculty" },
      { name: "description", content: "Upload, edit and publish study notes for your subjects." },
      { property: "og:title", content: "Notes & PDFs — EduLive Faculty" },
      { property: "og:description", content: "Manage study material for your students." },
    ],
  }),
  component: TeacherNotes,
});

interface FormState {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  sizeKB: number;
  status: PublishStatus;
}

const emptyForm = (subjectId: string): FormState => ({
  id: "",
  subjectId: subjectId || "",
  title: "",
  description: "",
  fileUrl: "",
  fileName: "",
  fileType: "PDF",
  sizeKB: 1024,
  status: "draft",
});

function TeacherNotes() {
  const { session, teacher } = useSession();
  const queryClient = useQueryClient();
  const { data: subjects = [], isLoading: subjectsLoading } = useTeacherSubjects(teacher?.id);

  const subjectIds = useMemo(() => subjects.map((s) => s.id), [subjects]);

  const teacherUid = session?.userId || session?.id || teacher?.userId;

  const {
    data: notes = [],
    isLoading: notesLoading,
    error,
  } = useQuery({
    queryKey: ["teacher-materials", teacherUid, subjectIds],
    queryFn: () => materialService.listByTeacher(teacherUid, subjectIds),
    enabled: true,
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
      notes
        .filter((n: Material) => subjectFilter === "all" || n.subject_id === subjectFilter)
        .filter((n: Material) => statusFilter === "all" || n.status === statusFilter)
        .filter((n: Material) =>
          search.trim()
            ? `${n.title} ${n.description || ""}`
                .toLowerCase()
                .includes(search.trim().toLowerCase())
            : true,
        )
        .sort((a: Material, b: Material) => +new Date(b.created_at) - +new Date(a.created_at)),
    [notes, subjectFilter, statusFilter, search],
  );

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "Subject";

  function openCreate() {
    const defaultSubId = form.subjectId || subjects[0]?.id || "";
    setForm(emptyForm(defaultSubId));
    setSelectedFile(null);
    setIsUploading(false);
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(n: Material) {
    setForm({
      id: n.id,
      subjectId: n.subject_id,
      title: n.title,
      description: n.description || "",
      fileUrl: n.file_url || "",
      fileName: n.file_url ? n.file_url.split("/").pop() || "note-file" : "",
      fileType: n.file_type || "PDF",
      sizeKB: n.file_size_kb || 1024,
      status: n.status,
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
    if (!form.id && !selectedFile && !form.fileUrl) {
      next.file = "Please select a file to upload.";
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

    setIsUploading(true);
    try {
      let fileUrl = form.fileUrl;
      let fileType = form.fileType;
      let sizeKB = form.sizeKB;

      if (selectedFile) {
        const uploadResult = await materialService.uploadFile(selectedFile, teacherUid);
        fileUrl = uploadResult.url;
        fileType = uploadResult.fileType;
        sizeKB = uploadResult.sizeKB;
      }

      if (isEdit) {
        await materialService.update(form.id, {
          title: form.title.trim(),
          description: form.description.trim(),
          file_url: fileUrl,
          file_type: fileType,
          file_size_kb: sizeKB,
          status: form.status,
        });
        toast.success("Note updated successfully");
      } else {
        await materialService.create({
          subject_id: effectiveSubjectId,
          title: form.title.trim(),
          description: form.description.trim(),
          file_url: fileUrl || "#",
          file_type: fileType,
          file_size_kb: sizeKB,
          status: form.status,
          material_order: notes.length + 1,
          created_by: teacherUid,
        });
        toast.success("Note uploaded successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["teacher-materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials-by-subjects"] });
      setDialogOpen(false);
    } catch (err: any) {
      console.error("Failed to save note:", err);
      toast.error(err.message || "Failed to save note. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await materialService.delete(deleteId);
      queryClient.invalidateQueries({ queryKey: ["teacher-materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials-by-subjects"] });
      toast.success("Note deleted");
      setDeleteId(null);
    } catch (err: any) {
      console.error("Failed to delete note:", err);
      toast.error(err.message || "Failed to delete note");
    }
  }

  async function handleToggleStatus(id: string, status: PublishStatus) {
    try {
      await materialService.updateStatus(id, status);
      queryClient.invalidateQueries({ queryKey: ["teacher-materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials-by-subjects"] });
      toast.success(status === "published" ? "Note published" : "Note moved to draft");
    } catch (err: any) {
      console.error("Failed to update note status:", err);
      toast.error(err.message || "Failed to update note status");
    }
  }

  if (subjectsLoading || notesLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Notes & Study Material" subtitle="Study material for your subjects" />
        <ContentLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Notes & Study Material" subtitle="Study material for your subjects" />
        <ContentError message={(error as Error).message} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes & Study Material"
        subtitle="Upload and manage study notes, worksheets and PDFs for your students"
        action={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" /> Add Notes / Study Material
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
            aria-label="Search notes"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <ContentEmpty
          icon={FileText}
          title="No notes found"
          body={
            subjects.length === 0
              ? "You have no subjects assigned yet."
              : "Upload your first note or study material."
          }
          action={
            subjects.length > 0 ? (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="size-4" /> Add Notes / Study Material
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((n: Material) => (
            <div key={n.id} className="surface flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{n.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {subjectName(n.subject_id)}
                  </p>
                </div>
                <StatusBadge status={n.status} />
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {n.description || "No description provided."}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {n.file_type || "PDF"} ·{" "}
                  {n.file_size_kb ? `${(n.file_size_kb / 1024).toFixed(1)} MB` : "Document"}
                </span>
                <span>{relative(n.created_at)}</span>
              </div>

              {n.file_url && n.file_url !== "#" ? (
                <a
                  href={n.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline pt-1"
                >
                  <Download className="size-3.5" /> Download / View File
                </a>
              ) : null}

              <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                <PublishToggle
                  status={n.status}
                  onChange={(status) => handleToggleStatus(n.id, status)}
                />
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit note"
                    onClick={() => openEdit(n)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete note"
                    onClick={() => setDeleteId(n.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !isUploading && setDialogOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit Note / Study Material" : "Add Notes / Study Material"}
            </DialogTitle>
          </DialogHeader>
          {subjects.length === 0 ? (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                <p className="font-medium">No subjects assigned</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You need to have at least one subject assigned to upload notes. You can create or
                  manage subjects in the My Subjects portal.
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
                  <Label htmlFor="note-subject">Subject</Label>
                  <SubjectPicker
                    subjects={subjects}
                    value={form.subjectId || subjects[0]?.id || ""}
                    onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
                    id="note-subject"
                  />
                  <FieldError error={errors.subjectId} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="note-title">Title *</Label>
                  <Input
                    id="note-title"
                    placeholder="e.g. Chapter 4: Quadratic Equations - Revision Notes"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    aria-invalid={!!errors.title}
                  />
                  <FieldError error={errors.title} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="note-description">Description / Chapter info (optional)</Label>
                  <Textarea
                    id="note-description"
                    placeholder="Brief description or chapter notes instructions for students..."
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    aria-invalid={!!errors.description}
                  />
                  <FieldError error={errors.description} />
                </div>

                <FileUploadField
                  id="note-file"
                  label="Attach Study Note / Document *"
                  selectedFile={selectedFile}
                  existingUrl={form.fileUrl}
                  existingName={form.fileName}
                  onFileSelect={(file) => setSelectedFile(file)}
                  isUploading={isUploading}
                  error={errors.file}
                  hint="Supported: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, Images, TXT (up to 50MB)"
                />

                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Publish immediately</p>
                    <p className="text-xs text-muted-foreground">
                      Make this study note visible to all enrolled students right away.
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
                    {isUploading ? "Uploading file…" : form.id ? "Save changes" : "Upload note"}
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
        title="Delete this note?"
        description="This will remove the note permanently for all enrolled students. This cannot be undone."
        onConfirm={handleDelete}
      />
    </div>
  );
}
