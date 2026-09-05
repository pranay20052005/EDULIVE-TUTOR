import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarCheck,
  GraduationCap,
  IndianRupee,
  Radio,
  Trophy,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useQuery } from "@tanstack/react-query";

import { PageHeader, SectionTitle, StatCard } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { dateTimeOf, inr, toDDMMYYYY } from "@/lib/format";
import { scheduledClassService } from "@/lib/db";
import {
  useAllStudents,
  useAllTeachers,
  useAllPayments,
  useAllSubjects,
  useAllEnrollments,
  useAllTestAttempts,
  useAllAttendance,
} from "@/lib/db/hooks";
import type { Attendance, Enrollment, Payment, ScheduledClass, TestAttempt } from "@/lib/db/types";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — EduLive" },
      {
        name: "description",
        content: "Platform overview: enrollments, faculty, live classes and revenue.",
      },
      { property: "og:title", content: "Admin dashboard — EduLive" },
      { property: "og:description", content: "Monitor enrollments, classes and revenue." },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const { data: students = [] } = useAllStudents();
  const { data: teachers = [] } = useAllTeachers();
  const { data: payments = [] } = useAllPayments();
  const { data: subjects = [] } = useAllSubjects();
  const { data: enrollments = [] } = useAllEnrollments();
  const { data: testAttempts = [] } = useAllTestAttempts();
  const { data: attendanceRecords = [] } = useAllAttendance();

  const { data: classes = [] } = useQuery({
    queryKey: ["admin-scheduled-classes"],
    queryFn: () => scheduledClassService.listAll(),
  });

  const revenue = useMemo(
    () =>
      payments
        .filter((p: Payment) => p?.status === "completed" || p?.status === "paid")
        .reduce((s: number, p: Payment) => s + (p?.amount_inr ?? 0), 0),
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
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const past6Months = Array.from({ length: 6 }, (_, idx) => {
      const d = new Date(currentYear, currentMonth - 5 + idx, 1);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: monthNames[d.getMonth()],
        revenue: 0,
      };
    });

    const monthMap = new Map(past6Months.map((m) => [m.key, m]));
    for (const p of payments) {
      if ((p?.status === "completed" || p?.status === "paid") && p?.created_at) {
        const createdKey = p.created_at.slice(0, 7);
        const item = monthMap.get(createdKey);
        if (item) {
          item.revenue += p.amount_inr || 0;
        }
      }
    }
    return past6Months.map((m) => ({ month: m.label, amount: m.revenue }));
  }, [payments]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const classesToday = classes.filter(
    (c: ScheduledClass) => c.starts_at?.slice(0, 10) === todayStr,
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Platform overview" subtitle="Live operations across EduLive" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total students" value={`${students.length}`} icon={Users} tone="accent" />
        <StatCard
          label="Faculty members"
          value={`${teachers.length}`}
          icon={GraduationCap}
          tone="warning"
        />
        <StatCard label="Total revenue" value={inr(revenue)} icon={IndianRupee} tone="success" />
        <StatCard label="Active courses" value={`${subjects.length}`} icon={BookOpen} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Avg. test score" value={`${avgTestScore}%`} icon={Trophy} tone="accent" />
        <StatCard
          label="Attendance rate"
          value={`${attendanceRate}%`}
          icon={CalendarCheck}
          tone="success"
        />
        <StatCard
          label="Classes today"
          value={`${classesToday.length}`}
          icon={Radio}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle title="Live revenue trend (2026)" />
          <div className="surface p-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip />
                <Bar dataKey="amount" fill="var(--color-accent, #3b82f6)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <SectionTitle title="Recent enrollments" />
          <div className="surface divide-y divide-border p-0">
            {enrollments.slice(0, 5).map((e: Enrollment) => (
              <div key={e.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="font-medium">{e.student?.user?.name || "Student"}</p>
                  <p className="text-xs text-muted-foreground">{e.subject?.name || "Subject"}</p>
                </div>
                <div className="text-right">
                  <Badge variant={e.status === "active" ? "secondary" : "outline"}>
                    {e.status}
                  </Badge>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {toDDMMYYYY((e.enrolled_at || e.created_at).slice(0, 10))}
                  </p>
                </div>
              </div>
            ))}
            {enrollments.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">No recent enrollments</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle title="Recent transactions" />
          <div className="surface divide-y divide-border p-0">
            {payments.slice(0, 5).map((p: Payment) => (
              <div key={p.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="font-medium">{p.student?.user?.name || "Student"}</p>
                  <p className="text-xs text-muted-foreground">{p.subject?.name || "Course"}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{inr(p.amount_inr)}</p>
                  <Badge
                    variant={
                      p.status === "completed" || p.status === "paid" ? "secondary" : "outline"
                    }
                    className="capitalize"
                  >
                    {p.status}
                  </Badge>
                </div>
              </div>
            ))}
            {payments.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">No recent transactions</p>
            ) : null}
          </div>
        </section>

        <section>
          <SectionTitle title="Class monitor" />
          <div className="surface divide-y divide-border p-0">
            {classes.slice(0, 5).map((c: ScheduledClass) => (
              <div key={c.id} className="flex items-center justify-between p-4 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.subject?.name || "Subject"} · {c.teacher?.user?.name || "Faculty"} ·{" "}
                    {dateTimeOf(c.starts_at)}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">
                  {c.status}
                </Badge>
              </div>
            ))}
            {classes.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">No classes scheduled yet</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
