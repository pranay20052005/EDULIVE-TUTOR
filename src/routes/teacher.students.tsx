import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, PageHeader, StatCard } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { enrollmentService, attendanceService } from "@/lib/db";
import { useTeacherSubjects } from "@/lib/db/hooks";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/teacher/students")({
  head: () => ({
    meta: [
      { title: "Students — EduLive Faculty" },
      { name: "description", content: "Roster of students across all the subjects you teach." },
      { property: "og:title", content: "Students — EduLive Faculty" },
      { property: "og:description", content: "Search, filter and review your students." },
    ],
  }),
  component: TeacherStudents,
});

function TeacherStudents() {
  const { teacher } = useSession();
  const { data: mySubjects = [] } = useTeacherSubjects(teacher.id);
  const mySubjectIds = useMemo(() => mySubjects.map((s) => s.id), [mySubjects]);

  const { data: roster = [], isLoading } = useQuery({
    queryKey: ["teacher-roster", mySubjectIds],
    queryFn: async () => {
      if (!mySubjectIds.length) return [];
      const rows = await Promise.all(
        mySubjectIds.map((id) => enrollmentService.getSubjectEnrollments(id)),
      );
      const byStudent = new Map<string, any>();
      for (const subjectRows of rows) {
        for (const row of subjectRows) {
          const student = row.student;
          if (!student || !student.user) continue;
          const current = byStudent.get(student.id) ?? {
            id: student.id,
            name: student.user.name,
            email: student.user.email,
            phone: student.user.phone ?? "",
            parentName: student.parent_name ?? "",
            parentPhone: student.parent_phone ?? "",
            board: student.board ?? "",
            standard: student.standard ?? "",
            subjectIds: [] as string[],
          };
          if (!current.subjectIds.includes(row.subject_id)) {
            current.subjectIds.push(row.subject_id);
          }
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

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  const filtered = useMemo(
    () =>
      roster
        .filter((s) => (subjectFilter === "all" ? true : s.subjectIds.includes(subjectFilter)))
        .filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase())),
    [roster, subjectFilter, search],
  );

  const getAttendancePct = (studentId: string) => {
    const studentRecords = attendanceHistory.filter((a) => a.student_id === studentId);
    if (!studentRecords.length) return null;
    const present = studentRecords.filter(
      (a) => a.status === "present" || a.status === "late",
    ).length;
    return Math.round((present / studentRecords.length) * 100);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Students" subtitle="Roster across all the subjects you teach" />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total students" value={`${roster.length}`} icon={Users} />
        <StatCard
          label="Subjects taught"
          value={`${mySubjects.length}`}
          icon={Users}
          tone="accent"
        />
        <StatCard
          label="Filtered results"
          value={`${filtered.length}`}
          icon={Users}
          tone="success"
        />
      </div>

      <div className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students by name"
            className="pl-9"
            aria-label="Search students"
          />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Filter by subject">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {mySubjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} · {s.standard || "10th"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students found"
          body="Try adjusting your search or subject filter."
        />
      ) : (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roll ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead>Attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const pct = getAttendancePct(s.id);
                return (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelected(s)}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {s.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.standard || "10th"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.subjectIds
                          .filter((id: string) => mySubjectIds.includes(id))
                          .map((id: string) => (
                            <Badge key={id} variant="secondary">
                              {mySubjects.find((subject) => subject.id === id)?.name ?? id}
                            </Badge>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell>{pct != null ? `${pct}%` : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Student ID</p>
                    <p className="font-mono text-xs font-medium">{selected.id.slice(0, 8)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Standard</p>
                    <p className="font-medium">{selected.standard || "10th"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Board</p>
                    <p className="font-medium">{selected.board || "CBSE"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="truncate font-medium">{selected.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium">{selected.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Parent</p>
                    <p className="font-medium">{selected.parentName || "—"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Subjects with you</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selected.subjectIds
                      .filter((id: string) => mySubjectIds.includes(id))
                      .map((id: string) => (
                        <Badge key={id} variant="secondary">
                          {mySubjects.find((subject) => subject.id === id)?.name ?? id}
                        </Badge>
                      ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Attendance</p>
                    <p className="font-medium">
                      {getAttendancePct(selected.id) != null
                        ? `${getAttendancePct(selected.id)}%`
                        : "No records yet"}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
