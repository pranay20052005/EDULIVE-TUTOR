import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, GraduationCap, Loader2, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { EmptyState, PageHeader } from "@/components/ui-kit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useAllStudents, useAllEnrollments, useAllSubjects } from "@/lib/db/hooks";
import { studentService } from "@/lib/db/services/students";
import type { Student, Enrollment, Subject } from "@/lib/db/types";

export const Route = createFileRoute("/admin/students")({
  head: () => ({
    meta: [
      { title: "Students — EduLive Admin" },
      {
        name: "description",
        content: "Search, filter and manage every enrolled student on EduLive.",
      },
      { property: "og:title", content: "Students — EduLive Admin" },
      { property: "og:description", content: "Manage student accounts and status." },
    ],
  }),
  component: AdminStudents,
});

const STANDARDS = ["8th", "9th", "10th", "11th", "12th"];
const BOARDS = ["CBSE", "ICSE", "State Board"];

function getNextStandard(current?: string): string {
  const idx = STANDARDS.indexOf(current || "10th");
  if (idx >= 0 && idx < STANDARDS.length - 1) {
    return STANDARDS[idx + 1];
  }
  return current || "10th";
}

function AdminStudents() {
  const { data: students = [] } = useAllStudents();
  const { data: enrollments = [] } = useAllEnrollments();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [standard, setStandard] = useState<string>("all");
  const [board, setBoard] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [detail, setDetail] = useState<Student | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Student | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<Student | null>(null);
  const [newStandard, setNewStandard] = useState<string>("10th");
  const [promoting, setPromoting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s: Student) => {
      const name = s.user?.name || "";
      const email = s.user?.email || "";
      const isDisabled = s.status === "disabled";
      if (q && !name.toLowerCase().includes(q) && !email.toLowerCase().includes(q)) return false;
      if (standard !== "all" && s.standard !== standard) return false;
      if (board !== "all" && s.board !== board) return false;
      if (status === "active" && isDisabled) return false;
      if (status === "disabled" && !isDisabled) return false;
      return true;
    });
  }, [students, query, standard, board, status]);

  const toggleStatus = async (s: Student) => {
    const name = s.user?.name || "Student";
    const nextStatus = s.status === "disabled" ? "active" : "disabled";
    setUpdatingStatus(true);
    try {
      await studentService.update(s.id, { status: nextStatus });
      await queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      await queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(nextStatus === "disabled" ? `${name} disabled` : `${name} activated`);
      if (detail && detail.id === s.id) {
        setDetail({ ...detail, status: nextStatus });
      }
    } catch (err: any) {
      console.error("Error updating student status:", err);
      toast.error(err.message || "Failed to update student status");
    } finally {
      setUpdatingStatus(false);
      setConfirmTarget(null);
    }
  };

  const getStudentEnrollments = (studentId: string) => {
    return enrollments.filter((e: Enrollment) => e.student_id === studentId);
  };

  const openPromoteModal = (s: Student) => {
    setPromoteTarget(s);
    setNewStandard(getNextStandard(s.standard));
  };

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteTarget) return;
    setPromoting(true);
    try {
      await studentService.update(promoteTarget.id, { standard: newStandard });
      await queryClient.invalidateQueries({ queryKey: ["admin-students"] });
      toast.success(`${promoteTarget.user?.name || "Student"} standard updated to ${newStandard}!`);
      if (detail && detail.id === promoteTarget.id) {
        setDetail({ ...detail, standard: newStandard });
      }
      setPromoteTarget(null);
    } catch (err: any) {
      console.error("Promotion error:", err);
      toast.error(err.message || "Failed to update standard.");
    } finally {
      setPromoting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        subtitle={`${students.length} student${students.length === 1 ? "" : "s"} registered across all standards`}
      />

      <div className="surface flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 p-4">
        <div className="relative w-full sm:w-auto sm:flex-1 min-w-0">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className="pl-9"
            aria-label="Search students"
          />
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Select value={standard} onValueChange={setStandard}>
            <SelectTrigger className="w-full sm:w-[130px]" aria-label="Filter by standard">
              <SelectValue placeholder="Standard" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All standards</SelectItem>
              {STANDARDS.map((s: string) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={board} onValueChange={setBoard}>
            <SelectTrigger className="w-full sm:w-[170px]" aria-label="Filter by board">
              <SelectValue placeholder="Board" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All boards</SelectItem>
              {BOARDS.map((b: string) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger
              className="col-span-2 sm:col-span-1 w-full sm:w-[130px]"
              aria-label="Filter by status"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students found"
          body="Try adjusting your search or filters."
        />
      ) : (
        <div className="surface overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead>Board</TableHead>
                <TableHead>Enrollments</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s: Student) => {
                const isDisabled = s.status === "disabled";
                const studentEnrollments = getStudentEnrollments(s.id);
                const name = s.user?.name || "Student";
                const email = s.user?.email || "";
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <button
                        className="text-left font-medium hover:underline"
                        onClick={() => setDetail(s)}
                      >
                        {name}
                      </button>
                      <p className="text-xs text-muted-foreground">{email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{s.standard || "10th"}</Badge>
                    </TableCell>
                    <TableCell>{s.board || "CBSE"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{studentEnrollments.length} subjects</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isDisabled ? "outline" : "secondary"}>
                        {isDisabled ? "Disabled" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPromoteModal(s)}
                          title="Promote Student / Change Class"
                        >
                          <ArrowUpRight className="size-3.5" /> Change Class
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDetail(s)}>
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant={isDisabled ? "outline" : "destructive"}
                          onClick={() => setConfirmTarget(s)}
                        >
                          {isDisabled ? "Enable" : "Disable"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Student Details Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle>{detail.user?.name || "Student Profile"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <InfoRow label="Email" value={detail.user?.email || "—"} />
                <InfoRow label="Phone" value={detail.user?.phone || "—"} />
                <InfoRow label="Board" value={detail.board || "CBSE"} />
                <InfoRow label="Standard" value={detail.standard || "10th"} />
                <InfoRow label="Parent" value={detail.parent_name || "—"} />
                <InfoRow label="Parent phone" value={detail.parent_phone || "—"} />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Enrolled subjects</p>
                <div className="flex flex-wrap gap-1.5">
                  {getStudentEnrollments(detail.id).length ? (
                    getStudentEnrollments(detail.id).map((e: Enrollment) => (
                      <Badge key={e.id} variant="secondary">
                        {e.subject?.name || e.subject_id}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No subjects yet.</span>
                  )}
                </div>
              </div>
              <DialogFooter className="mt-4 flex sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    const current = detail;
                    setDetail(null);
                    openPromoteModal(current);
                  }}
                >
                  <GraduationCap className="size-4" /> Promote / Change Class
                </Button>
                <Button variant="secondary" onClick={() => setDetail(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Class Promotion Modal */}
      <Dialog open={!!promoteTarget} onOpenChange={(o) => !o && setPromoteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote Student / Change Class</DialogTitle>
          </DialogHeader>
          {promoteTarget ? (
            <form onSubmit={handlePromoteSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Update the academic class/standard for{" "}
                <span className="font-semibold text-foreground">
                  {promoteTarget.user?.name || "this student"}
                </span>
                . Their courses catalogue and recommendations will update automatically while
                preserving all existing enrollments and records.
              </p>

              <div className="rounded-xl bg-muted/50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current Standard:</span>
                  <Badge variant="outline" className="font-semibold">
                    {promoteTarget.standard || "10th"} Standard
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="target-standard">Select New Standard</Label>
                <Select value={newStandard} onValueChange={setNewStandard}>
                  <SelectTrigger id="target-standard">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STANDARDS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s} Standard{" "}
                        {s === getNextStandard(promoteTarget.standard) ? "(Next class)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPromoteTarget(null)}
                  disabled={promoting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={promoting}>
                  {promoting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Updating…
                    </>
                  ) : (
                    "Save & Promote"
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Disable/Enable Confirmation Modal */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget && confirmTarget.status === "disabled" ? "Enable" : "Disable"}{" "}
              {confirmTarget?.user?.name || "Student"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget && confirmTarget.status === "disabled"
                ? "This will restore the student's access to their enrolled courses."
                : "This will immediately revoke the student's access to live classes and content."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmTarget && toggleStatus(confirmTarget)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const isEmail = value.includes("@");
  const isPhone = /^[+\d][\d\s-]{6,}$/.test(value.trim());

  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {isEmail ? (
        <a
          href={`mailto:${value}`}
          className="font-medium text-primary hover:underline block truncate"
        >
          {value}
        </a>
      ) : isPhone ? (
        <a
          href={`tel:${value.replace(/[\s-]/g, "")}`}
          className="font-medium text-primary hover:underline block truncate"
        >
          {value}
        </a>
      ) : (
        <p className="font-medium truncate">{value}</p>
      )}
    </div>
  );
}
