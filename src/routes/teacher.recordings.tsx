import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search, Trash2, Video } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { recordingService } from "@/lib/db";
import { relative } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Recording, PublishStatus } from "@/lib/db/types";

export const Route = createFileRoute("/teacher/recordings")({
  head: () => ({
    meta: [
      { title: "Recorded Classes — EduLive Faculty" },
      {
        name: "description",
        content: "Upload and publish recorded class videos for your students.",
      },
      { property: "og:title", content: "Recorded Classes — EduLive Faculty" },
      { property: "og:description", content: "Manage your recorded lesson library." },
    ],
  }),
  component: TeacherRecordings,
});

interface FormState {
  id: string;
  subjectId: string;
  title: string;
  topic: string;
  description: string;
  videoUrl: string;
  durationMin: string;
  status: PublishStatus;
}

const emptyForm = (subjectId: string): FormState => ({
  id: "",
  subjectId,
  title: "",
  topic: "",
  description: "",
  videoUrl: "",
  durationMin: "45",
  status: "draft",
});

function TeacherRecordings() {
  const { teacher } = useSession();
  const queryClient = useQueryClient();
  const { data: subjects = [], isLoading: subjectsLoading } = useTeacherSubjects(teacher.id);

  const {
    data: recordings = [],
    isLoading: recordingsLoading,
    error,
  } = useQuery({
    queryKey: ["teacher-recordings", teacher.id],
    queryFn: () => (teacher.id ? recordingService.listByTeacher(teacher.id) : Promise.resolve([])),
    enabled: !!teacher.id,
  });

  const [subjectFilter, setSubjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(subjects[0]?.id ?? ""));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      recordings
        .filter((r: Recording) => subjectFilter === "all" || r.subject_id === subjectFilter)
        .filter((r: Recording) =>
          search.trim()
            ? `${r.title} ${r.topic || ""}`.toLowerCase().includes(search.trim().toLowerCase())
            : true,
        )
        .sort((a: Recording, b: Recording) => +new Date(b.created_at) - +new Date(a.created_at)),
    [recordings, subjectFilter, search],
  );

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "Subject";

  function openCreate() {
    setForm(emptyForm(subjects[0]?.id ?? ""));
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(r: Recording) {
    setForm({
      id: r.id,
      subjectId: r.subject_id,
      title: r.title,
      topic: r.topic || "",
      description: r.description || "",
      videoUrl: r.video_url || "",
      durationMin: String(r.duration_min || 45),
      status: r.status,
    });
    setErrors({});
    setDialogOpen(true);
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.subjectId) next.subjectId = "Select a subject.";
    if (!form.title.trim()) next.title = "Title is required.";
    if (!form.videoUrl.trim()) next.videoUrl = "Add a video link.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    const isEdit = !!form.id;

    try {
      if (isEdit) {
        await recordingService.update(form.id, {
          title: form.title.trim(),
          topic: form.topic.trim(),
          description: form.description.trim(),
          video_url: form.videoUrl.trim(),
          duration_min: Number(form.durationMin) || 45,
          status: form.status,
        });
        toast.success("Recording updated");
      } else {
        await recordingService.create({
          subject_id: form.subjectId,
          title: form.title.trim(),
          topic: form.topic.trim(),
          description: form.description.trim(),
          video_url: form.videoUrl.trim(),
          duration_min: Number(form.durationMin) || 45,
          status: form.status,
          created_by: teacher.id,
        });
        toast.success("Recording added");
      }
      queryClient.invalidateQueries({ queryKey: ["teacher-recordings"] });
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save recording");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await recordingService.delete(deleteId);
      queryClient.invalidateQueries({ queryKey: ["teacher-recordings"] });
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      toast.success("Recording deleted");
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete recording");
    }
  }

  async function handleToggleStatus(id: string, status: PublishStatus) {
    try {
      await recordingService.updateStatus(id, status);
      queryClient.invalidateQueries({ queryKey: ["teacher-recordings"] });
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      toast.success(status === "published" ? "Recording published" : "Recording moved to draft");
    } catch (err: any) {
      toast.error(err.message || "Failed to update recording status");
    }
  }

  if (subjectsLoading || recordingsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Recorded Classes" subtitle="Your recorded lesson library" />
        <ContentLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Recorded Classes" subtitle="Your recorded lesson library" />
        <ContentError message={(error as Error).message} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recorded Classes"
        subtitle="Upload session recordings so students can revise anytime"
        action={
          <Button onClick={openCreate} disabled={subjects.length === 0}>
            <Plus className="size-4" /> Add recording
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="sm:max-w-xs sm:flex-1">
          <SubjectPicker
            subjects={subjects}
            value={subjectFilter}
            onChange={setSubjectFilter}
            includeAll
          />
        </div>
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search recordings"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <ContentEmpty
          icon={Video}
          title="No recordings yet"
          body="Add your first recorded class to build a revision library."
          action={
            subjects.length ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" /> Add recording
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((r: Recording) => (
            <div key={r.id} className="surface flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {subjectName(r.subject_id)} · {r.duration_min} min · {relative(r.created_at)}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
              <div className="mt-auto flex items-center justify-between gap-2">
                <PublishToggle
                  status={r.status}
                  onChange={(next) => handleToggleStatus(r.id, next)}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteId(r.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit recording" : "Add recording"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rec-subject">Subject</Label>
              <SubjectPicker
                id="rec-subject"
                subjects={subjects}
                value={form.subjectId}
                onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
              />
              <FieldError error={errors.subjectId} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-title">Title</Label>
              <Input
                id="rec-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <FieldError error={errors.title} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-topic">Topic / chapter</Label>
              <Input
                id="rec-topic"
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              />
              <FieldError error={errors.topic} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rec-url">Video link</Label>
                <Input
                  id="rec-url"
                  placeholder="https://…"
                  value={form.videoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                />
                <FieldError error={errors.videoUrl} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-duration">Duration (min)</Label>
                <Input
                  id="rec-duration"
                  inputMode="numeric"
                  value={form.durationMin}
                  onChange={(e) => setForm((f) => ({ ...f, durationMin: e.target.value }))}
                />
                <FieldError error={errors.durationMin} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-desc">Description</Label>
              <Textarea
                id="rec-desc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <FormActions>
              <CancelButton onClick={() => setDialogOpen(false)} />
              <Button onClick={handleSubmit}>{form.id ? "Save changes" : "Add recording"}</Button>
            </FormActions>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete this recording?"
        description="Students will lose access to this video immediately."
        onConfirm={handleDelete}
      />
    </div>
  );
}
