import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppShell } from "@/components/app-shell";
import { BookLoader } from "@/components/book-loader";
import { homeForRole, useSession } from "@/lib/session";
import { adminRouteLoader } from "@/lib/route-guards";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    await adminRouteLoader();
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { session, status } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "unauthenticated") {
      navigate({ to: "/login", replace: true });
    } else if (status === "authenticated" && session && session.role !== "admin") {
      navigate({ to: homeForRole(session.role), replace: true });
    }
  }, [status, session, navigate]);

  if (status === "loading") {
    return <BookLoader fullScreen text="Loading admin portal…" />;
  }

  if (!session || session.role !== "admin") {
    return null;
  }

  return (
    <AppShell role="admin">
      <Outlet />
    </AppShell>
  );
}
