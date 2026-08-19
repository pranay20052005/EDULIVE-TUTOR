import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, CheckCircle2, Clock3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { CourseMeta } from "@/components/course-card";
import { ProgressBar } from "@/components/ui-kit";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dateTimeOf, inr } from "@/lib/format";
import { subjectService, chapterService, scheduledClassService } from "@/lib/db";
import { useSession } from "@/lib/session";
import type { Chapter, ScheduledClass } from "@/lib/db/types";

export const Route = createFileRoute("/app/courses/$subjectId")({
  head: () => ({
    meta: [
      { title: "Course — EduLive" },
      {
        name: "description",
        content:
          "Course details: syllabus, live classes, recordings, notes, mock tests, validity and price.",
      },
      { property: "og:title", content: "Course" },
      { property: "og:description", content: "Everything included in this EduLive course." },
    ],
  }),
  component: CourseDetail,
});

const INCLUDES = [
  "Live Classes",
  "Recorded Classes",
  "Study Materials",
  "Assignments",
  "Mock Tests",
  "Performance Tracking",
];

function CourseDetail() {
  const { subjectId } = Route.useParams();
  const {
    data: subject,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["subject", subjectId],
    queryFn: () => subjectService.getById(subjectId),
    enabled: !!subjectId,
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", subjectId],
    queryFn: () => chapterService.listBySubject(subjectId),
    enabled: !!subjectId,
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ["upcoming-classes", subjectId],
    queryFn: () => scheduledClassService.listBySubject(subjectId),
    enabled: !!subjectId,
  });

  const { isEnrolled } = useSession();
  const enrolled = isEnrolled(subjectId);
  const teacherName = subject?.teacher?.user?.name || "EduLive Faculty";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/app/courses">
          <ArrowLeft className="size-4" /> All courses
        </Link>
      </Button>

      {isLoading && <p className="text-center text-muted-foreground">Loading course details...</p>}
      {(isError || (!subject && !isLoading)) && (
        <p className="text-center text-destructive">Course not found</p>
      )}

      {subject && (
        <>
          <section className="hero-gradient rise overflow-hidden rounded-2xl p-6 text-white sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-white/15 text-white hover:bg-white/20">
                {subject.standard || "10th"} Standard
              </Badge>
              {enrolled ? (
                <Badge className="gap-1 bg-white/15 text-white hover:bg-white/20">
                  <CheckCircle2 className="size-3" /> Enrolled
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">{subject.name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              {subject.description ?? "Learn this subject with expert instructors."}
            </p>
            <p className="mt-4 text-sm text-white/85">Taught by {teacherName}</p>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <section className="surface p-5">
                <h2 className="text-base font-semibold sm:text-lg">What&rsquo;s included</h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {INCLUDES.map((i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <BadgeCheck className="size-4 shrink-0 text-success" /> {i}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 border-t border-border pt-4">
                  <CourseMeta subjectId={subjectId} />
                </div>
              </section>

              <section className="surface p-5">
                <h2 className="text-base font-semibold sm:text-lg">
                  Syllabus · {chapters.length} chapters
                </h2>
                {chapters.length ? (
                  <Accordion type="single" collapsible className="mt-2">
                    {chapters.map((c: Chapter, i: number) => (
                      <AccordionItem key={c.id} value={c.id}>
                        <AccordionTrigger className="text-sm">
                          <span className="truncate text-left">
                            {c.chapter_order ?? i + 1}. {c.title}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-xs text-muted-foreground">
                            {c.description || "Course material and practice exercises."}
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Syllabus details will be updated soon.
                  </p>
                )}
              </section>

              {upcoming.length ? (
                <section className="surface p-5">
                  <h2 className="text-base font-semibold sm:text-lg">Upcoming live classes</h2>
                  <ul className="mt-3 space-y-3">
                    {upcoming.map((c: ScheduledClass) => (
                      <li key={c.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{c.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.topic || c.chapter || "Class session"}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {dateTimeOf(c.starts_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="surface p-5">
                <p className="text-3xl font-semibold">
                  {subject.price_inr === 0 ? "Free" : inr(subject.price_inr)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock3 className="size-4" /> Valid for {subject.duration_months || 6} months
                </p>
                {enrolled ? (
                  <>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Your progress</span>
                        <span>0%</span>
                      </div>
                      <ProgressBar value={0} className="mt-2" />
                    </div>
                    <Button asChild className="mt-4 w-full" size="lg">
                      <Link to="/app/subjects/$subjectId" params={{ subjectId }}>
                        Go to Subject
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button asChild className="mt-5 w-full" size="lg">
                    <Link to="/app/checkout/$subjectId" params={{ subjectId }}>
                      {subject.price_inr === 0
                        ? "Enroll Now (Free)"
                        : `Purchase for ${inr(subject.price_inr)}`}
                    </Link>
                  </Button>
                )}
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  {subject.price_inr === 0
                    ? "Instant free access · No credit card required"
                    : "One-time payment · 18% GST included at checkout"}
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
