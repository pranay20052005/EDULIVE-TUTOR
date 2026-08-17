import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/app-shell";
import { homeForRole, useSession } from "@/lib/session";

export const Route = createFileRoute("/app")({
  component: StudentLayout,
});

function StudentLayout() {
  const { session, status } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "unauthenticated") {
      navigate({ to: "/login", replace: true });
    } else if (status === "authenticated" && session && session.role !== "student") {
      navigate({ to: homeForRole(session.role), replace: true });
    }
  }, [status, session, navigate]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your session…</p>
        </div>
      </div>
    );
  }

  if (!session || session.role !== "student") {
    return null;
  }

  return (
    <AppShell role="student">
      <Outlet />
    </AppShell>
  );
}
