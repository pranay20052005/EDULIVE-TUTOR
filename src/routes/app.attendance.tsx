import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { useMemo } from "react";

import { CardSkeleton, PageHeader, ProgressBar, StatCard } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { toDDMMYYYY } from "@/lib/format";
import {
  useStudentAttendance,
  useStudentAttendanceSummary,
  useStudentEnrollments,
} from "@/lib/db/hooks";
import { useSession } from "@/lib/session";
import type { Attendance } from "@/lib/db/types";

export const Route = createFileRoute("/app/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — EduLive" },
      {
        name: "description",
        content: "Your overall and subject-wise attendance across live classes.",
      },
      { property: "og:title", content: "Attendance — EduLive" },
      {
        property: "og:description",
        content: "Track your attendance percentage and session history.",
      },
    ],
  }),
  component: AttendancePage,
});

const statusTone: Record<string, string> = {
  present: "bg-success/15 text-success",
  late: "bg-warning/20 text-warning-foreground",
  absent: "bg-destructive/12 text-destructive",
};

const statusIcon: Record<string, typeof CheckCircle2> = {
  present: CheckCircle2,
  late: Clock3,
  absent: XCircle,
};

function AttendancePage() {
  const { student } = useSession();
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useStudentEnrollments(
    student?.id,
  );
  const { data: attendanceRecords = [], isLoading: attendanceLoading } = useStudentAttendance(
    student?.id,
  );
  const { data: summary } = useStudentAttendanceSummary(student?.id);

  const bySubject = useMemo(() => {
    return enrollments
      .map((enrollment: any) => {
        const recs = attendanceRecords.filter((a: any) => a.subject_id === enrollment.subject_id);
        if (recs.length === 0) return null;
        const present = recs.filter(
          (a: any) => a.status === "present" || a.status === "late",
        ).length;
        return {
          subjectId: enrollment.subject_id,
          subjectName: enrollment.subject?.name,
          total: recs.length,
          present,
          pct: Math.round((present / recs.length) * 100),
        };
      })
      .filter((x: any): x is typeof x & {} => x !== null);
  }, [enrollments, attendanceRecords]);

  if (enrollmentsLoading || attendanceLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Attendance" subtitle="Loading your attendance…" />
        <CardSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Attendance" subtitle="Your overall and subject-wise attendance" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Overall attendance"
          value={`${summary?.percentage ?? 0}%`}
          icon={CalendarCheck}
        />
        <StatCard
          label="Sessions attended"
          value={`${summary?.presentCount ?? 0}`}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Sessions missed"
          value={`${(summary?.absentCount ?? 0) + (summary?.lateCount ?? 0)}`}
          icon={XCircle}
          tone="warning"
        />
        <StatCard
          label="Subjects tracked"
          value={`${bySubject.length}`}
          icon={Clock3}
          tone="accent"
        />
      </div>

      {bySubject.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold sm:text-lg">Subject-wise breakdown</h2>
          <div className="surface divide-y divide-border">
            {bySubject.map((s: any) => (
              <div key={s.subjectId} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.subjectName}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.present} present · {s.total - s.present} missed
                  </p>
                  <ProgressBar value={s.pct} className="mt-2" />
                </div>
                <span className="shrink-0 text-sm font-semibold">{s.pct}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {attendanceRecords.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold sm:text-lg">Session history</h2>
          <div className="surface divide-y divide-border">
            {attendanceRecords
              .sort(
                (a: any, b: any) =>
                  new Date(b.marked_at).getTime() - new Date(a.marked_at).getTime(),
              )
              .map((record: Attendance) => {
                const Icon = statusIcon[record.status] || CheckCircle2;
                return (
                  <div key={record.id} className="flex items-center gap-3 p-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{record.subject?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {toDDMMYYYY(record.marked_at)}
                      </p>
                    </div>
                    <Badge
                      className={`shrink-0 capitalize ${statusTone[record.status] || ""}`}
                      variant="secondary"
                    >
                      {record.status}
                    </Badge>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {attendanceRecords.length === 0 && (
        <div className="surface rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No attendance records yet. Your attendance will appear here once your faculty starts
            marking.
          </p>
        </div>
      )}
    </div>
  );
}
