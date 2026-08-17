import {
  createFileRoute,
  Link,
  useNavigate,
  useRouterState,
  redirect,
} from "@tanstack/react-router";
import { AlertCircle, GraduationCap, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi, authMessage, AuthError } from "@/lib/auth";
import { homeForRole, useSession } from "@/lib/session";
import { getCurrentUserWithRole } from "@/lib/route-guards";

export const Route = createFileRoute("/login")({
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
      { title: "Sign in — EduLive" },
      {
        name: "description",
        content: "Sign in to your EduLive student, faculty or admin account.",
      },
      { property: "og:title", content: "Sign in — EduLive" },
      { property: "og:description", content: "Access your live classes, notes and tests." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, status, session } = useSession();
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as {
    redirect?: string;
    expired?: string | boolean;
  };
  const redirectPath = search.redirect;
  const expired = search.expired === true || search.expired === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    expired ? "Your session expired. Please sign in again." : null,
  );

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated" && session) {
      const target =
        redirectPath && redirectPath.startsWith("/") ? redirectPath : homeForRole(session.role);
      navigate({ to: target as never, replace: true });
    }
  }, [status, session, redirectPath, navigate]);

  const emailError = !email.trim()
    ? "Email is required."
    : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
      ? "Enter a valid email address."
      : null;
  const passwordError = !password ? "Password is required." : null;
  const invalid = Boolean(emailError || passwordError);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (invalid) return;
    setLoading(true);
    try {
      const account = await authApi.login(email, password);
      signIn(account);
      toast.success(`Welcome back, ${account.name.split(" ")[0]}`);
      const target =
        redirectPath && redirectPath.startsWith("/") ? redirectPath : homeForRole(account.role);
      navigate({ to: target as never, replace: true });
    } catch (err) {
      setError(
        err instanceof AuthError && err.code === "invalid_credentials"
          ? "Invalid email or password."
          : authMessage(err),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hero-gradient relative hidden flex-col justify-between p-10 text-white lg:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-white/15">
            <GraduationCap className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">EduLive</span>
        </Link>
        <div className="max-w-md">
          <h2 className="font-display text-3xl leading-tight font-semibold">
            Live classes that feel like the front bench.
          </h2>
          <p className="mt-3 text-sm text-white/75">
            Attend interactive live sessions, revisit recordings, download notes, submit assignments
            and track every mark — from any device.
          </p>
        </div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} EduLive Academy</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold sm:text-3xl">Sign in to EduLive</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the email and password you registered with.
          </p>

          {error ? (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}

          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && Boolean(passwordError)}
              />
              {touched && passwordError ? (
                <p className="text-xs text-destructive">{passwordError}</p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to EduLive?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
