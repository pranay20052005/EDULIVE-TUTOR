import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, GraduationCap, KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/db/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set new password — EduLive" },
      {
        name: "description",
        content: "Set a new password for your EduLive account.",
      },
      { property: "og:title", content: "Set new password — EduLive" },
      {
        property: "og:description",
        content: "Create a new secure password for your EduLive account.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have an active recovery session
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setHasRecoverySession(true);
      } else {
        // Listen for auth state change event from recovery link
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, newSession) => {
          if (event === "PASSWORD_RECOVERY" || (newSession && event === "SIGNED_IN")) {
            setHasRecoverySession(true);
          }
        });

        // Give a short timeout for URL hash fragment token processing by Supabase
        const timer = setTimeout(() => {
          setHasRecoverySession((prev) => (prev !== null ? prev : false));
        }, 1500);

        return () => {
          subscription?.unsubscribe();
          clearTimeout(timer);
        };
      }
    };

    checkSession();
  }, []);

  const passwordError = !password
    ? "Password is required."
    : password.length < 8
      ? "Password must be at least 8 characters."
      : null;

  const confirmError = !confirmPassword
    ? "Please confirm your password."
    : password !== confirmPassword
      ? "Passwords do not match."
      : null;

  const invalid = Boolean(passwordError || confirmError);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (invalid) return;

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      toast.success("Password updated successfully!");

      // Sign out to ensure user logs in with new password
      await supabase.auth.signOut();
    } catch (err: any) {
      console.error("Password update error:", err);
      setError(err?.message || "Failed to update password. Your reset link may have expired.");
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
          {success ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-success/15 text-success">
                <CheckCircle2 className="size-6" />
              </span>
              <h1 className="text-xl font-semibold sm:text-2xl">Password reset successful</h1>
              <p className="text-sm text-muted-foreground">
                Your password has been changed. You can now sign in using your new password.
              </p>
              <Button
                className="mt-4 w-full"
                size="lg"
                onClick={() => navigate({ to: "/login", replace: true })}
              >
                Sign in now
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <KeyRound className="size-5" />
                </span>
                <div>
                  <h1 className="text-xl font-semibold sm:text-2xl">Set new password</h1>
                  <p className="text-xs text-muted-foreground">
                    Enter your new secure password below.
                  </p>
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{error}</p>
                </div>
              ) : null}

              {hasRecoverySession === false ? (
                <div
                  role="alert"
                  className="mt-5 rounded-xl bg-warning/10 p-3.5 text-sm text-warning-foreground"
                >
                  <p className="font-medium">Reset link invalid or expired</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Please request a new password reset link from the forgot password page.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                    <Link to="/forgot-password">Request new link</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={submit} noValidate className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => setTouched(true)}
                      aria-invalid={touched && Boolean(passwordError)}
                      placeholder="At least 8 characters"
                    />
                    {touched && passwordError ? (
                      <p className="text-xs text-destructive">{passwordError}</p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onBlur={() => setTouched(true)}
                      aria-invalid={touched && Boolean(confirmError)}
                      placeholder="Repeat your new password"
                    />
                    {touched && confirmError ? (
                      <p className="text-xs text-destructive">{confirmError}</p>
                    ) : null}
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Updating password…
                      </>
                    ) : (
                      "Update password"
                    )}
                  </Button>
                </form>
              )}

              <div className="mt-6 text-center">
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
                  Cancel and back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
