import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { Loader2, Pencil, Plus, Search, Trash2, Upload, Video } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { recordingService } from "@/lib/db";
import { useRecordingRealtime } from "@/lib/db/realtime";
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
  subjectId: subjectId || "",
  title: "",
  topic: "",
  description: "",
  videoUrl: "",
  durationMin: "45",
  status: "draft",
});

function TeacherRecordings() {
  const { session, teacher } = useSession();
  const queryClient = useQueryClient();
  const { data: subjects = [], isLoading: subjectsLoading } = useTeacherSubjects(teacher?.id);

  // Realtime recordings sync
  useRecordingRealtime();

  const teacherUid = session?.userId || session?.id || teacher?.userId;
  const subjectIds = useMemo(() => subjects.map((s) => s.id), [subjects]);

  const {
    data: recordings = [],
    isLoading: recordingsLoading,
    error,
  } = useQuery({
    queryKey: ["teacher-recordings", teacherUid, subjectIds],
    queryFn: () => recordingService.listByTeacher(teacherUid, subjectIds),
    enabled: true,
  });

  const [subjectFilter, setSubjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(subjects[0]?.id ?? ""));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    const defaultSubId = form.subjectId || subjects[0]?.id || "";
    setForm(emptyForm(defaultSubId));
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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size exceeds 100MB limit.");
      return;
    }

    setUploading(true);
    try {
      toast.info("Uploading video file to Supabase Storage…");
      const { url } = await recordingService.uploadVideoFile(file, teacherUid);
      setForm((f) => ({ ...f, videoUrl: url }));
      toast.success("Video uploaded successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload video file");
    } finally {
      setUploading(false);
    }
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    const effectiveSubjectId = form.subjectId || subjects[0]?.id;
    if (!effectiveSubjectId) next.subjectId = "Select a subject.";
    if (!form.title.trim()) next.title = "Title is required.";
    if (!form.videoUrl.trim()) next.videoUrl = "Add a video link or upload a file.";
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
    setSaving(true);
    const isEdit = !!form.id;
    const effectiveSubjectId = form.subjectId || subjects[0]?.id;

    try {
      if (isEdit) {
        await recordingService.update(form.id, {
          subject_id: effectiveSubjectId,
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
          subject_id: effectiveSubjectId,
          title: form.title.trim(),
          topic: form.topic.trim(),
          description: form.description.trim(),
          video_url: form.videoUrl.trim(),
          duration_min: Number(form.durationMin) || 45,
          status: form.status,
          created_by: teacherUid,
        });
        toast.success("Recording added");
      }
      queryClient.invalidateQueries({ queryKey: ["teacher-recordings"] });
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      queryClient.invalidateQueries({ queryKey: ["recordings-published"] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save recording");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await recordingService.delete(deleteId);
      queryClient.invalidateQueries({ queryKey: ["teacher-recordings"] });
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
      queryClient.invalidateQueries({ queryKey: ["recordings-published"] });
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
      queryClient.invalidateQueries({ queryKey: ["recordings-published"] });
      toast.success(status === "published" ? "Recording published" : "Recording moved to draft");
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  }

  if (subjectsLoading || recordingsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Recorded Classes" subtitle="Recorded lessons for your subjects" />
        <ContentLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Recorded Classes" subtitle="Recorded lessons for your subjects" />
        <ContentError message={(error as Error).message} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recorded Classes"
        subtitle="Manage video library and lecture recordings for your classes"
        action={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" /> Add Recording
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
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or topic"
            className="pl-9"
            aria-label="Search recordings"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <ContentEmpty
          icon={Video}
          title="No recordings found"
          body={
            subjects.length === 0
              ? "You have no subjects assigned yet."
              : "Upload or link your first recorded lesson."
          }
          action={
            subjects.length > 0 ? (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="size-4" /> Add Recording
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r: Recording) => (
            <div key={r.id} className="surface flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {subjectName(r.subject_id)}
                    {r.topic ? ` · ${r.topic}` : ""}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {r.description || "No description."}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{r.duration_min ? `${r.duration_min} mins` : "Duration —"}</span>
                <span>{relative(r.created_at)}</span>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                <PublishToggle
                  status={r.status}
                  onChange={(status) => handleToggleStatus(r.id, status)}
                />
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit recording"
                    onClick={() => openEdit(r)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete recording"
                    onClick={() => setDeleteId(r.id)}
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
            <DialogTitle>{form.id ? "Edit Recording" : "Add Recording"}</DialogTitle>
          </DialogHeader>
          {subjects.length === 0 ? (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                <p className="font-medium">No subjects assigned</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You need to have at least one subject assigned to add recordings.
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
                  <Label htmlFor="rec-subject">Subject</Label>
                  <SubjectPicker
                    subjects={subjects}
                    value={form.subjectId || subjects[0]?.id || ""}
                    onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
                    id="rec-subject"
                  />
                  <FieldError error={errors.subjectId} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rec-title">Title *</Label>
                  <Input
                    id="rec-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    aria-invalid={!!errors.title}
                    placeholder="e.g. Chapter 2: Electrostatics Lecture"
                  />
                  <FieldError error={errors.title} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rec-topic">Topic / Chapter</Label>
                  <Input
                    id="rec-topic"
                    value={form.topic}
                    onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                    placeholder="e.g. Electric Dipole and Flux"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rec-video">Video source *</Label>
                  <Input
                    id="rec-video"
                    value={form.videoUrl}
                    onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                    placeholder="YouTube URL, Vimeo URL or direct video link"
                    aria-invalid={!!errors.videoUrl}
                  />
                  <FieldError error={errors.videoUrl} />
                  <div className="mt-2">
                    <Label
                      htmlFor="rec-upload-file"
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      {uploading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Upload className="size-4" />
                      )}
                      {uploading
                        ? "Uploading video to Supabase Storage…"
                        : "Browse & Upload MP4 / WebM (Max 100MB)"}
                    </Label>
                    <input
                      id="rec-upload-file"
                      type="file"
                      accept="video/mp4,video/webm,video/ogg"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rec-duration">Duration (minutes)</Label>
                  <Input
                    id="rec-duration"
                    type="number"
                    min="1"
                    value={form.durationMin}
                    onChange={(e) => setForm((f) => ({ ...f, durationMin: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rec-desc">Description</Label>
                  <Textarea
                    id="rec-desc"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Summary of topics discussed in this recording..."
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Publish immediately</p>
                    <p className="text-xs text-muted-foreground">
                      Make this recording accessible to enrolled students right away.
                    </p>
                  </div>
                  <PublishToggle
                    status={form.status}
                    onChange={(status) => setForm((f) => ({ ...f, status }))}
                  />
                </div>
              </div>

              <DialogFooter>
                <FormActions>
                  <CancelButton onClick={() => setDialogOpen(false)} />
                  <Button onClick={handleSubmit} disabled={saving || uploading}>
                    {saving ? "Saving…" : form.id ? "Save changes" : "Add recording"}
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
        title="Delete this recording?"
        description="This will permanently delete the recording and all student watch history for it."
        onConfirm={handleDelete}
      />
    </div>
  );
}
