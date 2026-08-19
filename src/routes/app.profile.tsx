import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Compass, CreditCard, Receipt } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, SectionTitle } from "@/components/ui-kit";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fromDDMMYYYY, initials, inr, maskDOB, toDDMMYYYY } from "@/lib/format";
import { useStudentEnrollments, useStudentPayments } from "@/lib/db/hooks";
import { studentService, userService } from "@/lib/db";
import { supabase } from "@/lib/db/client";
import { useSession } from "@/lib/session";
import type { Payment } from "@/lib/db/types";

export const Route = createFileRoute("/app/profile")({
  head: () => ({
    meta: [
      { title: "My profile — EduLive" },
      {
        name: "description",
        content:
          "Your EduLive student profile, account settings, enrolled subjects and payment history.",
      },
      { property: "og:title", content: "My profile — EduLive" },
      { property: "og:description", content: "Manage your student profile and payment history." },
    ],
  }),
  component: ProfilePage,
});

const paymentStatusTone = (status: string) => {
  switch (status) {
    case "paid":
    case "completed":
      return "secondary";
    case "pending":
      return "outline";
    case "failed":
    case "cancelled":
      return "destructive";
    case "refunded":
      return "secondary";
    default:
      return "outline";
  }
};

function ProfilePage() {
  const { session, student, updateStudent } = useSession();
  const { data: enrollments = [] } = useStudentEnrollments(student?.id);
  const { data: payments = [], isLoading: paymentsLoading } = useStudentPayments(student?.id);

  const [form, setForm] = useState({
    name: student.name,
    phone: student.phone,
    parentName: student.parentName ?? "",
    parentPhone: student.parentPhone ?? "",
  });
  const [dob, setDob] = useState(toDDMMYYYY(student.dob));
  const [savingProfile, setSavingProfile] = useState(false);
  const [prefs, setPrefs] = useState({ classes: true, results: true, offers: false });

  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});

  const dobValid = dob === "" || fromDDMMYYYY(dob) !== null;

  const saveProfile = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!dobValid) {
      toast.error("Enter a valid Date of Birth (DD/MM/YYYY).");
      return;
    }

    setSavingProfile(true);
    try {
      if (student.id) {
        await studentService.update(student.id, {
          dob: fromDDMMYYYY(dob) || undefined,
          parent_name: form.parentName.trim() || undefined,
          parent_phone: form.parentPhone.trim() || undefined,
        });
      }

      const userUid = session?.userId || session?.id || student?.userId;
      if (userUid) {
        await userService.updateProfile(userUid, {
          name: form.name.trim(),
          phone: form.phone.trim(),
        });
      }

      updateStudent({
        name: form.name.trim(),
        phone: form.phone.trim(),
        parentName: form.parentName.trim(),
        parentPhone: form.parentPhone.trim(),
        dob: fromDDMMYYYY(dob) || student.dob,
      });

      toast.success("Profile updated successfully");
    } catch (err: any) {
      console.error("Profile save error:", err);
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const validatePwd = () => {
    const next: Record<string, string> = {};
    if (pwd.next.length < 8) next["next"] = "New password must be at least 8 characters.";
    if (pwd.confirm !== pwd.next || !pwd.confirm) next["confirm"] = "Passwords do not match.";
    setPwdErrors(next);
    return Object.keys(next).length === 0;
  };

  const changePassword = async () => {
    if (!validatePwd()) {
      toast.error("Please fix highlighted password fields");
      return;
    }

    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd.next });
      if (error) throw error;
      toast.success("Password updated successfully");
      setPwd({ current: "", next: "", confirm: "" });
      setPwdErrors({});
    } catch (err: any) {
      console.error("Password update error:", err);
      toast.error(err.message || "Failed to update password");
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My profile" subtitle="Keep your details and account up to date" />

      <div className="surface flex items-center gap-4 bg-gradient-to-br from-primary/5 to-transparent p-5">
        <Avatar className="size-16">
          <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
            {initials(student.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{student.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            Student · {student.standard || "10th"} Standard · {student.board || "CBSE"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Date of birth: {toDDMMYYYY(student.dob) || "—"}
          </p>
        </div>
      </div>

      {/* Enrolled Subjects */}
      <section className="surface p-5">
        <SectionTitle title="Enrolled subjects" action="Explore courses" to="/app/courses" />
        {enrollments.length ? (
          <div className="flex flex-wrap gap-2">
            {enrollments.map((enrollment: any) => (
              <Badge key={enrollment.id} variant="secondary" className="gap-1.5 py-1 text-xs">
                <BookOpen className="size-3" />
                {enrollment.subject?.name ?? "Subject"}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            You haven&rsquo;t enrolled in any course yet.
            <Button asChild size="sm" variant="outline">
              <Link to="/app/courses">
                <Compass className="size-4" /> Explore courses
              </Link>
            </Button>
          </div>
        )}
      </section>

      {/* Payment History Section */}
      <section id="payment-history" className="surface scroll-mt-24 p-5">
        <SectionTitle title="Payment history" />
        {payments.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {paymentsLoading ? "Loading payment records…" : "No payment history yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p: Payment) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.subject?.name || "Course Enrollment"}
                    </TableCell>
                    <TableCell>{inr(p.amount_inr)}</TableCell>
                    <TableCell className="uppercase text-xs">{p.payment_method || "UPI"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.provider_payment_id || p.provider_order_id || p.id.substring(0, 8)}
                    </TableCell>
                    <TableCell>{toDDMMYYYY(p.created_at.slice(0, 10))}</TableCell>
                    <TableCell>
                      <Badge variant={paymentStatusTone(p.status)} className="capitalize">
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Edit Profile */}
      <section id="edit-profile" className="surface scroll-mt-24 p-5">
        <SectionTitle title="Edit profile" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={student.email} disabled className="bg-muted text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label>Mobile</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Date of birth (DD/MM/YYYY)</Label>
            <Input
              value={dob}
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              onChange={(e) => {
                const masked = maskDOB(e.target.value);
                setDob(masked);
              }}
            />
            {!dobValid ? (
              <p className="text-xs text-destructive">Enter a valid date as DD/MM/YYYY.</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Parent / guardian</Label>
            <Input
              value={form.parentName}
              onChange={(e) => setForm((p) => ({ ...p, parentName: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Parent phone</Label>
            <Input
              value={form.parentPhone}
              onChange={(e) => setForm((p) => ({ ...p, parentPhone: e.target.value }))}
            />
          </div>
        </div>
        <Button className="mt-5" disabled={savingProfile} onClick={saveProfile}>
          {savingProfile ? "Saving…" : "Save changes"}
        </Button>
      </section>

      {/* Account Settings */}
      <section id="account-settings" className="surface scroll-mt-24 p-5">
        <SectionTitle title="Account settings" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Detail label="Board" value={student.board || "CBSE"} />
          <Detail
            label="Standard"
            value={student.standard ? `${student.standard} Standard` : "10th"}
          />
          <Detail label="Student ID" value={student.id.toUpperCase()} />
          <Detail label="Enrolled courses" value={String(enrollments.length)} />
        </div>
      </section>

      {/* Notification Settings */}
      <section id="notification-settings" className="surface scroll-mt-24 p-5">
        <SectionTitle title="Notification settings" />
        <div className="divide-y divide-border">
          {(
            [
              ["classes", "Live class reminders", "Get notified 15 minutes before each class"],
              ["results", "Results & assignments", "Score updates and submission deadlines"],
              ["offers", "Offers & new courses", "Occasional updates about new batches"],
            ] as const
          ).map(([key, title, body]) => (
            <div key={key} className="flex items-center justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{body}</p>
              </div>
              <Switch
                checked={prefs[key]}
                onCheckedChange={(v) => {
                  setPrefs((p) => ({ ...p, [key]: v }));
                  toast.success("Notification preference saved");
                }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Change Password */}
      <section id="change-password" className="surface scroll-mt-24 p-5">
        <SectionTitle title="Change password" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Current password</Label>
            <Input
              type="password"
              value={pwd.current}
              onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input
              type="password"
              value={pwd.next}
              onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))}
              placeholder="At least 8 characters"
            />
            {pwdErrors["next"] ? (
              <p className="text-xs text-destructive">{pwdErrors["next"]}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Confirm new password</Label>
            <Input
              type="password"
              value={pwd.confirm}
              onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
              placeholder="Repeat new password"
            />
            {pwdErrors["confirm"] ? (
              <p className="text-xs text-destructive">{pwdErrors["confirm"]}</p>
            ) : null}
          </div>
        </div>
        <Button className="mt-5" variant="outline" disabled={savingPwd} onClick={changePassword}>
          {savingPwd ? "Updating…" : "Update password"}
        </Button>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
    </div>
  );
}
