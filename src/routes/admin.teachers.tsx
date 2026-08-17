import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, PageHeader } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAllTeachers, useAllSubjects, useAllEnrollments } from "@/lib/db/hooks";
import type { Teacher, Subject, Enrollment } from "@/lib/db/types";

export const Route = createFileRoute("/admin/teachers")({
  head: () => ({
    meta: [
      { title: "Faculty — EduLive Admin" },
      { name: "description", content: "Browse faculty, their subjects taught and student counts." },
      { property: "og:title", content: "Faculty — EduLive Admin" },
      { property: "og:description", content: "Manage EduLive faculty." },
    ],
  }),
  component: AdminTeachers,
});

function AdminTeachers() {
  const { data: teachers = [], isLoading } = useAllTeachers();
  const { data: subjects = [] } = useAllSubjects();
  const { data: enrollments = [] } = useAllEnrollments();

  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Teacher | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t: Teacher) => {
      const name = t.user?.name || "";
      const email = t.user?.email || "";
      const qual = t.qualification || "";
      return (
        name.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        qual.toLowerCase().includes(q)
      );
    });
  }, [teachers, query]);

  const getTeacherSubjects = (teacherId: string) => {
    return subjects.filter((s: Subject) => s.teacher_id === teacherId);
  };

  const getTeacherStudentCount = (teacherId: string) => {
    const teacherSubjectIds = subjects
      .filter((s: Subject) => s.teacher_id === teacherId)
      .map((s) => s.id);
    const uniqueStudents = new Set(
      enrollments
        .filter((e: Enrollment) => teacherSubjectIds.includes(e.subject_id))
        .map((e) => e.student_id),
    );
    return uniqueStudents.size;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Faculty" subtitle={`${teachers.length} faculty members registered`} />

      <div className="surface p-4">
        <div className="relative max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email or qualification"
            className="pl-9"
            aria-label="Search faculty"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No faculty found"
          body="Try a different search term."
        />
      ) : (
        <div className="surface overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Subjects taught</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t: Teacher) => {
                const teacherSubjects = getTeacherSubjects(t.id);
                const studentCount = getTeacherStudentCount(t.id);
                const name = t.user?.name || "Teacher";
                const email = t.user?.email || "";
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <button
                        className="text-left font-medium hover:underline"
                        onClick={() => setDetail(t)}
                      >
                        {name}
                      </button>
                      <p className="text-xs text-muted-foreground">{email}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {teacherSubjects.length ? (
                          teacherSubjects.map((s: Subject) => (
                            <Badge key={s.id} variant="outline">
                              {s.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">None assigned</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{studentCount}</TableCell>
                    <TableCell>{t.experience_years ? `${t.experience_years} yrs` : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDetail(t)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle>{detail.user?.name || "Faculty Profile"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <InfoRow label="Email" value={detail.user?.email || "—"} />
                <InfoRow label="Phone" value={detail.user?.phone || "—"} />
                <InfoRow label="Qualification" value={detail.qualification || "—"} />
                <InfoRow
                  label="Experience"
                  value={detail.experience_years ? `${detail.experience_years} years` : "—"}
                />
                <InfoRow label="Students" value={String(getTeacherStudentCount(detail.id))} />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Subjects taught</p>
                <div className="flex flex-wrap gap-1.5">
                  {getTeacherSubjects(detail.id).length ? (
                    getTeacherSubjects(detail.id).map((s: Subject) => (
                      <Badge key={s.id} variant="secondary">
                        {s.name} · {s.standard || "10th"}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No subjects assigned.</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bio</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {detail.bio || "No biography provided."}
                </p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
