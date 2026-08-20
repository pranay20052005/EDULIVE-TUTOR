import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/app-shell";
import { BookLoader } from "@/components/book-loader";
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
    return <BookLoader fullScreen text="Loading your session…" />;
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
