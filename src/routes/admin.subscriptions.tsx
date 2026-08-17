import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, IndianRupee, TrendingUp, Users } from "lucide-react";

import { PageHeader, SectionTitle, StatCard } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toDDMMYYYY, inr } from "@/lib/format";
import { useAllPayments, useAllEnrollments, useAllSubscriptionPlans } from "@/lib/db/hooks";
import type { Payment, Enrollment, SubscriptionPlan } from "@/lib/db/types";

export const Route = createFileRoute("/admin/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions — EduLive Admin" },
      {
        name: "description",
        content: "Plans, payments and student enrollments with revenue summary.",
      },
      { property: "og:title", content: "Subscriptions — EduLive Admin" },
      { property: "og:description", content: "Track plans, payments and enrollments." },
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
  const { data: payments = [] } = useAllPayments();
  const { data: plans = [] } = useAllSubscriptionPlans();
  const { data: enrollments = [] } = useAllEnrollments();

  const revenue = payments
    .filter((p: Payment) => p?.status === "completed" || p?.status === "paid")
    .reduce((s: number, p: Payment) => s + (p?.amount_inr ?? 0), 0);

  const pending = payments
    .filter((p: Payment) => p?.status === "pending")
    .reduce((s: number, p: Payment) => s + (p?.amount_inr ?? 0), 0);

  const activeEnrollments = enrollments.filter((e: Enrollment) => e?.status === "active").length;

  return (
    <div className="space-y-8">
      <PageHeader title="Subscriptions" subtitle="Plans, payments and enrollments across EduLive" />

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

      <section>
        <SectionTitle title="Subscription Plans" />
        {plans.length === 0 ? (
          <p className="text-xs text-muted-foreground">No subscription plans available.</p>
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

      <section>
        <SectionTitle title="Payments" />
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
                    <TableCell className="uppercase">{p.payment_method || "UPI"}</TableCell>
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

      <section>
        <SectionTitle title="Enrollments" />
        {enrollments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active enrollments recorded.</p>
        ) : (
          <div className="surface overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Subject</TableHead>
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
    </div>
  );
}
