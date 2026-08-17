import { createFileRoute } from "@tanstack/react-router";
import { Compass, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CourseCard } from "@/components/course-card";
import { EmptyState, PageHeader } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { subjectService } from "@/lib/db";
import { useSession } from "@/lib/session";
import type { Subject } from "@/lib/db/types";

export const Route = createFileRoute("/app/courses/")({
  head: () => ({
    meta: [
      { title: "Explore courses — EduLive" },
      {
        name: "description",
        content:
          "Browse EduLive courses for your standard: live classes, recordings, notes, assignments and mock tests.",
      },
      { property: "og:title", content: "Explore courses — EduLive" },
      {
        property: "og:description",
        content: "Find and enroll in the right course for your class.",
      },
    ],
  }),
  component: CoursesPage,
});

const DEFAULT_STANDARDS = ["8th", "9th", "10th", "11th", "12th"];

function CoursesPage() {
  const { student } = useSession();
  const studentStandard = student?.standard || "9th";

  const [q, setQ] = useState("");
  const [standard, setStandard] = useState<string>(studentStandard);
  const [userSelectedStandard, setUserSelectedStandard] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("all");

  // Keep standard filter in sync with student's standard from DB profile unless user manually changed it
  useEffect(() => {
    if (student?.standard && !userSelectedStandard) {
      setStandard(student.standard);
    }
  }, [student?.standard, userSelectedStandard]);

  const { data: allSubjects = [] } = useQuery({
    queryKey: ["subjects-published"],
    queryFn: async () => subjectService.listPublished(),
  });

  const standards = useMemo(() => {
    const fromSubjects = allSubjects.map((s: Subject) => s.standard).filter(Boolean) as string[];
    const merged = Array.from(new Set([...DEFAULT_STANDARDS, ...fromSubjects]));
    return merged.sort((a, b) => {
      const na = parseInt(a, 10) || 0;
      const nb = parseInt(b, 10) || 0;
      return na - nb;
    });
  }, [allSubjects]);

  const subjectNames = useMemo(
    () => Array.from(new Set(allSubjects.map((s: Subject) => s.name))).sort(),
    [allSubjects],
  );

  const list = useMemo(
    () =>
      allSubjects.filter((s: Subject) => {
        if (
          standard !== "all" &&
          (s.standard || "").trim().toLowerCase() !== standard.trim().toLowerCase()
        ) {
          return false;
        }
        if (
          subjectFilter !== "all" &&
          (s.name || "").trim().toLowerCase() !== subjectFilter.trim().toLowerCase()
        ) {
          return false;
        }
        if (!q.trim()) return true;
        const hay = `${s.name} ${s.standard || ""} ${s.teacher?.user?.name || ""}`.toLowerCase();
        return hay.includes(q.trim().toLowerCase());
      }),
    [q, standard, subjectFilter, allSubjects],
  );

  const handleStandardChange = (val: string) => {
    setUserSelectedStandard(true);
    setStandard(val);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Explore courses"
        subtitle={
          studentStandard
            ? `Curated courses for ${studentStandard} Standard — live classes, recordings, notes and tests`
            : "Purchase only what you need — every course includes live classes, recordings, notes and tests"
        }
      />

      <div className="surface grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search course, teacher…"
            className="h-11 rounded-xl pl-9"
            aria-label="Search courses"
          />
        </div>
        <Select value={standard} onValueChange={handleStandardChange}>
          <SelectTrigger className="h-11 rounded-xl sm:w-44" aria-label="Filter by standard">
            <SelectValue placeholder="Standard" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All standards</SelectItem>
            {standards.map((s) => (
              <SelectItem key={s} value={s}>
                {s} Standard
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="h-11 rounded-xl sm:w-44" aria-label="Filter by subject">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {subjectNames.map((n) => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s: Subject) => (
            <CourseCard
              key={s.id}
              subject={s}
              enrolled={student?.subjectIds?.includes(s.id) ?? false}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Compass}
          title="No courses match your filters"
          body="Try selecting 'All standards' or clear the search to see everything available on EduLive."
        />
      )}
    </div>
  );
}
