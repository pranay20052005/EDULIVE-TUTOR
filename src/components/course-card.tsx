import { Link } from "@tanstack/react-router";
import { BookOpen, CheckCircle2, Clock3, FileText, PlaySquare, Radio, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import type { Subject } from "@/lib/db/types";

export function CourseMeta({ subjectId }: { subjectId: string }) {
  const items = [
    { icon: BookOpen, label: `chapters` },
    { icon: Radio, label: `live classes` },
    { icon: PlaySquare, label: `recordings` },
    { icon: FileText, label: `notes` },
    { icon: Trophy, label: `tests` },
  ];
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <i.icon className="size-3.5 shrink-0 text-primary/70" />
          <span className="truncate">{i.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function CourseCard({ subject, enrolled }: { subject: Subject; enrolled: boolean }) {
  const price = subject.price_inr ?? (subject as any).priceINR ?? 0;
  const duration = subject.duration_months ?? (subject as any).durationMonths ?? 6;
  const teacher =
    subject.teacher?.user?.name ||
    subject.teacher_id ||
    (subject as any).teacherId ||
    "EduLive Faculty";

  return (
    <article className="surface group flex flex-col p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/20 text-primary transition-transform duration-300 group-hover:scale-105">
          <BookOpen className="size-5" />
        </span>
        {enrolled ? (
          <Badge className="gap-1 bg-success/15 text-success hover:bg-success/15">
            <CheckCircle2 className="size-3" /> Enrolled
          </Badge>
        ) : (
          <Badge variant="outline">{subject.standard} Standard</Badge>
        )}
      </div>

      <h3 className="mt-4 truncate text-lg font-semibold">{subject.name}</h3>
      <p className="truncate text-xs text-muted-foreground">{teacher}</p>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
        {subject.description ?? "Learn this subject with expert instructors."}
      </p>

      <div className="mt-4">
        <CourseMeta subjectId={subject.id} />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0">
          <p className="text-xl font-semibold">{price === 0 ? "Free" : inr(price)}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock3 className="size-3" /> Valid for {duration} months
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {enrolled ? (
          <Button asChild className="flex-1">
            <Link to="/app/subjects/$subjectId" params={{ subjectId: subject.id }}>
              Go to Subject
            </Link>
          </Button>
        ) : (
          <>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/app/courses/$subjectId" params={{ subjectId: subject.id }}>
                View Course
              </Link>
            </Button>
            <Button asChild className="flex-1">
              <Link to="/app/checkout/$subjectId" params={{ subjectId: subject.id }}>
                {price === 0 ? "Enroll Free" : "Purchase"}
              </Link>
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
