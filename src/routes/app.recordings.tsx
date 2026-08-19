import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Lock, PlayCircle, Search, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { CardSkeleton, EmptyState, PageHeader, ProgressBar } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordingProgressService, recordingService } from "@/lib/db";
import { useStudentEnrollments, useStudentRecordingProgress } from "@/lib/db/hooks";
import { useRecordingProgressRealtime, useRecordingRealtime } from "@/lib/db/realtime";
import { relative } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Recording, StudentRecordingProgress } from "@/lib/db/types";

export const Route = createFileRoute("/app/recordings")({
  head: () => ({
    meta: [
      { title: "Recorded classes — EduLive" },
      {
        name: "description",
        content: "Watch recorded lessons published by your faculty for enrolled subjects.",
      },
      { property: "og:title", content: "Recorded classes — EduLive" },
      { property: "og:description", content: "Resume any lesson from where you stopped." },
    ],
  }),
  component: RecordingsPage,
});

function getEmbedUrl(url: string): { type: "youtube" | "video" | "iframe"; src: string } {
  if (!url) return { type: "video", src: "" };

  // YouTube match
  const ytMatch = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/,
  );
  if (ytMatch && ytMatch[1]) {
    return {
      type: "youtube",
      src: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&enablejsapi=1`,
    };
  }

  // Direct video file or Supabase storage
  if (
    url.endsWith(".mp4") ||
    url.endsWith(".webm") ||
    url.endsWith(".ogg") ||
    url.includes("/storage/v1/object/public/recordings/")
  ) {
    return { type: "video", src: url };
  }

  // Other embeds (Vimeo, Google Drive, Loom)
  if (url.includes("drive.google.com/file/d/")) {
    const driveId = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
    if (driveId) {
      return { type: "iframe", src: `https://drive.google.com/file/d/${driveId}/preview` };
    }
  }

  return { type: "video", src: url };
}

function RecordingsPage() {
  const { student, isEnrolled } = useSession();
  const queryClient = useQueryClient();

  // Realtime subscriptions
  useRecordingRealtime();
  useRecordingProgressRealtime(student?.id);

  const { data: enrollments = [] } = useStudentEnrollments(student?.id);
  const enrolledIds = useMemo(
    () =>
      enrollments.length > 0
        ? enrollments.map((e: any) => e.subject_id)
        : student?.subjectIds?.filter((id) => isEnrolled(id)) || [],
    [enrollments, student?.subjectIds, isEnrolled],
  );

  const { data: allRecordings = [], isLoading } = useQuery({
    queryKey: ["recordings-published"],
    queryFn: () => recordingService.listPublished(),
  });

  const { data: progressRecords = [] } = useStudentRecordingProgress(student?.id);

  const progressMap = useMemo(() => {
    const map: Record<string, StudentRecordingProgress> = {};
    progressRecords.forEach((p: StudentRecordingProgress) => {
      map[p.recording_id] = p;
    });
    return map;
  }, [progressRecords]);

  const recordings = useMemo(
    () => allRecordings.filter((r: Recording) => enrolledIds.includes(r.subject_id)),
    [allRecordings, enrolledIds],
  );

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [active, setActive] = useState<Recording | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const filtered = useMemo(
    () =>
      recordings.filter((r: Recording) => {
        if (subjectFilter !== "all" && r.subject_id !== subjectFilter) return false;
        if (
          search &&
          !`${r.title} ${r.topic || ""} ${r.description || ""}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [recordings, subjectFilter, search],
  );

  // Resume video timestamp when modal opens
  useEffect(() => {
    if (active && videoRef.current && progressMap[active.id]) {
      const savedSeconds = progressMap[active.id].watched_seconds;
      if (savedSeconds > 0) {
        videoRef.current.currentTime = savedSeconds;
      }
    }
  }, [active, progressMap]);

  // Handle saving video progress to Supabase
  const handleUpdateProgress = async (recordingId: string, percent: number, seconds: number) => {
    if (!student?.id) return;
    try {
      await recordingProgressService.saveProgress({
        student_id: student.id,
        recording_id: recordingId,
        progress_percent: percent,
        watched_seconds: seconds,
        completed: percent >= 90,
      });
      queryClient.invalidateQueries({ queryKey: ["student-recording-progress", student.id] });
    } catch (err) {
      console.error("Failed to save progress:", err);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || !active) return;
    const duration = videoRef.current.duration;
    const current = videoRef.current.currentTime;
    if (duration > 0) {
      const pct = Math.round((current / duration) * 100);
      // Save every 5%
      const currentSaved = progressMap[active.id]?.progress_percent || 0;
      if (Math.abs(pct - currentSaved) >= 5 || pct >= 95) {
        handleUpdateProgress(active.id, pct, Math.round(current));
      }
    }
  };

  if (enrolledIds.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Recorded classes"
          subtitle="Watch recorded sessions from your subjects"
        />
        <EmptyState
          icon={Lock}
          title="You're not enrolled in any subject yet"
          body="Enroll in a course to unlock its recorded classes and revision library."
          action={
            <Button asChild>
              <Link to="/app/courses">Browse courses</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Recorded classes" subtitle="Loading your recordings…" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recorded classes"
        subtitle={`${recordings.length} lesson recording${recordings.length === 1 ? "" : "s"} available for your enrolled subjects`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or topic…"
            className="pl-9"
            aria-label="Search recordings"
          />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by subject">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {enrollments.map((e: any) => (
              <SelectItem key={e.subject_id} value={e.subject_id}>
                {e.subject?.name || e.subject_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={PlayCircle}
          title="No recordings found"
          body="Try changing your filters or search term."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r: Recording) => {
            const prog = progressMap[r.id];
            const pct = prog?.progress_percent ?? 0;
            const isCompleted = prog?.completed || pct >= 90;

            return (
              <article key={r.id} className="surface overflow-hidden flex flex-col">
                <button
                  type="button"
                  className="hero-gradient relative grid aspect-video w-full place-items-center text-white transition-opacity hover:opacity-90 cursor-pointer"
                  onClick={() => setActive(r)}
                  aria-label={`Watch ${r.title}`}
                >
                  <PlayCircle className="size-12 opacity-90 transition-transform group-hover:scale-110" />
                  {isCompleted ? (
                    <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[11px] font-semibold text-white">
                      <CheckCircle2 className="size-3" /> Completed
                    </span>
                  ) : null}
                </button>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 font-medium text-sm line-clamp-1">{r.title}</p>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {r.duration_min || 45} min
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      {r.subject?.name || "Subject"} {r.topic ? `· ${r.topic}` : ""}
                    </p>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                      <span>{pct > 0 ? `${pct}% watched` : "Not started"}</span>
                      {prog?.last_watched_at ? (
                        <span>Watched {relative(prog.last_watched_at)}</span>
                      ) : null}
                    </div>
                    <ProgressBar value={pct} />
                    <Button
                      size="sm"
                      className="w-full mt-3"
                      variant={pct > 0 ? "default" : "outline"}
                      onClick={() => setActive(r)}
                    >
                      <Video className="size-3.5 mr-1.5" />
                      {pct > 0 ? (pct >= 90 ? "Watch Again" : "Resume Lesson") : "Watch Lesson"}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Video Player Modal */}
      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
          {active ? (
            <div>
              {/* Media Player Frame */}
              <div className="bg-black aspect-video w-full flex items-center justify-center relative">
                {(() => {
                  const media = getEmbedUrl(active.video_url);

                  if (media.type === "youtube") {
                    return (
                      <iframe
                        src={media.src}
                        title={active.title}
                        className="size-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    );
                  }

                  if (media.type === "iframe") {
                    return (
                      <iframe
                        src={media.src}
                        title={active.title}
                        className="size-full border-0"
                        allowFullScreen
                      />
                    );
                  }

                  return (
                    <video
                      ref={videoRef}
                      controls
                      autoPlay
                      src={media.src}
                      onTimeUpdate={handleVideoTimeUpdate}
                      onEnded={() => {
                        handleUpdateProgress(
                          active.id,
                          100,
                          Math.round(videoRef.current?.duration || 0),
                        );
                        toast.success("Lesson marked as completed!");
                      }}
                      className="size-full object-contain"
                    >
                      <track kind="captions" />
                      Your browser does not support HTML5 video playback.
                    </video>
                  );
                })()}
              </div>

              {/* Lesson Details & Progress Control */}
              <div className="p-5 space-y-4">
                <DialogHeader className="p-0">
                  <DialogTitle className="text-lg">{active.title}</DialogTitle>
                </DialogHeader>

                <p className="text-xs text-muted-foreground">
                  {active.subject?.name} · {active.topic || "Topic"} · {active.duration_min || 45}{" "}
                  mins · Published {relative(active.created_at)}
                </p>

                {active.description ? (
                  <p className="text-sm text-muted-foreground">{active.description}</p>
                ) : null}

                {/* Progress bar and mark completed */}
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Watch Progress: {progressMap[active.id]?.progress_percent ?? 0}%</span>
                    <span>
                      {progressMap[active.id]?.completed
                        ? "Completed ✓"
                        : "Progress saves automatically"}
                    </span>
                  </div>
                  <ProgressBar value={progressMap[active.id]?.progress_percent ?? 0} />
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      handleUpdateProgress(active.id, 100, (active.duration_min || 45) * 60);
                      toast.success("Marked as completed");
                    }}
                  >
                    <CheckCircle2 className="size-3.5 mr-1" /> Mark as Done
                  </Button>
                  <Button size="sm" onClick={() => setActive(null)}>
                    Close Player
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
