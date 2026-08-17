import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Award, BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
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

import { EmptyState, PageHeader, SectionTitle, StatCard } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { enrollmentService, attendanceService, testService } from "@/lib/db";
import { useTeacherSubjects } from "@/lib/db/hooks";
import { toDDMMYYYY } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Attendance, FacultyTest } from "@/lib/db/types";

export const Route = createFileRoute("/teacher/performance")({
  head: () => ({
    meta: [
      { title: "Performance — EduLive Faculty" },
      {
        name: "description",
        content: "Class averages, score distribution, attendance trends and top performers.",
      },
      { property: "og:title", content: "Performance — EduLive Faculty" },
      { property: "og:description", content: "Analytics for your subjects and students." },
    ],
  }),
  component: TeacherPerformance,
});

const DISTRIBUTION_BUCKETS = ["0-40%", "40-60%", "60-75%", "75-90%", "90-100%"];
const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function TeacherPerformance() {
  const { teacher } = useSession();
  const { data: mySubjects = [] } = useTeacherSubjects(teacher.id);
  const mySubjectIds = useMemo(() => mySubjects.map((s) => s.id), [mySubjects]);

  const { data: roster = [] } = useQuery({
    queryKey: ["teacher-roster", mySubjectIds],
    queryFn: async () => {
      if (!mySubjectIds.length) return [];
      const rows = await Promise.all(
        mySubjectIds.map((id) => enrollmentService.getSubjectEnrollments(id)),
      );
      const byStudent = new Map<
        string,
        { id: string; name: string; standard: string; subjectIds: string[] }
      >();
      for (const subjectRows of rows) {
        for (const row of subjectRows) {
          const student = row.student;
          if (!student || !student.user) continue;
          const current = byStudent.get(student.id) ?? {
            id: student.id,
            name: student.user.name,
            standard: student.standard ?? "",
            subjectIds: [],
          };
          current.subjectIds.push(row.subject_id);
          byStudent.set(student.id, current);
        }
      }
      return [...byStudent.values()];
    },
    enabled: mySubjectIds.length > 0,
  });

  const { data: attendanceHistory = [] } = useQuery({
    queryKey: ["teacher-attendance", teacher.id],
    queryFn: () => (teacher.id ? attendanceService.listByTeacher(teacher.id) : Promise.resolve([])),
    enabled: !!teacher.id,
  });

  const { data: tests = [] } = useQuery({
    queryKey: ["teacher-tests", teacher.id],
    queryFn: () => (teacher.id ? testService.listByTeacher(teacher.id) : Promise.resolve([])),
    enabled: !!teacher.id,
  });

  const classAverageBySubject = useMemo(
    () =>
      mySubjects.map((s) => ({
        subject: s.name,
        average: 0,
      })),
    [mySubjects],
  );

  const distribution = useMemo(
    () => [
      { label: "0-40%", count: 0 },
      { label: "40-60%", count: 0 },
      { label: "60-75%", count: 0 },
      { label: "75-90%", count: 0 },
      { label: "90-100%", count: 0 },
    ],
    [],
  );

  const attendanceTrend = useMemo(() => {
    const byDate = new Map<string, { total: number; present: number }>();
    attendanceHistory.forEach((a: Attendance) => {
      const d = (a.marked_at || a.created_at).slice(0, 10);
      const cur = byDate.get(d) || { total: 0, present: 0 };
      cur.total += 1;
      if (a.status === "present" || a.status === "late") cur.present += 1;
      byDate.set(d, cur);
    });

    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, stat]) => ({
        date: toDDMMYYYY(d),
        pct: stat.total ? Math.round((stat.present / stat.total) * 100) : 0,
      }));
  }, [attendanceHistory]);

  const studentScores = useMemo(() => roster.map((s) => ({ student: s, avg: 0 })), [roster]);

  const topPerformers = [...studentScores].sort((a, b) => b.avg - a.avg).slice(0, 5);
  const bottomPerformers = [...studentScores].sort((a, b) => a.avg - b.avg).slice(0, 5);

  const overallAvg = classAverageBySubject.length
    ? Math.round(
        classAverageBySubject.reduce((s, c) => s + c.average, 0) / classAverageBySubject.length,
      )
    : 0;
  const overallAttendance = attendanceTrend.length
    ? Math.round(attendanceTrend.reduce((s, a) => s + a.pct, 0) / attendanceTrend.length)
    : 0;

  return (
    <div className="space-y-8">
      <PageHeader title="Performance" subtitle="Analytics across your subjects and students" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Class average" value={`${overallAvg}%`} icon={BarChart3} />
        <StatCard
          label="Attendance average"
          value={`${overallAttendance}%`}
          hint={attendanceTrend.length ? `${attendanceTrend.length} sessions` : "Active sessions"}
          icon={TrendingUp}
          tone="accent"
        />
        <StatCard
          label="Top performer"
          value={topPerformers[0]?.student.name.split(" ")[0] ?? "—"}
          hint={topPerformers[0] ? `${topPerformers[0].avg}% average` : "No data yet"}
          icon={Award}
          tone="success"
        />
        <StatCard
          label="Needs attention"
          value={bottomPerformers[0]?.student.name.split(" ")[0] ?? "—"}
          hint={bottomPerformers[0] ? `${bottomPerformers[0].avg}% average` : "No data yet"}
          icon={TrendingDown}
          tone="warning"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5">
          <SectionTitle title="Class average per subject" />
          {classAverageBySubject.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No data yet"
              body="Results will appear once tests are taken."
            />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classAverageBySubject}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="subject" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="average" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="surface p-5">
          <SectionTitle title="Score distribution" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribution}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={50}
                  outerRadius={90}
                >
                  {distribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
            {distribution.map((d, i) => (
              <span key={d.label} className="inline-flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                {d.label}
              </span>
            ))}
          </div>
        </section>
      </div>

      <section className="surface p-5">
        <SectionTitle title="Attendance trend" />
        {attendanceTrend.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No attendance recorded"
            body="Save attendance sessions to see the trend here."
          />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <SectionTitle title="Top performers" />
          <div className="surface divide-y divide-border">
            {topPerformers.map((t) => (
              <div key={t.student.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.student.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ID {t.student.id.slice(0, 8)} · {t.student.standard || "10th"}
                  </p>
                </div>
                <Badge className="shrink-0 bg-success/15 text-success" variant="outline">
                  {t.avg}%
                </Badge>
              </div>
            ))}
          </div>
        </section>
        <section>
          <SectionTitle title="Needs attention" />
          <div className="surface divide-y divide-border">
            {bottomPerformers.map((t) => (
              <div key={t.student.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.student.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ID {t.student.id.slice(0, 8)} · {t.student.standard || "10th"}
                  </p>
                </div>
                <Badge className="shrink-0 bg-destructive/15 text-destructive" variant="outline">
                  {t.avg}%
                </Badge>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
