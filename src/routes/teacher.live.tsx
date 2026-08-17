import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Pencil, Plus, Radio, Trash2, Video } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { scheduledClassService } from "@/lib/db";
import { toDDMMYYYY } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { ScheduledClass, PublishStatus, ClassScheduleStatus } from "@/lib/db/types";

export const Route = createFileRoute("/teacher/live")({
  head: () => ({
    meta: [
      { title: "Live Classes — EduLive Faculty" },
      {
        name: "description",
        content: "Schedule, edit and start live virtual classes for your subjects.",
      },
      { property: "og:title", content: "Live Classes — EduLive Faculty" },
      {
        property: "og:description",
        content: "Manage your live class timetable and meeting links.",
      },
    ],
  }),
  component: TeacherLive,
});

interface FormState {
  id: string;
  subjectId: string;
  title: string;
  topic: string;
  date: string;
  startTime: string;
  endTime: string;
  meetingUrl: string;
  description: string;
  status: ClassScheduleStatus;
}

const emptyForm = (subjectId: string): FormState => ({
  id: "",
  subjectId,
  title: "",
  topic: "",
  date: new Date().toISOString().slice(0, 10),
  startTime: "17:00",
  endTime: "18:00",
  meetingUrl: "",
  description: "",
  status: "scheduled",
});

function TeacherLive() {
  const { teacher } = useSession();
  const queryClient = useQueryClient();
  const { data: subjects = [], isLoading: subjectsLoading } = useTeacherSubjects(teacher.id);

  const {
    data: classes = [],
    isLoading: classesLoading,
    error,
  } = useQuery({
    queryKey: ["teacher-classes", teacher.id],
    queryFn: () =>
      teacher.id ? scheduledClassService.listByTeacher(teacher.id) : Promise.resolve([]),
    enabled: !!teacher.id,
  });

  const [subjectFilter, setSubjectFilter] = useState("all");
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
      classes
        .filter((c) => subjectFilter === "all" || c.subject_id === subjectFilter)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [classes, subjectFilter],
  );

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "Subject";

  function openCreate() {
    setForm(emptyForm(subjects[0]?.id ?? ""));
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(c: ScheduledClass) {
    const start = new Date(c.starts_at);
    const end = new Date(c.ends_at);
    setForm({
      id: c.id,
      subjectId: c.subject_id,
      title: c.title,
      topic: c.topic || "",
      date: c.starts_at.slice(0, 10),
      startTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
      endTime: `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
      meetingUrl: c.meeting_url || "",
      description: c.description || "",
      status: c.status,
    });
    setErrors({});
    setDialogOpen(true);
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.subjectId) next.subjectId = "Select a subject.";
    if (!form.title.trim()) next.title = "Title is required.";
    if (!form.date) next.date = "Pick a date.";
    if (!form.startTime) next.startTime = "Start time is required.";
    if (!form.endTime) next.endTime = "End time is required.";
    if (form.startTime && form.endTime && form.endTime <= form.startTime)
      next.endTime = "End time must be after start time.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    const isEdit = !!form.id;
    const startsAt = new Date(`${form.date}T${form.startTime}:00`).toISOString();
    const endsAt = new Date(`${form.date}T${form.endTime}:00`).toISOString();

    try {
      if (isEdit) {
        await scheduledClassService.update(form.id, {
          subject_id: form.subjectId,
          title: form.title.trim(),
          topic: form.topic.trim(),
          starts_at: startsAt,
          ends_at: endsAt,
          meeting_url: form.meetingUrl.trim(),
          description: form.description.trim(),
          status: form.status === "published" ? "scheduled" : "draft",
        });
        toast.success("Class updated");
      } else {
        await scheduledClassService.create({
          subject_id: form.subjectId,
          teacher_id: teacher.id,
          title: form.title.trim(),
          topic: form.topic.trim(),
          starts_at: startsAt,
          ends_at: endsAt,
          meeting_url: form.meetingUrl.trim(),
          description: form.description.trim(),
          status: "scheduled",
        });
        toast.success("Class scheduled");
      }
      queryClient.invalidateQueries({ queryKey: ["teacher-classes"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-classes"] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save scheduled class");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await scheduledClassService.delete(deleteId);
      queryClient.invalidateQueries({ queryKey: ["teacher-classes"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-classes"] });
      toast.success("Class removed");
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove class");
    }
  }

  async function handleToggleStatus(c: ScheduledClass, status: PublishStatus) {
    const nextStatus: ClassScheduleStatus = status === "published" ? "scheduled" : "cancelled";
    try {
      await scheduledClassService.updateStatus(c.id, nextStatus);
      queryClient.invalidateQueries({ queryKey: ["teacher-classes"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-classes"] });
      toast.success(status === "published" ? "Class activated" : "Class cancelled");
    } catch (err: any) {
      toast.error(err.message || "Failed to update class status");
    }
  }

  if (subjectsLoading || classesLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Live Classes" subtitle="Your live class timetable" />
        <ContentLoading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Live Classes" subtitle="Your live class timetable" />
        <ContentError message={(error as Error).message} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Classes"
        subtitle="Schedule sessions, share meeting links and start your classes"
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Schedule class
          </Button>
        }
      />

      <div className="max-w-xs">
        <SubjectPicker
          subjects={subjects}
          value={subjectFilter}
          onChange={setSubjectFilter}
          includeAll
        />
      </div>

      {filtered.length === 0 ? (
        <ContentEmpty
          icon={CalendarDays}
          title="No classes scheduled"
          body="Schedule your first live session so enrolled students can join."
          action={
            subjects.length ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" /> Schedule class
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((c: ScheduledClass) => {
            const start = new Date(c.starts_at);
            const end = new Date(c.ends_at);
            const timeStr = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}–${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
            return (
              <div
                key={c.id}
                className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Radio className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <StatusBadge
                      status={
                        c.status === "scheduled" || c.status === "live" ? "published" : "draft"
                      }
                    />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {subjectName(c.subject_id)} · {toDDMMYYYY(c.starts_at.slice(0, 10))} · {timeStr}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.topic || c.description}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <PublishToggle
                    status={c.status === "scheduled" || c.status === "live" ? "published" : "draft"}
                    onChange={(next) => handleToggleStatus(c, next)}
                  />
                  <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteId(c.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit class" : "Schedule live class"}</DialogTitle>
          </DialogHeader>
          {subjects.length === 0 ? (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                <p className="font-medium">No subjects assigned</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You need to have at least one subject assigned to schedule live classes. You can
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
                  <Label htmlFor="live-subject">Subject</Label>
                  <SubjectPicker
                    id="live-subject"
                    subjects={subjects}
                    value={form.subjectId}
                    onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
                  />
                  <FieldError error={errors.subjectId} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="live-title">Title</Label>
                  <Input
                    id="live-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                  <FieldError error={errors.title} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="live-topic">Topic / chapter</Label>
                  <Input
                    id="live-topic"
                    value={form.topic}
                    onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  />
                  <FieldError error={errors.topic} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="live-date">Date</Label>
                    <Input
                      id="live-date"
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    />
                    <FieldError error={errors.date} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="live-start">Start</Label>
                    <Input
                      id="live-start"
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    />
                    <FieldError error={errors.startTime} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="live-end">End</Label>
                    <Input
                      id="live-end"
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                    />
                    <FieldError error={errors.endTime} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="live-url">Meeting link</Label>
                  <Input
                    id="live-url"
                    placeholder="https://meet.google.com/…"
                    value={form.meetingUrl}
                    onChange={(e) => setForm((f) => ({ ...f, meetingUrl: e.target.value }))}
                  />
                  <FieldError error={errors.meetingUrl} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="live-desc">Description</Label>
                  <Textarea
                    id="live-desc"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <FormActions>
                  <CancelButton onClick={() => setDialogOpen(false)} />
                  <Button onClick={handleSubmit}>
                    <Video className="size-4" /> {form.id ? "Save changes" : "Schedule"}
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
        title="Remove this class?"
        description="Students will no longer see this session in their timetable."
        confirmLabel="Remove"
        onConfirm={handleDelete}
      />
    </div>
  );
}
