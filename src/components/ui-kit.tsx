import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "primary" | "accent" | "success" | "warning" | "live";
}) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-accent-foreground",
    success: "bg-success/12 text-success",
    warning: "bg-warning/18 text-warning-foreground",
    live: "bg-live/12 text-live",
  };
  return (
    <div className="surface rise p-4 transition-shadow hover:shadow-[var(--shadow-lift)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold sm:text-3xl">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", toneMap[tone])}>
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}

export function SectionTitle({
  title,
  action,
  to,
}: {
  title: string;
  action?: string;
  to?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
      {action && to ? (
        <Button asChild variant="ghost" size="sm" className="text-primary">
          <Link to={to}>{action}</Link>
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="surface space-y-3 p-5">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-700"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function LiveBadge({ label = "LIVE NOW" }: { label?: string }) {
  return (
    <span className="live-pulse inline-flex items-center rounded-full bg-live px-2.5 py-1 text-[11px] font-semibold tracking-wide text-live-foreground">
      {label}
    </span>
  );
}
