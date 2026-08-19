import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle, Radio } from "lucide-react";

import { ClassRow, HeroClassCard } from "@/components/live-class-card";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { useStudentEnrollments } from "@/lib/db/hooks";
import { useLiveClassRealtime } from "@/lib/db/realtime";
import { scheduledClassService } from "@/lib/db";
import { useSession } from "@/lib/session";
import type { ScheduledClass } from "@/lib/db/types";

export const Route = createFileRoute("/app/live")({
  head: () => ({
    meta: [
      { title: "Live classes — EduLive" },
      {
        name: "description",
        content: "Your live and upcoming online classes with EduLive faculty.",
      },
      { property: "og:title", content: "Live classes — EduLive" },
      { property: "og:description", content: "Join today's live class in one tap." },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  const { student, isEnrolled } = useSession();

  // Listen to live class status updates in real-time
  useLiveClassRealtime();

  const { data: enrollments = [] } = useStudentEnrollments(student?.id);
  const enrolledSubjectIds = useMemo(
    () =>
      enrollments.length > 0
        ? enrollments.map((e: any) => e.subject_id)
        : student?.subjectIds?.filter((id) => isEnrolled(id)) || [],
    [enrollments, student?.subjectIds, isEnrolled],
  );

  const { data: allScheduledClasses = [], isLoading } = useQuery({
    queryKey: ["scheduled-classes-by-subjects", enrolledSubjectIds],
    queryFn: async () => {
      if (!enrolledSubjectIds.length) return [];
      return scheduledClassService.listBySubjects(enrolledSubjectIds);
    },
    enabled: enrolledSubjectIds.length > 0,
  });

  const { live, upcoming, completed } = useMemo(() => {
    const liveClasses: ScheduledClass[] = [];
    const upcomingClasses: ScheduledClass[] = [];
    const completedClasses: ScheduledClass[] = [];

    allScheduledClasses.forEach((c: ScheduledClass) => {
      if (c.status === "cancelled" || c.status === "draft") return;

      if (c.status === "live") {
        liveClasses.push(c);
      } else if (c.status === "completed") {
        completedClasses.push(c);
      } else {
        // Scheduled or upcoming
        upcomingClasses.push(c);
      }
    });

    upcomingClasses.sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
    completedClasses.sort((a, b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime());

    return {
      live: liveClasses,
      upcoming: upcomingClasses,
      completed: completedClasses,
    };
  }, [allScheduledClasses]);

  if (enrolledSubjectIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Live classes"
          subtitle="Join live interactive sessions with expert teachers"
        />
        <EmptyState
          icon={BookOpen}
          title="No enrolled subjects yet"
          body="Enroll in courses to unlock your live class timetable, virtual classroom and meeting links."
          action={
            <Button asChild>
              <Link to="/app/courses">Explore courses</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Live classes" subtitle="Real-time timetable for your enrolled courses" />

      {/* Featured Live Class if one is active right now */}
      {live.length > 0 ? (
        <section>
          <HeroClassCard cls={live[0]} />
        </section>
      ) : null}

      {/* Currently Running Classes */}
      <section>
        <SectionTitle title="Happening now" />
        <div className="space-y-3">
          {live.length ? (
            live.map((c: ScheduledClass) => <ClassRow key={c.id} cls={c} />)
          ) : (
            <EmptyState
              icon={Radio}
              title="No class running right now"
              body="Your next session will appear here with an active join button when faculty goes live."
            />
          )}
        </div>
      </section>

      {/* Upcoming Scheduled Classes */}
      <section>
        <SectionTitle title="Upcoming schedule" />
        <div className="space-y-3">
          {upcoming.length ? (
            upcoming.map((c: ScheduledClass) => <ClassRow key={c.id} cls={c} />)
          ) : (
            <EmptyState
              icon={Radio}
              title="No upcoming classes scheduled"
              body="Faculty will publish the timetable for upcoming sessions soon."
            />
          )}
        </div>
      </section>

      {/* Completed Classes */}
      {completed.length > 0 ? (
        <section>
          <SectionTitle title="Completed sessions" />
          <div className="space-y-3">
            {completed.map((c: ScheduledClass) => (
              <ClassRow key={c.id} cls={c} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
