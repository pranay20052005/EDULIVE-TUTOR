import {
  createFileRoute,
  Link,
  useNavigate,
  useRouterState,
  redirect,
} from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Loader2,
  MailCheck,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { authApi, authMessage, AuthError } from "@/lib/auth";
import { getCurrentUserWithRole } from "@/lib/route-guards";
import { homeForRole } from "@/lib/session";

export const Route = createFileRoute("/verify-email")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const user = await getCurrentUserWithRole();
    if (user) {
      throw redirect({
        to: homeForRole(user.role),
      });
    }
  },
  head: () => ({
    meta: [
      { title: "Verify Your Email — EduLive" },
      {
        name: "description",
        content: "Enter your 6-digit verification code to complete EduLive registration.",
      },
      { property: "og:title", content: "Verify Your Email — EduLive" },
      { property: "og:description", content: "Confirm your email address to access EduLive." },
    ],
  }),
  component: VerifyEmailPage,
});

const RESEND_COOLDOWN_SECONDS = 60;

function VerifyEmailPage() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as {
    email?: string;
  };
  const [emailInput, setEmailInput] = useState(search.email || "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Handle countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  // Update email if query param changes
  useEffect(() => {
    if (search.email && !emailInput) {
      setEmailInput(search.email);
    }
  }, [search.email, emailInput]);

  const targetEmail = emailInput.trim();

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!targetEmail) {
      setError("Email address is required.");
      return;
    }

    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      await authApi.verifyOtp({
        email: targetEmail,
        token: otp,
        type: "signup",
      });

      setVerified(true);
      toast.success("Email verified successfully!");
    } catch (err) {
      if (err instanceof AuthError && err.code === "already_verified") {
        setVerified(true);
        toast.info("Your email is already verified. You can sign in now.");
      } else {
        setError(authMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || resending) return;
    if (!targetEmail) {
      setError("Please enter your email to resend verification code.");
      return;
    }

    setError(null);
    setResending(true);
    try {
      await authApi.resendVerificationOtp(targetEmail);
      toast.success(`New verification code sent to ${targetEmail}`);
      setCountdown(RESEND_COOLDOWN_SECONDS);
      setCanResend(false);
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setResending(false);
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
          {verified ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-success/15 text-success">
                <CheckCircle2 className="size-7" />
              </span>
              <h1 className="text-xl font-semibold sm:text-2xl">Email Verified!</h1>
              <p className="text-sm text-muted-foreground">
                Your email address ({targetEmail}) has been successfully verified. You can now sign
                in to your EduLive account.
              </p>
              <Button
                className="mt-4 w-full"
                size="lg"
                onClick={() => {
                  startTransition(() => {
                    navigate({ to: "/login", replace: true });
                  });
                }}
              >
                Go to Login <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <MailCheck className="size-5" />
                </span>
                <div>
                  <h1 className="text-xl font-semibold sm:text-2xl">Verify your email</h1>
                  <p className="text-xs text-muted-foreground">
                    Enter the 6-digit code sent to your inbox
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

              <div className="mt-5 rounded-xl bg-muted/60 p-3.5 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    Code sent to:{" "}
                    <strong className="font-semibold text-foreground">{targetEmail}</strong>
                  </span>
                </div>
              </div>

              <form onSubmit={handleVerify} noValidate className="mt-6 space-y-5">
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Label htmlFor="otp-input" className="text-xs text-muted-foreground">
                    6-digit verification code
                  </Label>
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(val) => {
                      setOtp(val);
                      setError(null);
                      if (val.length === 6 && targetEmail) {
                        // Auto verify on 6th digit
                        authApi
                          .verifyOtp({ email: targetEmail, token: val, type: "signup" })
                          .then(() => {
                            setVerified(true);
                            toast.success("Email verified successfully!");
                          })
                          .catch((err) => {
                            if (err instanceof AuthError && err.code === "already_verified") {
                              setVerified(true);
                            } else {
                              setError(authMessage(err));
                            }
                          });
                      }
                    }}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={loading || otp.length !== 6 || !targetEmail}
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" /> Verifying…
                    </>
                  ) : (
                    "Verify Email"
                  )}
                </Button>
              </form>

              <div className="mt-6 flex flex-col items-center justify-center gap-3 border-t border-border pt-5 text-center text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span>Didn&rsquo;t receive a code?</span>
                  {canResend ? (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resending}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:opacity-50"
                    >
                      {resending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3" />
                      )}
                      Resend code
                    </button>
                  ) : (
                    <span className="font-mono text-muted-foreground">
                      Resend code in {countdown}s
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <ArrowLeft className="size-3" /> Register new account
                  </Link>
                  <span>•</span>
                  <Link to="/login" className="font-medium text-primary hover:underline">
                    Back to Login
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
