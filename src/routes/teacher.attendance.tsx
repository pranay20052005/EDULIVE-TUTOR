import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, CheckCheck, History, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  CardSkeleton,
  EmptyState,
  PageHeader,
  ProgressBar,
  SectionTitle,
  StatCard,
} from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { attendanceService, enrollmentService } from "@/lib/db";
import { useTeacherSubjects } from "@/lib/db/hooks";
import { fromDDMMYYYY, maskDOB, toDDMMYYYY } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Attendance, AttendanceStatus } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teacher/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — EduLive Faculty" },
      { name: "description", content: "Mark and review class attendance for your subjects." },
      { property: "og:title", content: "Attendance — EduLive Faculty" },
      { property: "og:description", content: "Attendance manager and session history." },
    ],
  }),
  component: TeacherAttendance,
});

const statusOrder: AttendanceStatus[] = ["present", "absent", "late"];
const statusLabel: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
};
const statusTone: Record<AttendanceStatus, string> = {
  present: "bg-success/15 text-success",
  absent: "bg-destructive/15 text-destructive",
  late: "bg-warning/20 text-warning-foreground",
};

function todayDDMMYYYY() {
  return toDDMMYYYY(new Date().toISOString());
}

function TeacherAttendance() {
  const { teacher } = useSession();
  const queryClient = useQueryClient();
  const { data: mySubjects = [], isLoading: subjectsLoading } = useTeacherSubjects(teacher.id);

  const [subjectId, setSubjectId] = useState(mySubjects[0]?.id ?? "");
  const [dateStr, setDateStr] = useState(todayDDMMYYYY());
  const [sessionName, setSessionName] = useState("Morning session");
  const [notes, setNotes] = useState("");
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);

  const currentSubjectId = subjectId || mySubjects[0]?.id || "";

  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: ["teacher-subject-roster", currentSubjectId],
    queryFn: async () => {
      if (!currentSubjectId) return [];
      const rows = await enrollmentService.getSubjectEnrollments(currentSubjectId);
      return rows
        .map((row) => row.student)
        .filter((student): student is NonNullable<typeof student> => !!student && !!student.user)
        .map((student) => ({
          id: student.id,
          name: student.user?.name ?? "Student",
          standard: student.standard ?? "",
          email: student.user?.email ?? "",
          board: student.board ?? "",
        }));
    },
    enabled: !!currentSubjectId,
  });

  const { data: attendanceHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["teacher-attendance-history", teacher.id],
    queryFn: () => (teacher.id ? attendanceService.listByTeacher(teacher.id) : Promise.resolve([])),
    enabled: !!teacher.id,
  });

  const setRecordStatus = (studentId: string, status: AttendanceStatus) => {
    setRecords((r) => ({ ...r, [studentId]: status }));
  };

  const markAllPresent = () => {
    const next: Record<string, AttendanceStatus> = {};
    roster.forEach((s) => (next[s.id] = "present"));
    setRecords(next);
  };

  const submit = async () => {
    if (!currentSubjectId) {
      toast.error("Select a subject first.");
      return;
    }
    const iso = fromDDMMYYYY(dateStr);
    if (!iso) {
      toast.error("Enter a valid date in DD/MM/YYYY format.");
      return;
    }
    if (roster.length === 0) {
      toast.error("This subject has no enrolled students yet.");
      return;
    }
    const unmarked = roster.filter((s) => !records[s.id]);
    if (unmarked.length > 0) {
      toast.error(`Mark attendance for all ${roster.length} students before saving.`);
      return;
    }

    setSaving(true);
    try {
      // Save all attendance records
      await Promise.all(
        roster.map((s) =>
          attendanceService.markAttendance({
            student_id: s.id,
            subject_id: currentSubjectId,
            teacher_id: teacher.id,
            attendance_date: iso,
            status: records[s.id]!,
            session: sessionName.trim(),
            notes: notes.trim() || undefined,
          }),
        ),
      );

      queryClient.invalidateQueries({ queryKey: ["teacher-attendance-history"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Attendance saved successfully");
      setRecords({});
      setNotes("");
    } catch (err: any) {
      toast.error(err.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(records).filter((v) => v === "present").length;
  const lateCount = Object.values(records).filter((v) => v === "late").length;
  const absentCount = Object.values(records).filter((v) => v === "absent").length;

  if (subjectsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Attendance" subtitle="Mark and review attendance" />
        <CardSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" subtitle="Mark attendance and review past sessions" />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Roster size" value={`${roster.length}`} icon={Users} />
        <StatCard
          label="Marked present"
          value={`${presentCount}`}
          icon={CheckCheck}
          tone="success"
        />
        <StatCard
          label="Records saved"
          value={`${attendanceHistory.length}`}
          icon={History}
          tone="accent"
        />
      </div>

      <section className="surface space-y-4 p-5">
        <SectionTitle title="Take attendance" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="att-subject">Subject</Label>
            <Select
              value={currentSubjectId}
              onValueChange={(v) => {
                setSubjectId(v);
                setRecords({});
              }}
            >
              <SelectTrigger id="att-subject">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {mySubjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.standard || "10th"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="att-date">Date (DD/MM/YYYY)</Label>
            <Input
              id="att-date"
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              value={dateStr}
              onChange={(e) => setDateStr(maskDOB(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="att-session">Session / class</Label>
            <Input
              id="att-session"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
            />
          </div>
        </div>

        {roster.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students enrolled"
            body="This subject has no enrolled students yet."
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {presentCount} present · {lateCount} late · {absentCount} absent ·{" "}
                {roster.length - Object.keys(records).length} unmarked
              </p>
              <Button size="sm" variant="outline" onClick={markAllPresent}>
                <CheckCheck className="size-4" /> Mark all present
              </Button>
            </div>

            <div className="divide-y divide-border overflow-x-auto rounded-xl border border-border">
              {roster.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.email} · {s.standard}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {statusOrder.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setRecordStatus(s.id, st)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                          records[s.id] === st
                            ? cn("border-transparent", statusTone[st])
                            : "border-border text-muted-foreground hover:border-primary/40",
                        )}
                      >
                        {statusLabel[st]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="att-notes">Notes (optional)</Label>
          <Textarea
            id="att-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={submit} disabled={roster.length === 0 || saving}>
            {saving ? "Saving…" : "Save attendance"}
          </Button>
        </div>
      </section>

      <section>
        <SectionTitle title="Attendance history" />
        {attendanceHistory.length === 0 ? (
          <EmptyState
            icon={History}
            title="No sessions yet"
            body="Attendance records you save will appear here for review."
          />
        ) : (
          <div className="surface divide-y divide-border">
            {attendanceHistory.slice(0, 10).map((a: Attendance) => {
              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {a.student?.user?.name || "Student"} · {a.subject?.name || "Subject"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {toDDMMYYYY((a.marked_at || a.created_at).slice(0, 10))}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn("shrink-0 capitalize", statusTone[a.status])}
                  >
                    {a.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
