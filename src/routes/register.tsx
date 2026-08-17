import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authApi, authMessage } from "@/lib/auth";
import { fromDDMMYYYY, maskDOB } from "@/lib/format";
const BOARDS = ["CBSE", "ICSE", "State Board"] as const;
const STANDARDS = ["6th", "7th", "8th", "9th", "10th", "11th", "12th"] as const;
import { cn } from "@/lib/utils";
import { homeForRole } from "@/lib/session";
import { getCurrentUserWithRole } from "@/lib/route-guards";

export const Route = createFileRoute("/register")({
  beforeLoad: async () => {
    const user = await getCurrentUserWithRole();
    if (user) {
      throw redirect({
        to: homeForRole(user.role),
      });
    }
  },
  head: () => ({
    meta: [
      { title: "Create your free account — EduLive" },
      {
        name: "description",
        content:
          "Create a free EduLive student account in two steps. No payment required — explore courses and enroll only when you're ready.",
      },
      { property: "og:title", content: "Create your free account — EduLive" },
      {
        property: "og:description",
        content: "Free sign up. Browse courses for your standard and purchase whenever you want.",
      },
    ],
  }),
  component: RegisterPage,
});

const steps = ["Create account", "Complete profile", "All set"];

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    dob: "",
    parentName: "",
    parentPhone: "",
    board: "CBSE",
    standard: "10th",
  });

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const dobIso = fromDDMMYYYY(form.dob);

  const errors: Partial<Record<keyof typeof form, string>> = {};
  if (!form.name.trim()) errors.name = "Full name is required.";
  if (!form.email.trim()) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()))
    errors.email = "Enter a valid email address.";
  if (!form.phone.trim()) errors.phone = "Mobile number is required.";
  else if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(form.phone.replace(/[\s-]/g, "")))
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  if (!form.password) errors.password = "Password is required.";
  else if (form.password.length < 8) errors.password = "Use at least 8 characters.";
  else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
    errors.password = "Include at least one letter and one number.";
  if (!form.confirmPassword) errors.confirmPassword = "Please confirm your password.";
  else if (form.confirmPassword !== form.password)
    errors.confirmPassword = "Passwords do not match.";
  if (!form.dob.trim()) errors.dob = "Date of birth is required.";
  else if (!dobIso) errors.dob = "Enter a valid date as DD/MM/YYYY.";

  const stepOneValid = Object.keys(errors).length === 0;
  const err = (k: keyof typeof form) => (touched ? errors[k] : undefined);

  const continueToProfile = () => {
    setTouched(true);
    if (stepOneValid) {
      setTouched(false);
      setStep(1);
    }
  };

  const createAccount = async () => {
    setFormError(null);
    if (!stepOneValid) {
      setTouched(true);
      setStep(0);
      return;
    }
    setSubmitting(true);
    try {
      await authApi.register({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        dob: dobIso,
        board: form.board,
        standard: form.standard,
        parentName: form.parentName,
        parentPhone: form.parentPhone,
      });
      setStep(2);
      toast.success("Account created successfully");
    } catch (e) {
      setFormError(authMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            <span className="font-display text-lg font-semibold">EduLive</span>
          </Link>
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <ol className="mb-8 flex items-center gap-2">
          {steps.map((s, i) => (
            <li key={s} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors",
                  i < step
                    ? "bg-success text-success-foreground"
                    : i === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden truncate text-sm sm:block",
                  i === step ? "font-medium" : "text-muted-foreground",
                )}
              >
                {s}
              </span>
              {i < steps.length - 1 ? <span className="h-px flex-1 bg-border" /> : null}
            </li>
          ))}
        </ol>

        <div className="surface p-5 sm:p-7">
          {step === 0 ? (
            <div className="space-y-5">
              {formError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{formError}</p>
                </div>
              ) : null}
              <div className="flex items-start gap-2 rounded-xl bg-success/10 p-3.5 text-sm text-success">
                <Sparkles className="mt-0.5 size-4 shrink-0" />
                <p>Creating an account is completely free. You can purchase courses later.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" error={err("name")}>
                  <Input
                    value={form.name}
                    onChange={(e) => set("name")(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </Field>
                <Field label="Email" error={err("email")}>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email")(e.target.value)}
                    placeholder="you@example.com"
                  />
                </Field>
                <Field label="Mobile number" error={err("phone")}>
                  <Input
                    value={form.phone}
                    onChange={(e) => set("phone")(e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </Field>
                <Field label="Password" error={err("password")}>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => set("password")(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </Field>
                <Field label="Confirm password" error={err("confirmPassword")}>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(e) => set("confirmPassword")(e.target.value)}
                    placeholder="Re-enter your password"
                  />
                </Field>
                <Field label="Date of birth (DD/MM/YYYY)" error={err("dob")}>
                  <Input
                    value={form.dob}
                    inputMode="numeric"
                    placeholder="DD/MM/YYYY"
                    onChange={(e) => set("dob")(maskDOB(e.target.value))}
                  />
                </Field>
                <Field label="Board">
                  <Select value={form.board} onValueChange={set("board")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BOARDS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Standard / class">
                  <Select value={form.standard} onValueChange={set("standard")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARDS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s} Standard
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium">Complete your profile</p>
                <p className="text-xs text-muted-foreground">
                  Optional, but it helps your faculty and parents stay in the loop.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Parent / guardian name">
                  <Input
                    value={form.parentName}
                    onChange={(e) => set("parentName")(e.target.value)}
                    placeholder="Enter parent/guardian name"
                  />
                </Field>
                <Field label="Parent / guardian phone">
                  <Input
                    value={form.parentPhone}
                    onChange={(e) => set("parentPhone")(e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </Field>
              </div>
              {formError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{formError}</p>
                </div>
              ) : null}
              <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                You&rsquo;re signing up for {form.standard} Standard · {form.board}. After creating
                your account you can explore all courses available for your class and purchase only
                what you need.
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-success/15 text-success">
                <CheckCircle2 className="size-7" />
              </span>
              <div>
                <p className="text-xl font-semibold">Account created successfully!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your account has been created. Please log in to continue.
                </p>
              </div>
              <Button size="lg" onClick={() => navigate({ to: "/login" as never })}>
                Go to Login <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : null}

          {step < 2 ? (
            <div className="mt-7 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
              {step === 0 ? (
                <Button onClick={continueToProfile}>
                  Continue <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button size="lg" onClick={createAccount} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Creating account…
                    </>
                  ) : (
                    "Create free account"
                  )}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
