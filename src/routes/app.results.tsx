import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, PlayCircle, Target, Trophy } from "lucide-react";
import { useMemo } from "react";
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
import { relative } from "@/lib/format";
import {
  useStudentTestAttempts,
  useStudentAttendanceSummary,
  useStudentAttendance,
} from "@/lib/db/hooks";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/app/results")({
  head: () => ({
    meta: [
      { title: "Results & performance — EduLive" },
      {
        name: "description",
        content: "Attendance, subject-wise progress, score trends and test history.",
      },
      { property: "og:title", content: "Results & performance — EduLive" },
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

  const stats = useMemo(() => {
    if (testAttempts.length === 0) {
      return { avg: 0, best: 0, testCount: 0 };
    }
    const scores = testAttempts.map((a: any) => {
      const total = a.test?.total_marks || 1;
      return Math.round(((a.marks_obtained || 0) / total) * 100);
    });
    return {
      avg: Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length),
      best: Math.max(...scores),
      testCount: testAttempts.length,
    };
  }, [testAttempts]);

  const scoreTrend = useMemo(() => {
    return testAttempts
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

  return (
    <div className="space-y-8">
      <PageHeader title="Performance" subtitle="Attendance, progress and test analytics" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Average score" value={`${stats.avg}%`} icon={Target} />
        <StatCard label="Highest score" value={`${stats.best}%`} icon={Trophy} tone="success" />
        <StatCard
          label="Classes attended"
          value={`${attendanceSummary?.presentCount ?? 0}`}
          hint={`${attendanceSummary?.absentCount ?? 0} missed`}
          icon={CalendarCheck}
          tone="accent"
        />
        <StatCard
          label="Tests taken"
          value={`${stats.testCount}`}
          hint={`Average ${stats.avg}%`}
          icon={PlayCircle}
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
                <p>No test data yet</p>
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
                <p>No attendance data yet</p>
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
                    {attempt.marks_obtained}/{attempt.test?.total_marks || 0}
                  </Badge>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
