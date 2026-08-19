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
import { authApi, authMessage, AuthError, type OAuthProvider } from "@/lib/auth";
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

function GoogleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function AppleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.87-.96.04-2.12.64-2.79 1.42-.59.68-1.11 1.74-1.03 2.78 1.07.08 2.18-.58 2.81-1.33z" />
    </svg>
  );
}

function LoginPage() {
  const { signIn, status, session } = useSession();
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as {
    redirect?: string;
    expired?: string | boolean;
    error?: string;
  };
  const redirectPath = search.redirect;
  const expired = search.expired === true || search.expired === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(
    search.error || (expired ? "Your session expired. Please sign in again." : null),
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
      if (err instanceof AuthError && err.code === "email_not_confirmed") {
        toast.info("Please verify your email address to continue.");
        navigate({
          to: "/verify-email",
          search: { email: email.trim().toLowerCase() },
        });
        return;
      }
      setError(
        err instanceof AuthError && err.code === "invalid_credentials"
          ? "Invalid email or password."
          : authMessage(err),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setError(null);
    setOauthLoading(provider);
    try {
      await authApi.signInWithOAuth(provider);
    } catch (err) {
      setError(authMessage(err));
      setOauthLoading(null);
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
            Welcome back! Please enter your details or sign in with OAuth.
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
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading || Boolean(oauthLoading)}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" /> Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 font-medium text-muted-foreground">OR</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full justify-center gap-2.5 font-medium hover:bg-muted/80"
              disabled={loading || Boolean(oauthLoading)}
              onClick={() => handleOAuthLogin("google")}
            >
              {oauthLoading === "google" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <GoogleIcon className="size-4" />
              )}
              Continue with Google
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full justify-center gap-2.5 font-medium hover:bg-muted/80"
              disabled={loading || Boolean(oauthLoading)}
              onClick={() => handleOAuthLogin("apple")}
            >
              {oauthLoading === "apple" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <AppleIcon className="size-4" />
              )}
              Continue with Apple
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&rsquo;t have an account?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
