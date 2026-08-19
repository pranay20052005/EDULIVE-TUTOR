import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, GraduationCap, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/auth";
import { supabase } from "@/lib/db/client";
import { setCurrentUserCache } from "@/lib/route-guards";
import { homeForRole, useSession } from "@/lib/session";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Authenticating — EduLive" },
      { name: "description", content: "Completing sign in to EduLive." },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Authenticating with provider…");

  useEffect(() => {
    let active = true;

    const processAuth = async () => {
      try {
        // Check for error parameters in URL search or hash
        if (typeof window !== "undefined") {
          const urlParams = new URLSearchParams(window.location.search);
          const hashParams = new URLSearchParams(
            window.location.hash.startsWith("#")
              ? window.location.hash.substring(1)
              : window.location.hash,
          );

          const errorDesc =
            urlParams.get("error_description") ||
            hashParams.get("error_description") ||
            urlParams.get("error") ||
            hashParams.get("error");

          if (errorDesc) {
            setError(decodeURIComponent(errorDesc.replace(/\+/g, " ")));
            return;
          }
        }

        // Wait for Supabase to parse tokens and initialize session
        setStatusText("Verifying session…");
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (session?.user && active) {
          setStatusText("Setting up your account…");
          const account = await authApi.resolveOAuthProfile(session.user);

          if (!account) {
            throw new Error("Unable to load or create profile. Please try signing in again.");
          }

          if (active) {
            setCurrentUserCache(account);
            signIn(account);
            toast.success(`Welcome to EduLive, ${account.name.split(" ")[0]}!`);
            const target = homeForRole(account.role);
            navigate({ to: target as never, replace: true });
          }
          return;
        }

        // Listen for auth event if session wasn't immediately ready
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (newSession?.user && active) {
            setStatusText("Loading profile…");
            const account = await authApi.resolveOAuthProfile(newSession.user);
            if (account && active) {
              setCurrentUserCache(account);
              signIn(account);
              toast.success(`Welcome to EduLive, ${account.name.split(" ")[0]}!`);
              const target = homeForRole(account.role);
              navigate({ to: target as never, replace: true });
            }
          }
        });

        // Set a timeout in case authentication was cancelled or failed silently
        const timeout = setTimeout(() => {
          if (active) {
            setError("Authentication timed out or was cancelled. Please try signing in again.");
          }
        }, 6000);

        return () => {
          subscription?.unsubscribe();
          clearTimeout(timeout);
        };
      } catch (err: any) {
        console.error("OAuth callback error:", err);
        if (active) {
          setError(err?.message || "Failed to complete authentication.");
        }
      }
    };

    processAuth();

    return () => {
      active = false;
    };
  }, [navigate, signIn]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="mb-8 inline-flex items-center justify-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">EduLive</span>
        </Link>

        <div className="surface p-6 sm:p-7">
          {error ? (
            <div className="space-y-4 text-center">
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3.5 text-left text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
              <Button asChild className="w-full" size="lg">
                <Link to="/login">Back to Sign in</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Loader2 className="size-6 animate-spin" />
              </span>
              <div>
                <h1 className="text-lg font-semibold sm:text-xl">Signing you in</h1>
                <p className="mt-1 text-xs text-muted-foreground">{statusText}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
