import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, CalendarCheck, IndianRupee, Trophy } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader, SectionTitle, StatCard } from "@/components/ui-kit";
import { inr } from "@/lib/format";
import {
  useAllPayments,
  useAllSubjects,
  useAllEnrollments,
  useAllTestAttempts,
  useAllAttendance,
} from "@/lib/db/hooks";
import type { Payment, Subject, Enrollment, TestAttempt, Attendance } from "@/lib/db/types";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports — EduLive Admin" },
      {
        name: "description",
        content: "Revenue trend, enrollments, attendance and test performance analytics.",
      },
      { property: "og:title", content: "Reports — EduLive Admin" },
      { property: "og:description", content: "Platform analytics for EduLive administrators." },
    ],
  }),
  component: AdminReports,
});

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function AdminReports() {
  const { data: payments = [] } = useAllPayments();
  const { data: subjects = [] } = useAllSubjects();
  const { data: enrollments = [] } = useAllEnrollments();
  const { data: testAttempts = [] } = useAllTestAttempts();
  const { data: attendanceRecords = [] } = useAllAttendance();

  const revenue = useMemo(
    () =>
      payments
        .filter((p: Payment) => p.status === "completed" || p.status === "paid")
        .reduce((s: number, p: Payment) => s + (p.amount_inr || 0), 0),
    [payments],
  );

  const avgTestScore = useMemo(() => {
    const valid = testAttempts.filter(
      (a: TestAttempt) =>
        (a.status === "graded" || a.status === "submitted") && typeof a.percentage === "number",
    );
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc: number, a: TestAttempt) => acc + (a.percentage || 0), 0);
    return Math.round(sum / valid.length);
  }, [testAttempts]);

  const attendanceRate = useMemo(() => {
    if (attendanceRecords.length === 0) return 0;
    const present = attendanceRecords.filter((a: Attendance) => a.status === "present").length;
    const late = attendanceRecords.filter((a: Attendance) => a.status === "late").length;
    return Math.round(((present + late * 0.5) / attendanceRecords.length) * 100);
  }, [attendanceRecords]);

  const revenueTrend = useMemo(() => {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const now = new Date();
    const last6 = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        month: monthNames[d.getMonth()]!,
        revenue: 0,
      };
    });

    const monthMap = new Map(last6.map((m) => [m.key, m]));

    payments
      .filter((p: Payment) => (p.status === "completed" || p.status === "paid") && p.created_at)
      .forEach((p: Payment) => {
        const d = new Date(p.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const target = monthMap.get(key);
        if (target) {
          target.revenue += Number(p.amount_inr) || 0;
        }
      });

    return last6.map(({ month, revenue: r }) => ({ month, revenue: r }));
  }, [payments]);

  const enrollmentsBySubject = useMemo(
    () =>
      subjects
        .map((s: Subject) => ({
          subject: s.name,
          students: enrollments.filter((e: Enrollment) => e.subject_id === s.id).length,
        }))
        .slice(0, 6),
    [subjects, enrollments],
  );

  const attendanceBySubject = useMemo(
    () =>
      subjects.slice(0, 5).map((s: Subject) => {
        const subRecords = attendanceRecords.filter((a: Attendance) => a.subject_id === s.id);
        const attended = subRecords.filter((a: Attendance) => a.status === "present").length;
        const missed = subRecords.filter((a: Attendance) => a.status === "absent").length;
        return {
          subject: s.name,
          attended: subRecords.length > 0 ? Math.round((attended / subRecords.length) * 100) : 0,
          missed: subRecords.length > 0 ? Math.round((missed / subRecords.length) * 100) : 0,
        };
      }),
    [subjects, attendanceRecords],
  );

  const scoreTrend = useMemo(() => {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const now = new Date();
    const last6 = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        month: monthNames[d.getMonth()]!,
        total: 0,
        count: 0,
      };
    });

    const monthMap = new Map(last6.map((m) => [m.key, m]));

    testAttempts
      .filter(
        (a: TestAttempt) =>
          (a.status === "graded" || a.status === "submitted") &&
          typeof a.percentage === "number" &&
          (a.submitted_at || a.created_at),
      )
      .forEach((a: TestAttempt) => {
        const dateStr = a.submitted_at || a.created_at;
        const d = new Date(dateStr);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const target = monthMap.get(key);
        if (target) {
          target.total += a.percentage || 0;
          target.count += 1;
        }
      });

    return last6.map(({ month, total, count }) => ({
      month,
      score: count > 0 ? Math.round(total / count) : 0,
    }));
  }, [testAttempts]);

  return (
    <div className="space-y-8">
      <PageHeader title="Reports" subtitle="Platform-wide analytics and trends" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={inr(revenue)} icon={IndianRupee} tone="success" />
        <StatCard label="Avg. test score" value={`${avgTestScore}%`} icon={Trophy} tone="warning" />
        <StatCard
          label="Attendance rate"
          value={`${attendanceRate}%`}
          icon={CalendarCheck}
          tone="accent"
        />
        <StatCard label="Subjects tracked" value={`${subjects.length}`} icon={BarChart3} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <SectionTitle title="Revenue trend" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.12}
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface p-5">
          <SectionTitle title="Enrollments by subject" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Pie
                  data={
                    enrollmentsBySubject.length > 0
                      ? enrollmentsBySubject
                      : [{ subject: "No enrollments", students: 1 }]
                  }
                  dataKey="students"
                  nameKey="subject"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {enrollmentsBySubject.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {enrollmentsBySubject.map((e, i) => (
              <span key={e.subject} className="inline-flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ background: chartColors[i % chartColors.length] }}
                />
                {e.subject} ({e.students})
              </span>
            ))}
            {enrollmentsBySubject.length === 0 ? (
              <span>No active course enrollments yet.</span>
            ) : null}
          </div>
        </section>

        <section className="surface p-5">
          <SectionTitle title="Attendance overview" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceBySubject}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="subject" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                <Tooltip />
                <Bar
                  dataKey="attended"
                  fill="var(--primary)"
                  radius={[6, 6, 0, 0]}
                  name="Attended %"
                />
                <Bar
                  dataKey="missed"
                  fill="var(--destructive)"
                  radius={[6, 6, 0, 0]}
                  name="Missed %"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface p-5">
          <SectionTitle title="Test performance" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
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
          </div>
        </section>
      </div>
    </div>
  );
}
