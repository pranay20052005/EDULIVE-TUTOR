import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle,
  ExternalLink,
  Pencil,
  Plus,
  Radio,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";
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
  SubjectPicker,
} from "@/components/faculty/content-shared";
import { LiveBadge, PageHeader } from "@/components/ui-kit";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { notificationService, scheduledClassService } from "@/lib/db";
import { useLiveClassRealtime } from "@/lib/db/realtime";
import { toDDMMYYYY } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { ScheduledClass, ClassScheduleStatus } from "@/lib/db/types";

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
  const { data: subjects = [], isLoading: subjectsLoading } = useTeacherSubjects(teacher?.id);

  // Realtime live classes subscription
  useLiveClassRealtime();

  const {
    data: classes = [],
    isLoading: classesLoading,
    error,
  } = useQuery({
    queryKey: ["teacher-classes", teacher?.id],
    queryFn: () =>
      teacher?.id ? scheduledClassService.listByTeacher(teacher.id) : Promise.resolve([]),
    enabled: !!teacher?.id,
  });

  const [tab, setTab] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(subjects[0]?.id ?? ""));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const searchState = useRouterState({ select: (s) => s.location.search }) as {
    new?: string | boolean;
  };

  useEffect(() => {
    if (searchState?.new === true || searchState?.new === "true" || searchState?.new === "1") {
      openCreate();
    }
  }, [searchState?.new, subjects]);

  const filtered = useMemo(() => {
    return classes
      .filter((c) => subjectFilter === "all" || c.subject_id === subjectFilter)
      .filter((c) => {
        if (tab === "live") return c.status === "live";
        if (tab === "upcoming") return c.status === "scheduled" || c.status === "upcoming";
        if (tab === "completed") return c.status === "completed";
        return true;
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [classes, subjectFilter, tab]);

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? "Subject";

  function openCreate() {
    const defaultSubId = form.subjectId || subjects[0]?.id || "";
    setForm(emptyForm(defaultSubId));
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
    const effectiveSubjectId = form.subjectId || subjects[0]?.id;
    if (!effectiveSubjectId) next.subjectId = "Select a subject.";
    if (!form.title.trim()) next.title = "Title is required.";
    if (!form.date) next.date = "Pick a date.";
    if (!form.startTime) next.startTime = "Start time is required.";
    if (!form.endTime) next.endTime = "End time is required.";
    if (form.startTime && form.endTime && form.endTime <= form.startTime)
      next.endTime = "End time must be after start time.";
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
    const startsAt = new Date(`${form.date}T${form.startTime}:00`).toISOString();
    const endsAt = new Date(`${form.date}T${form.endTime}:00`).toISOString();

    try {
      if (isEdit) {
        await scheduledClassService.update(form.id, {
          subject_id: effectiveSubjectId,
          title: form.title.trim(),
          topic: form.topic.trim(),
          starts_at: startsAt,
          ends_at: endsAt,
          meeting_url: form.meetingUrl.trim(),
          description: form.description.trim(),
          status: form.status,
        });
        toast.success("Class updated");
      } else {
        const created = await scheduledClassService.create({
          subject_id: effectiveSubjectId,
          teacher_id: teacher.id,
          title: form.title.trim(),
          topic: form.topic.trim(),
          starts_at: startsAt,
          ends_at: endsAt,
          meeting_url: form.meetingUrl.trim(),
          description: form.description.trim(),
          status: "scheduled",
        });

        // Notify enrolled students
        await notificationService.notifyEnrolledStudents(effectiveSubjectId, {
          type: "class",
          title: `New Live Class: ${form.title.trim()}`,
          message: `Scheduled for ${toDDMMYYYY(form.date)} at ${form.startTime}.`,
          related_entity_id: created.id,
          related_entity_type: "scheduled_class",
        });

        toast.success("Class scheduled & enrolled students notified");
      }
      queryClient.invalidateQueries({ queryKey: ["teacher-classes"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-classes"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-classes-by-subjects"] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save scheduled class");
    } finally {
      setSaving(false);
    }
  }

  async function handleStartClass(c: ScheduledClass) {
    try {
      await scheduledClassService.startClass(c.id);
      await notificationService.notifyEnrolledStudents(c.subject_id, {
        type: "class",
        title: `🔴 Class is LIVE: ${c.title}`,
        message: `${teacher.name || "Faculty"} has started the live class. Click to join now!`,
        related_entity_id: c.id,
        related_entity_type: "scheduled_class",
      });
      queryClient.invalidateQueries({ queryKey: ["teacher-classes"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-classes"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-classes-by-subjects"] });
      toast.success("Class is now LIVE! Students notified.");
    } catch (err: any) {
      toast.error(err.message || "Failed to start live class");
    }
  }

  async function handleEndClass(c: ScheduledClass) {
    try {
      await scheduledClassService.endClass(c.id);
      queryClient.invalidateQueries({ queryKey: ["teacher-classes"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-classes"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-classes-by-subjects"] });
      toast.success("Class completed");
    } catch (err: any) {
      toast.error(err.message || "Failed to end class");
    }
  }

  async function handleCancelClass(c: ScheduledClass) {
    try {
      await scheduledClassService.cancelClass(c.id);
      await notificationService.notifyEnrolledStudents(c.subject_id, {
        type: "class",
        title: `Class Cancelled: ${c.title}`,
        message: `The live session on ${toDDMMYYYY(c.starts_at.slice(0, 10))} has been cancelled.`,
        related_entity_id: c.id,
        related_entity_type: "scheduled_class",
      });
      queryClient.invalidateQueries({ queryKey: ["teacher-classes"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-classes"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-classes-by-subjects"] });
      toast.success("Class cancelled and students notified");
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel class");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await scheduledClassService.delete(deleteId);
      queryClient.invalidateQueries({ queryKey: ["teacher-classes"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-classes"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-classes-by-subjects"] });
      toast.success("Class removed");
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove class");
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
        subtitle="Schedule sessions, manage status, and launch live video classrooms"
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Schedule class
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={setTab} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all">All ({classes.length})</TabsTrigger>
            <TabsTrigger value="live">
              Live ({classes.filter((c) => c.status === "live").length})
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              Upcoming (
              {classes.filter((c) => c.status === "scheduled" || c.status === "upcoming").length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({classes.filter((c) => c.status === "completed").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="w-full sm:w-64">
          <SubjectPicker
            subjects={subjects}
            value={subjectFilter}
            onChange={setSubjectFilter}
            includeAll
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <ContentEmpty
          icon={CalendarDays}
          title="No classes match your filter"
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
            const isLive = c.status === "live";

            return (
              <div
                key={c.id}
                className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
              >
                <span
                  className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                    isLive
                      ? "bg-destructive/10 text-destructive animate-pulse"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <Radio className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{c.title}</p>
                    {isLive ? (
                      <LiveBadge />
                    ) : (
                      <Badge
                        variant={
                          c.status === "completed"
                            ? "secondary"
                            : c.status === "cancelled"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {c.status}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground mt-0.5">
                    {subjectName(c.subject_id)} · {toDDMMYYYY(c.starts_at.slice(0, 10))} · {timeStr}
                  </p>
                  {c.topic ? (
                    <p className="truncate text-xs text-muted-foreground mt-0.5">{c.topic}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {/* Action buttons based on lifecycle */}
                  {c.status === "scheduled" || c.status === "upcoming" ? (
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-500"
                      onClick={() => handleStartClass(c)}
                    >
                      <Radio className="size-3.5 mr-1" /> Go Live
                    </Button>
                  ) : null}

                  {isLive ? (
                    <>
                      <Button asChild size="sm" variant="default">
                        <Link to="/classroom/$classId" params={{ classId: c.id }}>
                          <Video className="size-3.5 mr-1" /> Enter Classroom
                        </Link>
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleEndClass(c)}>
                        <CheckCircle className="size-3.5 mr-1" /> End Class
                      </Button>
                    </>
                  ) : null}

                  {c.status === "scheduled" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-amber-600 hover:text-amber-700"
                      onClick={() => handleCancelClass(c)}
                    >
                      <XCircle className="size-3.5 mr-1" /> Cancel
                    </Button>
                  ) : null}

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

      {/* Schedule / Edit Live Class Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit live class" : "Schedule live class"}</DialogTitle>
          </DialogHeader>
          {subjects.length === 0 ? (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                <p className="font-medium">No subjects assigned</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  You need to have at least one subject assigned to schedule live classes.
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
                    placeholder="e.g. Real Numbers & Polynomials Lecture 1"
                  />
                  <FieldError error={errors.title} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="live-topic">Topic / chapter</Label>
                  <Input
                    id="live-topic"
                    value={form.topic}
                    onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                    placeholder="e.g. Chapter 1: Number Systems"
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
                  <Label htmlFor="live-url">Meeting link (Google Meet, Zoom, WebRTC)</Label>
                  <Input
                    id="live-url"
                    placeholder="https://meet.google.com/xyz-abc-def"
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
                    placeholder="Session overview, prerequisites and homework discussion..."
                  />
                </div>
              </div>
              <DialogFooter>
                <FormActions>
                  <CancelButton onClick={() => setDialogOpen(false)} />
                  <Button onClick={handleSubmit} disabled={saving}>
                    <Video className="size-4" />{" "}
                    {saving ? "Saving…" : form.id ? "Save changes" : "Schedule & Notify"}
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
