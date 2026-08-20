import { createFileRoute } from "@tanstack/react-router";
import { Clock, Layers, Pencil, Plus, Trash2, Users } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr } from "@/lib/format";
import { subjectService, batchService } from "@/lib/db";
import { useAllSubjects, useAllTeachers, useAllEnrollments, useAllBatches } from "@/lib/db/hooks";
import type { Subject, Teacher, Enrollment, Batch } from "@/lib/db/types";

const STANDARDS = ["6th", "7th", "8th", "9th", "10th", "11th", "12th"] as const;

export const Route = createFileRoute("/admin/subjects")({
  head: () => ({
    meta: [
      { title: "Subjects & Batches — EduLive Admin" },
      {
        name: "description",
        content: "Manage the EduLive subject catalogue, pricing, cohorts, and assigned faculty.",
      },
      { property: "og:title", content: "Subjects & Batches — EduLive Admin" },
      {
        property: "og:description",
        content: "Add and edit subjects and batches offered on EduLive.",
      },
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

interface BatchFormState {
  name: string;
  subjectId: string;
  standard: string;
  timing: string;
  capacity: string;
  teacherId: string;
}

function AdminSubjects() {
  const { data: subjects = [] } = useAllSubjects();
  const { data: teachers = [] } = useAllTeachers();
  const { data: enrollments = [] } = useAllEnrollments();
  const { data: batches = [] } = useAllBatches();
  const queryClient = useQueryClient();

  const emptyForm: FormState = {
    name: "",
    standard: STANDARDS[3] || "9th",
    teacherId: teachers[0]?.id || "",
    priceINR: "1499",
    durationMonths: "6",
    status: "published",
  };

  const emptyBatchForm: BatchFormState = {
    name: "",
    subjectId: subjects[0]?.id || "",
    standard: STANDARDS[3] || "9th",
    timing: "08:00 AM - 09:30 AM",
    capacity: "50",
    teacherId: teachers[0]?.id || "",
  };

  // Subject dialog states
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Batch dialog states
  const [batchOpen, setBatchOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [deleteBatchTarget, setDeleteBatchTarget] = useState<Batch | null>(null);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [batchForm, setBatchForm] = useState<BatchFormState>(emptyBatchForm);
  const [batchErrors, setBatchErrors] = useState<Record<string, string>>({});
  const [savingBatch, setSavingBatch] = useState(false);

  const enrolledCount = useMemo(
    () =>
      Object.fromEntries(
        subjects.map((s: Subject) => [
          s.id,
          enrollments.filter((e: Enrollment) => e.subject_id === s.id && e.status === "active")
            .length,
        ]),
      ),
    [subjects, enrollments],
  );

  const openAdd = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      teacherId: teachers[0]?.id || "",
    });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    setForm({
      name: s.name,
      standard: s.standard || "9th",
      teacherId: s.teacher_id || "",
      priceINR: String(s.price_inr ?? (s as any).priceINR ?? 0),
      durationMonths: String(s.duration_months || 6),
      status: (s.status as "published" | "draft") || "published",
    });
    setErrors({});
    setOpen(true);
  };

  const openAddBatch = () => {
    setEditingBatch(null);
    setBatchForm({
      name: "",
      subjectId: subjects[0]?.id || "",
      standard: subjects[0]?.standard || "9th",
      timing: "08:00 AM - 09:30 AM",
      capacity: "50",
      teacherId: teachers[0]?.id || "",
    });
    setBatchErrors({});
    setBatchOpen(true);
  };

  const openEditBatch = (b: Batch) => {
    setEditingBatch(b);
    setBatchForm({
      name: b.name,
      subjectId: b.subject_id,
      standard: b.standard,
      timing: b.timing || "08:00 AM - 09:30 AM",
      capacity: String(b.capacity || 50),
      teacherId: b.teacher_id || "",
    });
    setBatchErrors({});
    setBatchOpen(true);
  };

  const validateSubject = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next["name"] = "Subject name is required.";
    const price = Number(form.priceINR);
    if (!Number.isFinite(price) || price < 0)
      next["priceINR"] = "Enter a valid price (0 for free).";
    const duration = Number(form.durationMonths);
    if (!Number.isFinite(duration) || duration <= 0)
      next["durationMonths"] = "Enter a valid duration in months.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateBatch = () => {
    const next: Record<string, string> = {};
    if (!batchForm.name.trim()) next["name"] = "Batch name is required.";
    if (!batchForm.subjectId) next["subjectId"] = "Subject is required.";
    const cap = Number(batchForm.capacity);
    if (!Number.isFinite(cap) || cap <= 0) next["capacity"] = "Capacity must be positive.";
    setBatchErrors(next);
    return Object.keys(next).length === 0;
  };

  const saveSubject = async () => {
    if (!validateSubject()) {
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
        toast.success("Subject updated successfully");
      } else {
        await subjectService.create({
          name: form.name.trim(),
          standard: form.standard,
          teacher_id: form.teacherId || undefined,
          price_inr: Number(form.priceINR),
          duration_months: Number(form.durationMonths),
          status: form.status,
        });
        toast.success("Subject created successfully");
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

  const saveBatch = async () => {
    if (!validateBatch()) {
      toast.error("Please fix highlighted batch fields");
      return;
    }

    setSavingBatch(true);
    try {
      if (editingBatch) {
        await batchService.update(editingBatch.id, {
          name: batchForm.name.trim(),
          subject_id: batchForm.subjectId,
          standard: batchForm.standard,
          timing: batchForm.timing.trim(),
          capacity: Number(batchForm.capacity) || 50,
          teacher_id: batchForm.teacherId || undefined,
        });
        toast.success("Batch updated successfully");
      } else {
        await batchService.create({
          name: batchForm.name.trim(),
          subject_id: batchForm.subjectId,
          standard: batchForm.standard,
          timing: batchForm.timing.trim(),
          capacity: Number(batchForm.capacity) || 50,
          teacher_id: batchForm.teacherId || undefined,
        });
        toast.success("Batch created successfully");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-batches"] });
      queryClient.invalidateQueries({ queryKey: ["subject-batches"] });
      setBatchOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save batch");
    } finally {
      setSavingBatch(false);
    }
  };

  const handleDeleteSubject = async () => {
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

  const handleDeleteBatch = async () => {
    if (!deleteBatchTarget) return;
    setDeletingBatch(true);
    try {
      await batchService.delete(deleteBatchTarget.id);
      toast.success(`Batch ${deleteBatchTarget.name} deleted`);
      queryClient.invalidateQueries({ queryKey: ["admin-batches"] });
      setDeleteBatchTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete batch");
    } finally {
      setDeletingBatch(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum & Batches"
        subtitle="Manage subject catalogue, pricing, cohorts and batch allocations"
      />

      <Tabs defaultValue="subjects" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="subjects" className="gap-2">
              <Layers className="size-4" /> Subjects Catalogue ({subjects.length})
            </TabsTrigger>
            <TabsTrigger value="batches" className="gap-2">
              <Users className="size-4" /> Batches / Cohorts ({batches.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button onClick={openAdd} variant="outline" size="sm">
              <Plus className="size-4 mr-1" /> Add Subject
            </Button>
            <Button onClick={openAddBatch} size="sm">
              <Plus className="size-4 mr-1" /> Create Batch
            </Button>
          </div>
        </div>

        {/* Subjects Tab */}
        <TabsContent value="subjects" className="space-y-4">
          {subjects.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No subjects yet"
              body="Create your first subject to populate the student catalogue."
              action={<Button onClick={openAdd}>Add subject</Button>}
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
                    <TableHead>Enrolled</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((s: Subject) => {
                    const price = s.price_inr ?? (s as any).priceINR ?? 0;
                    const count = enrolledCount[s.id] ?? 0;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-semibold">{s.name}</TableCell>
                        <TableCell>{s.standard} Standard</TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.teacher?.user?.name || "Unassigned"}
                        </TableCell>
                        <TableCell>{price === 0 ? "Free" : inr(price)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{count} active</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.status === "published" ? "secondary" : "outline"}>
                            {s.status === "published" ? "Published" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(s)}
                            >
                              <Trash2 className="size-4" />
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
        </TabsContent>

        {/* Batches Tab */}
        <TabsContent value="batches" className="space-y-4">
          {batches.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No batches configured"
              body="Create batches (e.g. Morning Batch A, Evening Batch B) for cohort-based learning."
              action={<Button onClick={openAddBatch}>Create Batch</Button>}
            />
          ) : (
            <div className="surface overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Standard</TableHead>
                    <TableHead>Timing</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Faculty</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b: Batch) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-semibold">{b.name}</TableCell>
                      <TableCell>{b.subject?.name || "Subject"}</TableCell>
                      <TableCell>{b.standard} Standard</TableCell>
                      <TableCell className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3.5 text-primary" /> {b.timing || "Flexible"}
                      </TableCell>
                      <TableCell>{b.capacity} Students</TableCell>
                      <TableCell className="text-muted-foreground">
                        {b.teacher?.user?.name || "Assigned Faculty"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditBatch(b)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteBatchTarget(b)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Subject Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add new subject"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Subject name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Advanced Mathematics"
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
            <Button onClick={saveSubject} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add subject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Add/Edit Dialog */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingBatch ? `Edit ${editingBatch.name}` : "Create new batch"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Batch name</Label>
              <Input
                value={batchForm.name}
                onChange={(e) => setBatchForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. 10th Morning Batch A"
              />
              {batchErrors["name"] ? (
                <p className="text-xs text-destructive">{batchErrors["name"]}</p>
              ) : null}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Subject</Label>
              <Select
                value={batchForm.subjectId}
                onValueChange={(v) => {
                  const selectedSub = subjects.find((s) => s.id === v);
                  setBatchForm((p) => ({
                    ...p,
                    subjectId: v,
                    standard: selectedSub?.standard || p.standard,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s: Subject) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.standard} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Timing / Schedule</Label>
              <Input
                value={batchForm.timing}
                onChange={(e) => setBatchForm((p) => ({ ...p, timing: e.target.value }))}
                placeholder="e.g. 08:00 AM - 09:30 AM"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Capacity</Label>
              <Input
                inputMode="numeric"
                value={batchForm.capacity}
                onChange={(e) => setBatchForm((p) => ({ ...p, capacity: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Assigned Faculty</Label>
              <Select
                value={batchForm.teacherId}
                onValueChange={(v) => setBatchForm((p) => ({ ...p, teacherId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select faculty instructor" />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveBatch} disabled={savingBatch}>
              {savingBatch ? "Saving…" : editingBatch ? "Save changes" : "Create batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Subject Alert Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subject: {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name} ({deleteTarget?.standard} Standard)
              </span>{" "}
              from the EduLive catalogue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleDeleteSubject();
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Batch Alert Dialog */}
      <AlertDialog
        open={!!deleteBatchTarget}
        onOpenChange={(o) => !o && setDeleteBatchTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch: {deleteBatchTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this batch cohort. Existing subject enrollments will remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBatch}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleDeleteBatch();
              }}
              disabled={deletingBatch}
            >
              {deletingBatch ? "Deleting…" : "Delete Batch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
