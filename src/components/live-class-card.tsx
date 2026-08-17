import { Link } from "@tanstack/react-router";
import { CalendarClock, Clock, UserRound, Video } from "lucide-react";
import { useEffect, useState } from "react";

import { LiveBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { countdown, dateTimeOf, timeOf } from "@/lib/format";
import type { ScheduledClass } from "@/lib/db/types";

export function useCountdown(iso: string) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setLabel(countdown(iso)?.label ?? null);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [iso]);
  return label;
}

export function HeroClassCard({ cls }: { cls: ScheduledClass }) {
  const label = useCountdown(cls.starts_at);
  const isLive = cls.status === "live";

  return (
    <article className="hero-gradient rise relative overflow-hidden rounded-2xl p-5 text-white sm:p-7">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          {isLive ? (
            <LiveBadge />
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
              <CalendarClock className="size-3.5" /> UPCOMING LIVE CLASS
            </span>
          )}
          <h2 className="mt-3 truncate font-display text-xl font-semibold sm:text-2xl">
            {cls.subject?.name ?? "Subject"} — {cls.topic}
          </h2>
          <p className="mt-1 text-sm text-white/75">{cls.chapter}</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-4" /> {cls.teacher?.user?.name ?? "Instructor"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-4" /> {dateTimeOf(cls.starts_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" /> ends {timeOf(cls.ends_at)}
            </span>
          </div>
          <p className="mt-4 text-sm font-medium text-white/90">
            {isLive
              ? "Class is live — join now"
              : label
                ? `Starts in ${label}`
                : "Starting shortly"}
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="w-full bg-white text-primary hover:bg-white/90 sm:w-auto"
        >
          <Link to="/classroom/$classId" params={{ classId: cls.id }}>
            <Video className="size-4" /> {isLive ? "Join Live Class" : "Join Class"}
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function ClassRow({ cls }: { cls: ScheduledClass }) {
  const isLive = cls.status === "live";
  return (
    <div className="surface flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold">{cls.subject?.name ?? "Subject"}</p>
          {isLive ? <LiveBadge label="LIVE" /> : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{cls.topic}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {cls.teacher?.user?.name ?? "Instructor"} · {dateTimeOf(cls.starts_at)}
        </p>
      </div>
      <Button asChild size="sm" variant={isLive ? "default" : "outline"} className="shrink-0">
        <Link to="/classroom/$classId" params={{ classId: cls.id }}>
          {isLive ? "Join" : "Details"}
        </Link>
      </Button>
    </div>
  );
}
