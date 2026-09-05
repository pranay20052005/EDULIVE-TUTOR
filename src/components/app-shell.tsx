import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  GraduationCap,
  KeyRound,
  Loader2,
  LogOut,
  Menu,
  Search,
  Settings,
  SquarePen,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { navByRole, roleLabel, type NavItem } from "@/components/nav-config";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { authApi, authMessage } from "@/lib/auth";
import { initials } from "@/lib/format";
import { useUnreadNotificationCount } from "@/lib/db/hooks";
import { homeForRole, useSession } from "@/lib/session";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

function useActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (item: NavItem) =>
    item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function NavList({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const isActive = useActive();
  return (
    <nav className="space-y-1">
      {navByRole[role].map((item) => (
        <Link
          key={item.to}
          to={item.to as never}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isActive(item)
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          )}
        >
          <item.icon className="size-[18px] shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
        <GraduationCap className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-base leading-tight font-semibold text-sidebar-accent-foreground">
          EduLive
        </p>
        <p className="truncate text-[11px] text-sidebar-foreground/60">Live Learning Platform</p>
      </div>
    </div>
  );
}

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const { session, signOut, status, student } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const isActive = useActive();
  const didRedirect = useRef(false);
  const { data: unread = 0 } = useUnreadNotificationCount(session?.id);
  const displayName = session?.name ?? roleLabel[role];
  const notifTo = role === "student" ? "/app/notifications" : `/${role}`;
  const profileBase =
    role === "student"
      ? "/app/profile"
      : role === "teacher"
        ? "/teacher/profile"
        : "/admin/settings";

  const handleLogout = async () => {
    try {
      await authApi.logout();
      signOut();
      navigate({ to: "/login" as never, replace: true });
      toast.success("Signed out successfully");
    } catch (err) {
      toast.error(authMessage(err));
    }
  };

  const mismatched = status === "authenticated" && session!.role !== role;

  useEffect(() => {
    if (didRedirect.current) return;
    if (status === "unauthenticated") {
      didRedirect.current = true;
      navigate({ to: "/login", search: { redirect: pathname }, replace: true } as never);
    } else if (mismatched) {
      didRedirect.current = true;
      navigate({ to: homeForRole(session!.role) as never, replace: true });
    }
  }, [status, mismatched, session, pathname, navigate]);

  if (status !== "authenticated" || mismatched) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {status === "loading" ? "Loading your workspace…" : "Redirecting…"}
          </p>
        </div>
      </div>
    );
  }

  const primary = navByRole[role].filter((i) => i.primary).slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <div className="mt-6 flex-1 overflow-y-auto">
          <NavList role={role} />
        </div>
        <div className="mt-4 rounded-2xl bg-sidebar-accent/60 p-3">
          <p className="text-xs text-sidebar-foreground/70">Signed in as</p>
          <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
            {displayName}
          </p>
          <p className="text-[11px] text-sidebar-foreground/60">{roleLabel[role]}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start gap-2 px-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={handleLogout}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-4">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Brand />
                <div className="mt-6">
                  <NavList role={role} onNavigate={() => setOpen(false)} />
                </div>
                <Button
                  variant="ghost"
                  className="mt-4 w-full justify-start gap-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={async () => {
                    setOpen(false);
                    try {
                      await authApi.logout();
                      signOut();
                      navigate({ to: "/login" as never, replace: true });
                      toast.success("Signed out successfully");
                    } catch (err) {
                      toast.error(authMessage(err));
                    }
                  }}
                >
                  <LogOut className="size-4" /> Sign out
                </Button>
              </SheetContent>
            </Sheet>

            <div className="relative hidden min-w-0 flex-1 sm:block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search subjects, chapters, tests…"
                className="h-10 max-w-md rounded-xl pl-9"
              />
            </div>
            <div className="min-w-0 flex-1 sm:hidden">
              <p className="truncate font-display text-base font-semibold">EduLive</p>
            </div>

            <Button asChild variant="ghost" size="icon" className="relative shrink-0">
              <Link to={notifTo as never} aria-label="Notifications">
                <Bell className="size-5" />
                {unread > 0 ? (
                  <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-live text-[10px] font-semibold text-live-foreground">
                    {unread}
                  </span>
                ) : null}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Open profile menu"
                  className="flex shrink-0 items-center gap-1.5 rounded-full p-0.5 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                      {initials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="mr-1 hidden size-4 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-64 max-w-[calc(100vw-1.5rem)]"
              >
                <div className="flex items-center gap-3 px-2 py-2.5">
                  <Avatar className="size-11">
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                      {initials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{roleLabel[role]}</p>
                    {role === "student" ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {student.standard} Standard · {student.board}
                      </p>
                    ) : null}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={profileBase as never}>
                    <UserRound className="size-4" /> View Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={profileBase as never} hash="edit-profile">
                    <SquarePen className="size-4" /> Edit Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={profileBase as never} hash="account-settings">
                    <Settings className="size-4" /> Account Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={profileBase as never} hash="notification-settings">
                    <Bell className="size-4" /> Notifications Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={profileBase as never} hash="change-password">
                    <KeyRound className="size-4" /> Change Password
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleLogout}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="size-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pt-5 pb-28 sm:px-6 lg:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul
          className="grid"
          style={{ gridTemplateColumns: `repeat(${primary.length}, minmax(0, 1fr))` }}
        >
          {primary.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to as never}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  isActive(item) ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
