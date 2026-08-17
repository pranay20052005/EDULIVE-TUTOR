import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, GraduationCap, Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi, authMessage } from "@/lib/auth";
import { homeForRole } from "@/lib/session";
import { getCurrentUserWithRole } from "@/lib/route-guards";

export const Route = createFileRoute("/forgot-password")({
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
      { title: "Reset your password — EduLive" },
      {
        name: "description",
        content: "Request a password reset link for your EduLive account.",
      },
      { property: "og:title", content: "Reset your password — EduLive" },
      { property: "og:description", content: "We'll email you a secure reset link." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailError = !email.trim()
    ? "Email is required."
    : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
      ? "Enter a valid email address."
      : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (emailError) return;
    setLoading(true);
    try {
      await authApi.resetPassword(email);
      setSent(true);
      toast.success("Reset link sent! Check your email.");
    } catch (err) {
      // Don't reveal if email exists for security
      setSent(true);
      toast.success("If an account exists, you'll receive a reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">EduLive</span>
        </Link>

        <div className="surface p-6 sm:p-7">
          {sent ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-success/15 text-success">
                <MailCheck className="size-6" />
              </span>
              <p className="text-lg font-semibold">Check your inbox</p>
              <p className="text-sm text-muted-foreground">
                If an account exists for {email}, we&rsquo;ve sent a password reset link. The link
                expires in 30 minutes.
              </p>
              <Button asChild className="mt-2 w-full" size="lg">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold sm:text-2xl">Forgot your password?</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your registered email and we&rsquo;ll send you a reset link.
              </p>
              <form onSubmit={submit} noValidate className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouched(true)}
                    aria-invalid={touched && Boolean(emailError)}
                    placeholder="you@example.com"
                  />
                  {touched && emailError ? (
                    <p className="text-xs text-destructive">{emailError}</p>
                  ) : null}
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Sending link…
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </form>
              <Link
                to="/login"
                className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" /> Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
