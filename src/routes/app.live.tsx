import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { ClassRow } from "@/components/live-class-card";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui-kit";
import { Radio } from "lucide-react";
import { useStudentEnrollments } from "@/lib/db/hooks";
import { scheduledClassService } from "@/lib/db";
import { useSession } from "@/lib/session";

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
  const { student } = useSession();
  const { data: enrollments = [] } = useStudentEnrollments(student?.id);
  const enrolledSubjectIds = enrollments.map((e: any) => e.subject_id);

  const { data: allScheduledClasses = [] } = useQuery({
    queryKey: ["scheduled-classes-by-subjects", enrolledSubjectIds],
    queryFn: async () => {
      if (!enrolledSubjectIds.length) return [];
      const results = await Promise.all(
        enrolledSubjectIds.map((id: string) => scheduledClassService.listBySubject(id)),
      );
      return results.flat();
    },
    enabled: enrolledSubjectIds.length > 0,
  });

  const { live, upcoming, past } = useMemo(() => {
    const now = Date.now();
    const liveClasses = allScheduledClasses.filter((c: any) => {
      const startsAt = new Date(c.starts_at).getTime();
      const endsAt = new Date(c.ends_at).getTime();
      return startsAt <= now && now < endsAt;
    });

    const upcomingClasses = allScheduledClasses
      .filter((c: any) => new Date(c.starts_at).getTime() > now)
      .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    const pastClasses = allScheduledClasses.filter(
      (c: any) => new Date(c.ends_at).getTime() <= now,
    );

    return {
      live: liveClasses,
      upcoming: upcomingClasses,
      past: pastClasses,
    };
  }, [allScheduledClasses]);

  return (
    <div className="space-y-8">
      <PageHeader title="Live classes" subtitle="Everything scheduled for your enrolled subjects" />
      <section>
        <SectionTitle title="Happening now" />
        <div className="space-y-3">
          {live.length ? (
            live.map((c: any) => <ClassRow key={c.id} cls={c} />)
          ) : (
            <EmptyState
              icon={Radio}
              title="No class running"
              body="Your next session will appear here when it goes live."
            />
          )}
        </div>
      </section>
      <section>
        <SectionTitle title="Upcoming" />
        <div className="space-y-3">
          {upcoming.map((c: any) => (
            <ClassRow key={c.id} cls={c} />
          ))}
        </div>
      </section>
      <section>
        <SectionTitle title="Completed" />
        <div className="space-y-3">
          {past.map((c: any) => (
            <ClassRow key={c.id} cls={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
