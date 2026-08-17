import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, CreditCard, Landmark, Loader2, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { subjectService, paymentService, enrollmentService, studentService } from "@/lib/db";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/db/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/checkout/$subjectId")({
  head: () => ({
    meta: [
      { title: "Checkout — EduLive" },
      { name: "description", content: "Secure checkout for your EduLive course enrollment." },
      { property: "og:title", content: "Checkout — EduLive" },
      { property: "og:description", content: "Complete your course purchase in a few taps." },
    ],
  }),
  component: CheckoutPage,
});

const METHODS = [
  { id: "UPI", label: "UPI", hint: "GPay · PhonePe · Paytm", icon: Smartphone },
  { id: "Card", label: "Card", hint: "Credit or debit card", icon: CreditCard },
  { id: "Netbanking", label: "Netbanking", hint: "All major banks", icon: Landmark },
];

function CheckoutPage() {
  const { subjectId } = Route.useParams();
  const queryClient = useQueryClient();
  const {
    data: subject,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["subject", subjectId],
    queryFn: () => subjectService.getById(subjectId),
  });

  const { enroll, isEnrolled, student } = useSession();
  const navigate = useNavigate();
  const [method, setMethod] = useState("UPI");
  const [paying, setPaying] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <p className="text-center text-muted-foreground">Loading course details...</p>
      </div>
    );
  }

  if (isError || !subject) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <p className="text-center text-destructive">Course not found</p>
      </div>
    );
  }

  const already = isEnrolled(subjectId);
  const gst = Math.round(subject.price_inr * 0.18);
  const total = subject.price_inr + gst;

  const pay = async () => {
    setPaying(true);
    try {
      // 1. Resolve student record ID
      let realStudentId = student?.id;
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      if (authSession?.user?.id) {
        const studentRow = await studentService.getByUserId(authSession.user.id);
        if (studentRow?.id) {
          realStudentId = studentRow.id;
        }
      }

      if (!realStudentId) {
        throw new Error("Student profile not found. Please log in again.");
      }

      // 2. Record payment in Supabase database
      await paymentService.create({
        student_id: realStudentId,
        subject_id: subjectId,
        amount_inr: total,
        payment_method: method.toLowerCase(),
        status: "paid",
      });

      // 3. Record enrollment in Supabase database
      const isAlreadyEnrolled = await enrollmentService.isEnrolled(realStudentId, subjectId);
      if (!isAlreadyEnrolled) {
        await enrollmentService.create({
          student_id: realStudentId,
          subject_id: subjectId,
          status: "active",
        });
      }

      // 4. Update session and invalidate caches
      enroll(subjectId);
      await queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      await queryClient.invalidateQueries({ queryKey: ["student-enrollments"] });
      await queryClient.invalidateQueries({ queryKey: ["subject-enrollments"] });
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
      await queryClient.invalidateQueries({ queryKey: ["subject", subjectId] });

      setPaying(false);
      toast.success(`Payment successful — ${subject.name} added to My Subjects`);
      navigate({ to: "/app/subjects/$subjectId", params: { subjectId } });
    } catch (err: any) {
      console.error("Payment/enrollment error:", err);
      setPaying(false);
      toast.error(err.message || "Payment failed. Please try again.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/app/courses/$subjectId" params={{ subjectId }}>
          <ArrowLeft className="size-4" /> Course details
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold sm:text-3xl">Checkout</h1>

      <section className="surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">
              {subject.standard} {subject.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {subject.teacher?.user?.name || "EduLive Faculty"} · {subject.duration_months || 6}{" "}
              months access
            </p>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {subject.description ?? "Learn this subject with expert instructors."}
            </p>
          </div>
          <p className="shrink-0 text-lg font-semibold">{inr(subject.price_inr)}</p>
        </div>
        <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Course fee</dt>
            <dd>{inr(subject.price_inr)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">GST (18%)</dt>
            <dd>{inr(gst)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <dt>Total payable</dt>
            <dd>{inr(total)}</dd>
          </div>
        </dl>
      </section>

      <section className="surface p-5">
        <h2 className="text-base font-semibold">Payment method</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                method === m.id
                  ? "border-primary bg-primary/5 shadow-[var(--shadow-lift)]"
                  : "border-border hover:border-primary/40",
              )}
            >
              <m.icon className="size-5 text-primary" />
              <span className="mt-2 block text-sm font-medium">{m.label}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{m.hint}</span>
            </button>
          ))}
        </div>

        {already ? (
          <div className="mt-5 rounded-xl bg-success/10 p-4 text-sm text-success">
            You are already enrolled in this course.
          </div>
        ) : null}

        <Button size="lg" className="mt-5 w-full" disabled={paying || already} onClick={pay}>
          {paying ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Processing payment…
            </>
          ) : already ? (
            "Already enrolled"
          ) : (
            `Pay ${inr(total)}`
          )}
        </Button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <BadgeCheck className="size-3.5 text-success" /> Secure payment · Billed to {student.name}
        </p>
      </section>
    </div>
  );
}
