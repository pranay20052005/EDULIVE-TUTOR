import { createFileRoute } from "@tanstack/react-router";
import {
  Award,
  CalendarCheck,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  Target,
  Trophy,
} from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader, SectionTitle, StatCard } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { relative, toDDMMYYYY } from "@/lib/format";
import {
  useStudentTestAttempts,
  useStudentAttendanceSummary,
  useStudentAttendance,
  useStudentEnrollments,
} from "@/lib/db/hooks";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/app/results")({
  head: () => ({
    meta: [
      { title: "Results & Analytics — EduLive" },
      {
        name: "description",
        content: "Attendance, subject-wise progress, score trends, and parent progress reports.",
      },
      { property: "og:title", content: "Results & Analytics — EduLive" },
      { property: "og:description", content: "See your score trend and attendance analytics." },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { student } = useSession();
  const { data: testAttempts = [] } = useStudentTestAttempts(student?.id);
  const { data: attendanceSummary } = useStudentAttendanceSummary(student?.id);
  const { data: attendanceRecords = [] } = useStudentAttendance(student?.id);
  const { data: enrollments = [] } = useStudentEnrollments(student?.id);

  const [parentReportOpen, setParentReportOpen] = useState(false);

  const stats = useMemo(() => {
    if (testAttempts.length === 0) {
      return { avg: 0, best: 0, lowest: 0, testCount: 0 };
    }
    const scores = testAttempts.map((a: any) => {
      const total = a.test?.total_marks || 1;
      return Math.round(((a.marks_obtained || 0) / total) * 100);
    });
    return {
      avg: Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length),
      best: Math.max(...scores),
      lowest: Math.min(...scores),
      testCount: testAttempts.length,
    };
  }, [testAttempts]);

  const scoreTrend = useMemo(() => {
    return testAttempts
      .slice()
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((a: any, idx: number) => ({
        test: `Test ${idx + 1}`,
        score: Math.round(((a.marks_obtained || 0) / (a.test?.total_marks || 1)) * 100),
        date: a.created_at,
      }));
  }, [testAttempts]);

  const attendanceBySubject = useMemo(() => {
    if (!attendanceRecords.length) return [];
    const grouped: Record<string, { subject: string; attended: number; missed: number }> = {};
    for (const record of attendanceRecords) {
      const subName = record.subject?.name || "Subject";
      if (!grouped[subName]) {
        grouped[subName] = { subject: subName, attended: 0, missed: 0 };
      }
      if (record.status === "present" || record.status === "late") {
        grouped[subName].attended += 1;
      } else {
        grouped[subName].missed += 1;
      }
    }
    return Object.values(grouped);
  }, [attendanceRecords]);

  const totalClasses =
    (attendanceSummary?.presentCount ?? 0) + (attendanceSummary?.absentCount ?? 0);
  const attendanceRate =
    totalClasses > 0
      ? Math.round(((attendanceSummary?.presentCount ?? 0) / totalClasses) * 100)
      : 100;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Performance & Results"
          subtitle="Comprehensive attendance, score trends, and progress analytics"
        />
        <Button onClick={() => setParentReportOpen(true)} className="gap-2 shrink-0">
          <FileSpreadsheet className="size-4" /> Parent Progress Card
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Average score" value={`${stats.avg}%`} icon={Target} />
        <StatCard label="Highest score" value={`${stats.best}%`} icon={Trophy} tone="success" />
        <StatCard
          label="Attendance rate"
          value={`${attendanceRate}%`}
          hint={`${attendanceSummary?.presentCount ?? 0} of ${totalClasses} sessions`}
          icon={CalendarCheck}
          tone="accent"
        />
        <StatCard
          label="Tests completed"
          value={`${stats.testCount}`}
          hint={`Lowest: ${stats.lowest}%`}
          icon={Award}
          tone="warning"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <SectionTitle title="Score trend" />
          <div className="h-64">
            {scoreTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scoreTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="test" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No test attempts yet</p>
              </div>
            )}
          </div>
        </section>

        <section className="surface p-5">
          <SectionTitle title="Attendance by subject" />
          <div className="h-64">
            {attendanceBySubject.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceBySubject}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="subject" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="attended" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="missed" fill="var(--destructive)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No attendance records logged yet</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {testAttempts.length > 0 && (
        <section>
          <SectionTitle title="Test history" />
          <div className="surface divide-y divide-border">
            {testAttempts
              .slice()
              .sort(
                (a: any, b: any) =>
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
              )
              .map((attempt: any) => (
                <div key={attempt.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{attempt.test?.title || "Test"}</p>
                    <p className="text-xs text-muted-foreground">
                      {relative(attempt.created_at)} · {attempt.test?.duration_min ?? 0} min
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {attempt.marks_obtained}/{attempt.test?.total_marks || 0} (
                    {Math.round(
                      ((attempt.marks_obtained || 0) / (attempt.test?.total_marks || 1)) * 100,
                    )}
                    %)
                  </Badge>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Parent Progress Card Modal */}
      <Dialog open={parentReportOpen} onOpenChange={setParentReportOpen}>
        <DialogContent className="sm:max-w-[680px] p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-semibold">
              Parent Academic Progress Card
            </DialogTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              className="h-8 text-xs"
            >
              <Printer className="size-3.5 mr-1.5" /> Print Report
            </Button>
          </DialogHeader>

          <div className="p-6 space-y-6 bg-card">
            {/* Header branding */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold">EduLive Academic Performance Report</h3>
                <p className="text-xs text-muted-foreground">
                  Official progress digest for Parent / Guardian
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                Generated: {toDDMMYYYY(new Date().toISOString().slice(0, 10))}
              </Badge>
            </div>

            {/* Student & Parent Metadata */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-muted/50 p-3">
                <span className="text-muted-foreground">Student Name:</span>
                <p className="font-semibold text-sm mt-0.5">{student.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {student.standard || "10th"} Standard · {student.board || "CBSE"}
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <span className="text-muted-foreground">Parent / Guardian:</span>
                <p className="font-semibold text-sm mt-0.5">{student.parentName || "Parent"}</p>
                <p className="text-[11px] text-muted-foreground">
                  Contact: {student.parentPhone || student.phone || "—"}
                </p>
              </div>
            </div>

            {/* Academic KPI Grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Average Test Score</p>
                <p className="text-2xl font-bold text-primary mt-1">{stats.avg}%</p>
              </div>
              <div className="border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Attendance Percentage</p>
                <p className="text-2xl font-bold text-success mt-1">{attendanceRate}%</p>
              </div>
              <div className="border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Enrolled Subjects</p>
                <p className="text-2xl font-bold mt-1">{enrollments.length}</p>
              </div>
            </div>

            {/* Enrolled Subjects summary */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Enrolled Curriculum
              </p>
              <div className="divide-y divide-border border border-border rounded-xl">
                {enrollments.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between p-2.5 text-xs">
                    <span className="font-medium">{e.subject?.name || "Subject"}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      Active Enrollment
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-primary" /> EduLive Verified Academic System
              </span>
              <span>EduLive EdTech SaaS</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
