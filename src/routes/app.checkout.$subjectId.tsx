import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  Landmark,
  Loader2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { subjectService, studentService } from "@/lib/db";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/db/client";
import { cn } from "@/lib/utils";
import {
  createPaymentOrderFn,
  verifyPaymentFn,
  enrollFreeCourseFn,
} from "@/lib/server/payment-functions";

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

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && (window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

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
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    loadRazorpayScript().then((loaded) => setScriptLoaded(loaded));
  }, []);

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
  const basePrice = Number(subject.price_inr) || 0;
  const isFree = basePrice === 0;
  const gst = isFree ? 0 : Math.round(basePrice * 0.18);
  const total = basePrice + gst;

  const pay = async () => {
    setPaying(true);
    try {
      // 1. Resolve student record ID
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();

      const authUserId = authSession?.user?.id;
      let resolvedStudentId = student?.id;

      if (authUserId) {
        const studentRow = await studentService.getByUserId(authUserId);
        if (studentRow?.id) {
          resolvedStudentId = studentRow.id;
        }
      }

      const lookupId = resolvedStudentId || authUserId || student?.id;
      if (!lookupId) {
        throw new Error("Student profile not found. Please log in again.");
      }

      // 2. Server-side order creation (validates price in DB to prevent price tampering)
      const order = await createPaymentOrderFn({
        data: {
          subjectId,
          studentId: lookupId,
        },
      });

      // Free course direct activation
      if (order.isFree || isFree) {
        await enrollFreeCourseFn({
          data: {
            subjectId,
            studentId: lookupId,
          },
        });
        enroll(subjectId);
        await queryClient.invalidateQueries({ queryKey: ["enrollments"] });
        await queryClient.invalidateQueries({ queryKey: ["student-enrollments"] });
        await queryClient.invalidateQueries({ queryKey: ["student-payments"] });
        await queryClient.invalidateQueries({ queryKey: ["subject", subjectId] });
        await queryClient.invalidateQueries({ queryKey: ["subjects"] });
        await queryClient.refetchQueries({ queryKey: ["enrollments"] });
        setPaying(false);
        toast.success(`Enrolled in ${subject.name} for Free!`);
        navigate({ to: "/app/subjects/$subjectId", params: { subjectId } });
        return;
      }

      // 3. Paid course gateway flow
      const hasRealGateway =
        scriptLoaded &&
        (window as any).Razorpay &&
        order.keyId &&
        !order.keyId.includes("placeholder") &&
        !order.isPendingConfig;

      if (hasRealGateway) {
        // Open live/test Razorpay modal
        const options = {
          key: order.keyId,
          amount: order.amountInPaise,
          currency: order.currency,
          name: "EduLive",
          description: `Enrollment in ${order.subjectName}`,
          order_id: order.orderId,
          handler: async function (response: any) {
            try {
              // Cryptographic server-side verification
              const verifyRes = await verifyPaymentFn({
                data: {
                  orderId: response.razorpay_order_id || order.orderId,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                  subjectId,
                  studentId: lookupId,
                  paymentMethod: method.toLowerCase(),
                },
              });

              if (verifyRes.success) {
                enroll(subjectId);
                await queryClient.invalidateQueries({ queryKey: ["enrollments"] });
                await queryClient.invalidateQueries({ queryKey: ["student-enrollments"] });
                await queryClient.invalidateQueries({ queryKey: ["student-payments"] });
                await queryClient.invalidateQueries({ queryKey: ["subject", subjectId] });
                await queryClient.invalidateQueries({ queryKey: ["subjects"] });
                await queryClient.refetchQueries({ queryKey: ["enrollments"] });
                setPaying(false);
                toast.success(`Payment verified! ${subject.name} activated.`);
                navigate({ to: "/app/subjects/$subjectId", params: { subjectId } });
              }
            } catch (vErr: any) {
              setPaying(false);
              toast.error(vErr.message || "Payment verification failed.");
            }
          },
          modal: {
            ondismiss: function () {
              setPaying(false);
              toast.info("Payment cancelled. You can try again whenever ready.");
            },
          },
          prefill: {
            name: student?.name || "",
            email: student?.email || "",
            contact: student?.phone || "",
          },
          theme: {
            color: "#6366f1",
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", function (failRes: any) {
          setPaying(false);
          toast.error(failRes.error?.description || "Payment failed at gateway.");
        });
        rzp.open();
      } else {
        // Development / Test Mode simulated payment verification
        const simulatedPaymentId = `pay_sim_${Date.now()}`;
        const simulatedSignature = `sig_test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const verifyRes = await verifyPaymentFn({
          data: {
            orderId: order.orderId,
            paymentId: simulatedPaymentId,
            signature: simulatedSignature,
            subjectId,
            studentId: lookupId,
            paymentMethod: method.toLowerCase(),
          },
        });

        if (verifyRes.success) {
          enroll(subjectId);
          await queryClient.invalidateQueries({ queryKey: ["enrollments"] });
          await queryClient.invalidateQueries({ queryKey: ["student-enrollments"] });
          await queryClient.invalidateQueries({ queryKey: ["student-payments"] });
          await queryClient.invalidateQueries({ queryKey: ["subject", subjectId] });
          await queryClient.invalidateQueries({ queryKey: ["subjects"] });
          await queryClient.refetchQueries({ queryKey: ["enrollments"] });
          setPaying(false);
          toast.success(`Payment confirmed! ${subject.name} added to My Subjects`);
          navigate({ to: "/app/subjects/$subjectId", params: { subjectId } });
        }
      }
    } catch (err: any) {
      console.error("Payment error:", err);
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

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold sm:text-3xl">Checkout</h1>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-success" /> 256-Bit Encrypted Payment
        </div>
      </div>

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
          <p className="shrink-0 text-lg font-semibold">{isFree ? "Free" : inr(basePrice)}</p>
        </div>
        <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Course fee</dt>
            <dd>{isFree ? "₹0 (Free)" : inr(basePrice)}</dd>
          </div>
          {!isFree ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">GST (18%)</dt>
              <dd>{inr(gst)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <dt>Total payable</dt>
            <dd>{isFree ? "₹0" : inr(total)}</dd>
          </div>
        </dl>
      </section>

      {!isFree ? (
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
              `Pay ${inr(total)} via Razorpay`
            )}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <BadgeCheck className="size-3.5 text-success" /> Razorpay Verified Gateway · Billed to{" "}
            {student.name}
          </p>
        </section>
      ) : (
        <section className="surface p-5">
          <h2 className="text-base font-semibold">Free Enrollment</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            No payment details required. Instant access will be activated upon confirmation.
          </p>

          {already ? (
            <div className="mt-5 rounded-xl bg-success/10 p-4 text-sm text-success">
              You are already enrolled in this course.
            </div>
          ) : null}

          <Button size="lg" className="mt-5 w-full" disabled={paying || already} onClick={pay}>
            {paying ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Activating enrollment…
              </>
            ) : already ? (
              "Already enrolled"
            ) : (
              "Confirm Free Enrollment"
            )}
          </Button>
        </section>
      )}
    </div>
  );
}
