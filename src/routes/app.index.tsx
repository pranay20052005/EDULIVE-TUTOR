import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Award,
  BookOpen,
  CalendarCheck,
  Compass,
  Megaphone,
  PlayCircle,
  Search,
  TrendingUp,
  Trophy,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { HeroClassCard } from "@/components/live-class-card";
import {
  CardSkeleton,
  EmptyState,
  PageHeader,
  ProgressBar,
  SectionTitle,
  StatCard,
} from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CertificateModal } from "@/components/certificate-modal";
import { dateTimeOf, greeting, relative } from "@/lib/format";
import {
  useStudentEnrollments,
  usePublishedAnnouncements,
  useStudentAttendanceSummary,
  useScheduledClassesBySubjects,
  useStudentTestAttempts,
  usePublishedRecordingsBySubjects,
} from "@/lib/db/hooks";
import { certificateService } from "@/lib/db";
import { useLiveClassRealtime } from "@/lib/db/realtime";
import { useSession } from "@/lib/session";
import type { CourseCertificate, Enrollment, Recording } from "@/lib/db/types";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Student Dashboard — EduLive" },
      {
        name: "description",
        content:
          "Your EduLive dashboard: upcoming live class, subject progress, recent results and certificates.",
      },
      { property: "og:title", content: "Student Dashboard — EduLive" },
      {
        property: "og:description",
        content: "Live class countdown, course progress, recordings and results.",
      },
    ],
  }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const { student } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [certificateModalOpen, setCertificateModalOpen] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<CourseCertificate | null>(null);
  const [generatingCert, setGeneratingCert] = useState(false);

  // Listen to realtime class status changes
  useLiveClassRealtime();

  const { data: enrollments = [], isLoading: loadingEnrollments } = useStudentEnrollments(
    student?.id,
  );
  const { data: announcements = [] } = usePublishedAnnouncements();
  const { data: attendanceSummary } = useStudentAttendanceSummary(student?.id);
  const { data: testAttempts = [] } = useStudentTestAttempts(student?.id);

  // Get all upcoming/live classes for enrolled subjects
  const enrolledSubjectIds = useMemo(
    () => (enrollments ?? []).map((e: any) => e.subject_id),
    [enrollments],
  );

  const { data: allUpcomingClasses = [] } = useScheduledClassesBySubjects(enrolledSubjectIds);
  const { data: publishedRecordings = [] } = usePublishedRecordingsBySubjects(enrolledSubjectIds);

  const upcoming = (allUpcomingClasses ?? []).filter(
    (c: any) => c.status !== "completed" && c.status !== "cancelled" && c.status !== "draft",
  );

  const hero = upcoming.find((c: any) => c.status === "live") ?? upcoming[0];
  const recent = testAttempts[0];

  // Filtered enrolled subjects based on search query
  const filteredEnrollments = useMemo(() => {
    if (!searchQuery.trim()) return enrollments;
    const q = searchQuery.toLowerCase();
    return enrollments.filter((e: any) => {
      const name = (e.subject?.name || "").toLowerCase();
      const teacher = (e.subject?.teacher?.user?.name || "").toLowerCase();
      return name.includes(q) || teacher.includes(q);
    });
  }, [enrollments, searchQuery]);

  // Overall progress calculation
  const overall =
    enrollments.length > 0
      ? Math.round(
          (enrollments ?? []).reduce((s: number, e: any) => s + (e.progress ?? 0), 0) /
            enrollments.length,
        )
      : 0;

  // Handle Certificate View / Generation
  const handleOpenCertificate = async (enrollment: Enrollment) => {
    if (!student?.id || !enrollment.subject_id) return;
    setGeneratingCert(true);
    try {
      let cert = await certificateService.getByStudentAndSubject(student.id, enrollment.subject_id);
      if (!cert) {
        // Issue official certificate
        cert = await certificateService.issueCertificate({
          student_id: student.id,
          subject_id: enrollment.subject_id,
          student_name: student.name,
          course_name: enrollment.subject?.name || "Academic Subject",
          standard: student.standard || "10th",
          score_percentage: 100.0,
        });
        toast.success("Course Completion Certificate Generated!");
      }
      setSelectedCertificate(cert);
      setCertificateModalOpen(true);
    } catch (err: any) {
      console.error("Certificate error:", err);
      toast.error(err.message || "Failed to load certificate");
    } finally {
      setGeneratingCert(false);
    }
  };

  if (loadingEnrollments && !student?.id) {
    return (
      <div className="space-y-8">
        <PageHeader
          title={`${greeting()}, ${student?.name?.split(" ")[0] ?? "Student"} 👋`}
          subtitle="Loading your dashboard…"
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={`${greeting()}, ${student?.name?.split(" ")[0] ?? "Student"} 👋`}
          subtitle={`${student?.standard || "10th"} Standard · ${student?.board || "CBSE"} · ${enrollments.length} enrolled ${enrollments.length === 1 ? "subject" : "subjects"}`}
        />
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subjects, notes…"
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance"
          value={`${attendanceSummary?.percentage ?? 0}%`}
          hint={`${attendanceSummary?.presentCount ?? 0} classes attended`}
          icon={CalendarCheck}
          tone="success"
        />
        <StatCard
          label="Overall progress"
          value={`${overall}%`}
          hint="Across enrolled subjects"
          icon={TrendingUp}
        />
        <StatCard
          label="Recent test"
          value={recent ? `${recent.marks_obtained ?? 0}/${recent.test?.total_marks ?? "—"}` : "—"}
          hint={recent?.test?.title ?? "No tests yet"}
          icon={Trophy}
          tone="warning"
        />
        <StatCard
          label="Recorded lectures"
          value={`${publishedRecordings.length}`}
          hint="Available to watch"
          icon={PlayCircle}
          tone="accent"
        />
      </div>

      {hero ? <HeroClassCard cls={hero} /> : null}

      {/* Enrolled Subjects with Certificate Actions */}
      <section className="space-y-4">
        <SectionTitle title="My subjects" action="Explore courses →" to="/app/courses" />
        {enrollments.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="You haven't enrolled in a course yet"
            body="Browse courses available for your standard and enroll whenever you're ready."
            action={
              <Button asChild>
                <Link to="/app/courses">Explore courses</Link>
              </Button>
            }
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(filteredEnrollments ?? []).map((enrollment: any) => (
            <div
              key={enrollment.id}
              className="surface flex flex-col justify-between p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-base">
                      {enrollment.subject?.name ?? "Subject"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground mt-0.5">
                      {enrollment.subject?.teacher?.user?.name ?? "Faculty"} ·{" "}
                      {enrollment.subject?.duration_months || 6} months access
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {enrollment.progress ?? 0}%
                  </Badge>
                </div>

                <ProgressBar value={enrollment.progress ?? 0} className="mt-4" />
                <p className="mt-3 text-xs text-muted-foreground">
                  {upcoming.find((c: any) => c.subject_id === enrollment.subject_id)
                    ? `Next class: ${dateTimeOf(
                        upcoming.find((c: any) => c.subject_id === enrollment.subject_id)
                          ?.starts_at ?? new Date(),
                      )}`
                    : "No live class currently scheduled"}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-border flex items-center justify-between gap-2">
                <Button asChild size="sm" variant="outline" className="flex-1 text-xs">
                  <Link to="/app/subjects/$subjectId" params={{ subjectId: enrollment.subject_id }}>
                    Open Hub
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 gap-1.5"
                  onClick={() => handleOpenCertificate(enrollment)}
                  disabled={generatingCert}
                >
                  <Award className="size-3.5" /> Certificate
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Grid: Continue Learning, Recent Results, Announcements */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-6">
          {/* Continue Learning / Recent Recordings */}
          <div>
            <SectionTitle title="Continue learning" action="All recordings" to="/app/recordings" />
            <div className="space-y-3">
              {publishedRecordings.length === 0 ? (
                <div className="surface p-4 text-xs text-muted-foreground text-center">
                  No recorded lectures published yet.
                </div>
              ) : (
                publishedRecordings.slice(0, 3).map((rec: Recording) => (
                  <div
                    key={rec.id}
                    className="surface flex items-center justify-between p-3.5 gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                        <Video className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{rec.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {rec.subject?.name || "Subject"} · {rec.duration_min || 45} mins
                        </p>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="ghost" className="text-xs shrink-0">
                      <Link to="/app/recordings">Watch</Link>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Results */}
          <div>
            <SectionTitle title="Recent test results" action="All results" to="/app/results" />
            <div className="grid gap-3 sm:grid-cols-2">
              {testAttempts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No test attempts yet. Take a test to see your results here.
                </p>
              ) : (
                testAttempts.slice(0, 4).map((attempt: any) => (
                  <div key={attempt.id} className="surface p-4">
                    <p className="truncate text-sm font-medium">{attempt.test?.title ?? "Test"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {relative(attempt.submitted_at || attempt.created_at)}
                    </p>
                    <div className="mt-3 flex items-end justify-between">
                      <p className="text-2xl font-semibold">
                        {attempt.marks_obtained ?? 0}
                        <span className="text-sm text-muted-foreground">
                          /{attempt.test?.total_marks}
                        </span>
                      </p>
                      <Badge
                        variant="secondary"
                        className={
                          (attempt.marks_obtained ?? 0) / (attempt.test?.total_marks ?? 1) >= 0.75
                            ? "bg-success/15 text-success"
                            : "bg-warning/20"
                        }
                      >
                        {Math.round(
                          ((attempt.marks_obtained ?? 0) / (attempt.test?.total_marks ?? 1)) * 100,
                        )}
                        %
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Sidebar: Announcements & Explore */}
        <aside className="space-y-3">
          <SectionTitle title="Announcements" />
          {(announcements ?? []).slice(0, 3).map((a: any) => (
            <div key={a.id} className="surface p-4">
              <div className="flex items-center gap-2 text-primary">
                <Megaphone className="size-4 shrink-0" />
                <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground line-clamp-3">{a.body}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {relative(a.published_at || a.created_at)}
              </p>
            </div>
          ))}
          {announcements.length === 0 ? (
            <div className="surface p-4">
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            </div>
          ) : null}

          <div className="surface p-4">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-primary" />
              <p className="text-sm font-medium">Add another course</p>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Expand your skills with additional live batches and test series.
            </p>
            <Button asChild size="sm" className="mt-3 w-full">
              <Link to="/app/courses">Explore courses</Link>
            </Button>
          </div>
        </aside>
      </div>

      {/* Certificate Viewer Modal */}
      <CertificateModal
        open={certificateModalOpen}
        onOpenChange={setCertificateModalOpen}
        certificate={selectedCertificate}
      />
    </div>
  );
}
