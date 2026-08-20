import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/app-shell";
import { BookLoader } from "@/components/book-loader";
import { homeForRole, useSession } from "@/lib/session";

export const Route = createFileRoute("/teacher")({
  component: TeacherLayout,
});

function TeacherLayout() {
  const { session, status } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "unauthenticated") {
      navigate({ to: "/login", replace: true });
    } else if (status === "authenticated" && session && session.role !== "teacher") {
      navigate({ to: homeForRole(session.role), replace: true });
    }
  }, [status, session, navigate]);

  if (status === "loading") {
    return <BookLoader fullScreen text="Loading teacher portal…" />;
  }

  if (!session || session.role !== "teacher") {
    return null;
  }

  return (
    <AppShell role="teacher">
      <Outlet />
    </AppShell>
  );
}
