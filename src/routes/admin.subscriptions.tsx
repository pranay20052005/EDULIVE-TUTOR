import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, IndianRupee, Plus, TrendingUp, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { PageHeader, SectionTitle, StatCard } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toDDMMYYYY, inr } from "@/lib/format";
import {
  useAllPayments,
  useAllEnrollments,
  useAllSubscriptionPlans,
  useAdminRevenueSummary,
  useAllStudents,
  useAllSubjects,
} from "@/lib/db/hooks";
import { enrollmentService } from "@/lib/db";
import type { Payment, Enrollment, SubscriptionPlan } from "@/lib/db/types";

export const Route = createFileRoute("/admin/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions & Revenue — EduLive Admin" },
      {
        name: "description",
        content:
          "Plans, payments, manual enrollments and student course access with revenue summary.",
      },
      { property: "og:title", content: "Subscriptions & Revenue — EduLive Admin" },
      { property: "og:description", content: "Track plans, payments, revenue and enrollments." },
    ],
  }),
  component: AdminSubscriptions,
});

const planStatusTone = (active: boolean) => (active ? "secondary" : "outline");
const paymentTone = (status: string) =>
  status === "completed" || status === "paid"
    ? "secondary"
    : status === "pending"
      ? "outline"
      : "destructive";
const enrollmentTone = (status: string) =>
  status === "active" ? "secondary" : status === "expiring" ? "outline" : "destructive";

function AdminSubscriptions() {
  const queryClient = useQueryClient();
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState("all");
  const [manualEnrollOpen, setManualEnrollOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  const { data: revenueSummary } = useAdminRevenueSummary();
  const { data: payments = [] } = useAllPayments(
    paymentStatusFilter !== "all" ? { status: paymentStatusFilter } : undefined,
  );
  const { data: plans = [] } = useAllSubscriptionPlans();
  const { data: enrollments = [] } = useAllEnrollments(
    enrollmentStatusFilter !== "all" ? { status: enrollmentStatusFilter } : undefined,
  );
  const { data: students = [] } = useAllStudents();
  const { data: subjects = [] } = useAllSubjects();

  const handleManualEnroll = async () => {
    if (!selectedStudentId || !selectedSubjectId) {
      toast.error("Please select both a student and a subject");
      return;
    }

    setEnrolling(true);
    try {
      await enrollmentService.adminManualEnroll({
        student_id: selectedStudentId,
        subject_id: selectedSubjectId,
        duration_months: 6,
      });

      await queryClient.invalidateQueries({ queryKey: ["admin-enrollments"] });
      await queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Student successfully enrolled via Admin Manual Override");
      setManualEnrollOpen(false);
      setSelectedStudentId("");
      setSelectedSubjectId("");
    } catch (err: any) {
      console.error("Manual enrollment error:", err);
      toast.error(err.message || "Failed to enroll student");
    } finally {
      setEnrolling(false);
    }
  };

  const revenue = revenueSummary?.totalRevenue ?? 0;
  const pending = revenueSummary?.pendingAmount ?? 0;
  const activeEnrollments = enrollments.filter((e: Enrollment) => e?.status === "active").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Subscriptions & Revenue"
          subtitle="Real-time commercial revenue, payment reconciliation and enrollment access"
        />
        <Button onClick={() => setManualEnrollOpen(true)} className="gap-2 shrink-0">
          <Plus className="size-4" /> Manual Enrollment
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue collected"
          value={inr(revenue)}
          icon={IndianRupee}
          tone="success"
        />
        <StatCard label="Pending payments" value={inr(pending)} icon={TrendingUp} tone="warning" />
        <StatCard
          label="Active enrollments"
          value={`${activeEnrollments}`}
          icon={Users}
          tone="accent"
        />
        <StatCard label="Plans offered" value={`${plans.length}`} icon={CreditCard} />
      </div>

      {/* Subscription Plans */}
      <section>
        <SectionTitle title="Subscription Plans" />
        {plans.length === 0 ? (
          <p className="text-xs text-muted-foreground">No subscription plans configured.</p>
        ) : (
          <div className="surface overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Billing cycle</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((p: SubscriptionPlan) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="capitalize">{p.billing_cycle || "monthly"}</TableCell>
                    <TableCell>{inr(p.price_inr)}</TableCell>
                    <TableCell>{p.standard || "All"}</TableCell>
                    <TableCell>
                      <Badge variant={planStatusTone(Boolean(p.is_active ?? p.active))}>
                        {(p.is_active ?? p.active) ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Payments Table with Filter */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle title="Payments" />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Status:</Label>
            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {payments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No payments recorded.</p>
        ) : (
          <div className="surface overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
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
                      {p.student?.user?.name || "Student"}
                    </TableCell>
                    <TableCell>{p.subject?.name || "Course"}</TableCell>
                    <TableCell>{inr(p.amount_inr)}</TableCell>
                    <TableCell className="uppercase text-xs">{p.payment_method || "UPI"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.provider_payment_id || p.provider_order_id || p.id.substring(0, 8)}
                    </TableCell>
                    <TableCell>{toDDMMYYYY(p.created_at.slice(0, 10))}</TableCell>
                    <TableCell>
                      <Badge variant={paymentTone(p.status)} className="capitalize">
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

      {/* Enrollments Table with Filter */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle title="Course Enrollments" />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Status:</Label>
            <Select value={enrollmentStatusFilter} onValueChange={setEnrollmentStatusFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="All Enrollments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Enrollments</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {enrollments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active enrollments recorded.</p>
        ) : (
          <div className="surface overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e: Enrollment) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {e.student?.user?.name || "Student"}
                    </TableCell>
                    <TableCell>{e.subject?.name || "Subject"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-[11px]">
                        {e.enrollment_type === "manual_admin"
                          ? "Manual (Admin)"
                          : e.enrollment_type || "Paid"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {toDDMMYYYY((e.enrolled_at || e.created_at).slice(0, 10))}
                    </TableCell>
                    <TableCell>
                      {e.expires_at ? toDDMMYYYY(e.expires_at.slice(0, 10)) : "Ongoing"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={enrollmentTone(e.status)} className="capitalize">
                        {e.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Manual Admin Enrollment Dialog */}
      <Dialog open={manualEnrollOpen} onOpenChange={setManualEnrollOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Manual Admin Enrollment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Directly grant student access to a course with audited manual override.
            </p>
            <div className="space-y-2">
              <Label>Select Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a student…" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.user?.name || "Student"} ({s.user?.email || ""}) — {s.standard || "10th"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select Course / Subject</Label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a subject…" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((sub: any) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.standard} {sub.name} ({inr(sub.price_inr)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManualEnrollOpen(false)}>
              Cancel
            </Button>
            <Button disabled={enrolling} onClick={handleManualEnroll}>
              {enrolling ? "Enrolling…" : "Enroll Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
