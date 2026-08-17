import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
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

const FILE_TYPES = ["PDF", "DOC", "PPT", "Image", "Link"];

interface FormState {
  id: string;
  subjectId: string;
  title: string;
  chapter: string;
  description: string;
  fileName: string;
  fileType: string;
  sizeKB: string;
  status: PublishStatus;
}

const emptyForm = (subjectId: string): FormState => ({
  id: "",
  subjectId,
  title: "",
  chapter: "",
  description: "",
  fileName: "",
  fileType: "PDF",
  sizeKB: "1024",
  status: "draft",
});

function TeacherNotes() {
  const { teacher } = useSession();
  const queryClient = useQueryClient();
  const { data: subjects = [], isLoading: subjectsLoading } = useTeacherSubjects(teacher.id);

  const {
    data: notes = [],
    isLoading: notesLoading,
    error,
  } = useQuery({
    queryKey: ["teacher-materials", teacher.id],
    queryFn: () => (teacher.id ? materialService.listByTeacher(teacher.id) : Promise.resolve([])),
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
    setForm(emptyForm(subjects[0]?.id ?? ""));
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(n: Material) {
    setForm({
      id: n.id,
      subjectId: n.subject_id,
      title: n.title,
      chapter: "",
      description: n.description || "",
      fileName: n.file_url || "",
      fileType: n.file_type || "PDF",
      sizeKB: String(n.file_size_kb || 1024),
      status: n.status,
    });
    setErrors({});
    setDialogOpen(true);
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.subjectId) next.subjectId = "Select a subject.";
    if (!form.title.trim()) next.title = "Title is required.";
    if (!form.description.trim()) next.description = "Description is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    const isEdit = !!form.id;

    try {
      if (isEdit) {
        await materialService.update(form.id, {
          title: form.title.trim(),
          description: form.description.trim(),
          file_url: form.fileName.trim() || "#",
          file_type: form.fileType,
          file_size_kb: Number(form.sizeKB) || 1024,
          status: form.status,
        });
        toast.success("Note updated");
      } else {
        await materialService.create({
          subject_id: form.subjectId,
          title: form.title.trim(),
          description: form.description.trim(),
          file_url: form.fileName.trim() || "#",
          file_type: form.fileType,
          file_size_kb: Number(form.sizeKB) || 1024,
          status: form.status,
          material_order: notes.length + 1,
          created_by: teacher.id,
        });
        toast.success("Note uploaded");
      }
      queryClient.invalidateQueries({ queryKey: ["teacher-materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save note");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await materialService.delete(deleteId);
      queryClient.invalidateQueries({ queryKey: ["teacher-materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Note deleted");
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete note");
    }
  }

  async function handleToggleStatus(id: string, status: PublishStatus) {
    try {
      await materialService.updateStatus(id, status);
      queryClient.invalidateQueries({ queryKey: ["teacher-materials"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success(status === "published" ? "Note published" : "Note moved to draft");
    } catch (err: any) {
      toast.error(err.message || "Failed to update note status");
    }
  }

  if (subjectsLoading || notesLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Notes & PDFs" subtitle="Study material for your subjects" />
        <ContentLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Notes & PDFs" subtitle="Study material for your subjects" />
        <ContentError message={(error as Error).message} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes & PDFs"
        subtitle="Upload and manage study material for your students"
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Upload note
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
              : "Upload your first note or adjust your filters."
          }
          action={
            subjects.length > 0 ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" /> Upload note
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
              <p className="line-clamp-2 text-xs text-muted-foreground">{n.description}</p>
              <p className="text-xs text-muted-foreground">
                {n.file_type} ·{" "}
                {n.file_size_kb ? `${Math.round((n.file_size_kb / 1024) * 100) / 100} MB` : "File"}{" "}
                · {relative(n.created_at)}
              </p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit note" : "Upload note"}</DialogTitle>
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
                    value={form.subjectId}
                    onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
                    id="note-subject"
                  />
                  <FieldError error={errors.subjectId} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note-title">Title</Label>
                  <Input
                    id="note-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    aria-invalid={!!errors.title}
                  />
                  <FieldError error={errors.title} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note-description">Description</Label>
                  <Textarea
                    id="note-description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    aria-invalid={!!errors.description}
                  />
                  <FieldError error={errors.description} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="note-type">Type</Label>
                    <Select
                      value={form.fileType}
                      onValueChange={(v) => setForm((f) => ({ ...f, fileType: v }))}
                    >
                      <SelectTrigger id="note-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FILE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="note-size">Size (KB)</Label>
                    <Input
                      id="note-size"
                      type="number"
                      min="1"
                      value={form.sizeKB}
                      onChange={(e) => setForm((f) => ({ ...f, sizeKB: e.target.value }))}
                      aria-invalid={!!errors.sizeKB}
                    />
                    <FieldError error={errors.sizeKB} />
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
        title="Delete this note?"
        description="This will remove the note permanently for all enrolled students. This cannot be undone."
        onConfirm={handleDelete}
      />
    </div>
  );
}
