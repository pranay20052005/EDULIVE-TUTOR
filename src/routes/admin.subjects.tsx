import { createFileRoute } from "@tanstack/react-router";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
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
import { inr } from "@/lib/format";
import { subjectService } from "@/lib/db";
import { useAllSubjects, useAllTeachers, useAllEnrollments } from "@/lib/db/hooks";
import type { Subject, Teacher, Enrollment } from "@/lib/db/types";

const STANDARDS = ["6th", "7th", "8th", "9th", "10th", "11th", "12th"] as const;

export const Route = createFileRoute("/admin/subjects")({
  head: () => ({
    meta: [
      { title: "Subjects — EduLive Admin" },
      {
        name: "description",
        content: "Manage the EduLive subject catalogue, pricing and assigned faculty.",
      },
      { property: "og:title", content: "Subjects — EduLive Admin" },
      { property: "og:description", content: "Add and edit subjects offered on EduLive." },
    ],
  }),
  component: AdminSubjects,
});

interface FormState {
  name: string;
  standard: string;
  teacherId: string;
  priceINR: string;
  durationMonths: string;
  status: "published" | "draft";
}

function AdminSubjects() {
  const { data: subjects = [], isLoading } = useAllSubjects();
  const { data: teachers = [] } = useAllTeachers();
  const { data: enrollments = [] } = useAllEnrollments();
  const queryClient = useQueryClient();

  const emptyForm: FormState = {
    name: "",
    standard: STANDARDS[3] || "9th",
    teacherId: teachers[0]?.id || "",
    priceINR: "1499",
    durationMonths: "6",
    status: "published",
  };

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const enrolledCount = useMemo(
    () =>
      Object.fromEntries(
        subjects.map((s: Subject) => [
          s.id,
          enrollments.filter((e: Enrollment) => e.subject_id === s.id).length,
        ]),
      ),
    [subjects, enrollments],
  );

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: "",
      standard: STANDARDS[3] || "9th",
      teacherId: teachers[0]?.id || "",
      priceINR: "1499",
      durationMonths: "6",
      status: "published",
    });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    setForm({
      name: s.name,
      standard: s.standard || "9th",
      teacherId: s.teacher_id || teachers[0]?.id || "",
      priceINR: String(s.price_inr || 1499),
      durationMonths: String(s.duration_months || 6),
      status: (s.status as "published" | "draft") || "published",
    });
    setErrors({});
    setOpen(true);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next["name"] = "Subject name is required.";
    const price = Number(form.priceINR);
    if (!Number.isFinite(price) || price <= 0)
      next["priceINR"] = "Enter a valid price greater than 0.";
    const duration = Number(form.durationMonths);
    if (!Number.isFinite(duration) || duration <= 0)
      next["durationMonths"] = "Enter a valid duration in months.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updates: any = {
          name: form.name.trim(),
          standard: form.standard,
          price_inr: Number(form.priceINR),
          duration_months: Number(form.durationMonths),
          status: form.status,
        };
        if (form.teacherId) updates.teacher_id = form.teacherId;
        await subjectService.update(editing.id, updates);
        toast.success("Subject updated");
      } else {
        await subjectService.create({
          name: form.name.trim(),
          standard: form.standard,
          teacher_id: form.teacherId || undefined,
          price_inr: Number(form.priceINR),
          duration_months: Number(form.durationMonths),
          status: form.status,
        });
        toast.success("Subject added");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-subjects"] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["subjects-published"] });
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save subject");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await subjectService.delete(deleteTarget.id);
      toast.success(`${deleteTarget.name} deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-subjects"] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["subjects-published"] });
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete subject");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subject catalogue"
        subtitle={`${subjects.length} subject${subjects.length === 1 ? "" : "s"} offered`}
        action={
          <Button onClick={openAdd}>
            <Plus className="size-4" /> Add subject
          </Button>
        }
      />

      {subjects.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No subjects yet"
          body="Add your first subject to get started."
        />
      ) : (
        <div className="surface overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((s: Subject) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{s.standard || "9th"}</Badge>
                  </TableCell>
                  <TableCell>{s.teacher?.user?.name || "Unassigned"}</TableCell>
                  <TableCell>{inr(s.price_inr || 0)}</TableCell>
                  <TableCell>{s.duration_months || 6} months</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "published" ? "secondary" : "outline"}>
                      {s.status === "published" ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{enrolledCount[s.id] ?? 0}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(s)}
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit Subject Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit subject" : "Add subject"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Subject name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Mathematics, Physics"
              />
              {errors["name"] ? <p className="text-xs text-destructive">{errors["name"]}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label>Standard</Label>
              <Select
                value={form.standard}
                onValueChange={(v) => setForm((p) => ({ ...p, standard: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STANDARDS.map((s: string) => (
                    <SelectItem key={s} value={s}>
                      {s} Standard
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Faculty</Label>
              <Select
                value={form.teacherId}
                onValueChange={(v) => setForm((p) => ({ ...p, teacherId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select faculty" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t: Teacher) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.user?.name || "Teacher"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Price (INR)</Label>
              <Input
                inputMode="numeric"
                value={form.priceINR}
                onChange={(e) => setForm((p) => ({ ...p, priceINR: e.target.value }))}
              />
              {errors["priceINR"] ? (
                <p className="text-xs text-destructive">{errors["priceINR"]}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Duration (months)</Label>
              <Input
                inputMode="numeric"
                value={form.durationMonths}
                onChange={(e) => setForm((p) => ({ ...p, durationMonths: e.target.value }))}
              />
              {errors["durationMonths"] ? (
                <p className="text-xs text-destructive">{errors["durationMonths"]}</p>
              ) : null}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v: "published" | "draft") => setForm((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Published (Visible in Explore Courses)</SelectItem>
                  <SelectItem value="draft">Draft / Inactive (Hidden from students)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add subject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Subject Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subject: {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name} ({deleteTarget?.standard} Standard)
              </span>{" "}
              from the EduLive catalogue. If this course has existing student enrollments or payment
              history, deletion will be blocked to preserve historical records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
