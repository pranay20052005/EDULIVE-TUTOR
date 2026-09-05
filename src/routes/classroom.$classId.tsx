import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  Hand,
  Layers,
  Lock,
  LogOut,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  PencilRuler,
  Radio,
  Share2,
  ShieldAlert,
  Users,
  Video as VideoIcon,
  VideoOff,
  Volume2,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { LiveBadge } from "@/components/ui-kit";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollaborativeWhiteboard } from "@/components/classroom/whiteboard";
import { LiveChat } from "@/components/classroom/live-chat";
import { dateTimeOf, initials, timeOf } from "@/lib/format";
import { scheduledClassService, attendanceService } from "@/lib/db";
import { useStudentEnrollments } from "@/lib/db/hooks";
import { useLiveClassRealtime } from "@/lib/db/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/db/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/classroom/$classId")({
  head: ({ params }) => {
    const title = "Live Interactive Classroom — EduLive";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: `Join live virtual class ${params.classId} on EduLive with video, audio, collaborative whiteboard, and real-time chat.`,
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: "Live video class with interactive whiteboard and chat on EduLive.",
        },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: ClassroomPage,
});

interface ParticipantState {
  userId: string;
  name: string;
  role: "teacher" | "student" | "admin";
  mic: boolean;
  cam: boolean;
  hand: boolean;
  screenShare: boolean;
  joinedAt: string;
}

type MainStageView = "video" | "whiteboard" | "screen";

function ClassroomPage() {
  const { classId } = Route.useParams();
  const { session, student, teacher, isEnrolled } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Listen to scheduled_classes status changes
  useLiveClassRealtime();

  const { data: cls, isLoading } = useQuery({
    queryKey: ["scheduled-class", classId],
    queryFn: () => scheduledClassService.getById(classId),
    enabled: !!classId,
  });

  const { data: studentEnrollments = [] } = useStudentEnrollments(student?.id);

  // Local media stream refs and state
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const classroomContainerRef = useRef<HTMLDivElement | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [hand, setHand] = useState(false);
  const [stageView, setStageView] = useState<MainStageView>("video");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Record<string, ParticipantState>>({});

  const isTeacher = session?.role === "teacher" || session?.role === "admin";
  const teacherName = cls?.teacher?.user?.name || "EduLive Faculty";
  const topic = cls?.topic || cls?.title || "Live Lecture";
  const subjectName = cls?.subject?.name || "Subject";
  const isLive = cls?.status === "live";

  // Authorization Check
  const isAuthorized = useMemo(() => {
    if (!cls || !session) return false;
    if (session.role === "admin") return true;
    if (session.role === "teacher") {
      return cls.teacher_id === teacher?.id || cls.teacher?.user_id === session.id;
    }
    if (session.role === "student") {
      return (
        studentEnrollments.some(
          (e: any) => e.subject_id === cls.subject_id && e.status === "active",
        ) ||
        isEnrolled(cls.subject_id) ||
        student?.subjectIds?.includes(cls.subject_id)
      );
    }
    return false;
  }, [cls, session, teacher, studentEnrollments, isEnrolled, student]);

  // Request real Camera & Microphone access on classroom join
  useEffect(() => {
    if (!isAuthorized) return;

    let stream: MediaStream | null = null;

    async function initMedia() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true,
          });
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          setMediaError(null);
        }
      } catch (err: any) {
        console.warn("Camera/Mic permission warning:", err);
        setMediaError(
          "Camera/Mic access was denied or not available. You can still participate in audio/chat mode.",
        );
        setCam(false);
        setMic(false);
      }
    }

    initMedia();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isAuthorized]);

  // Toggle Camera
  const toggleCam = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      const nextState = !cam;
      videoTracks.forEach((t) => {
        t.enabled = nextState;
      });
      setCam(nextState);
      toast.info(nextState ? "Camera turned on" : "Camera turned off");
      broadcastPresence({ cam: nextState });
    } else {
      toast.error("Camera device not detected or permission denied");
    }
  };

  // Toggle Microphone
  const toggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      const nextState = !mic;
      audioTracks.forEach((t) => {
        t.enabled = nextState;
      });
      setMic(nextState);
      toast.info(nextState ? "Microphone unmuted" : "Microphone muted");
      broadcastPresence({ mic: nextState });
    } else {
      toast.error("Microphone device not detected or permission denied");
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (!isTeacher) {
      toast.error("Screen sharing is reserved for the faculty instructor");
      return;
    }

    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setStageView("video");
      broadcastPresence({ screenShare: false });
      toast.info("Screen sharing ended");
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        setScreenStream(stream);
        setStageView("screen");
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }

        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          setStageView("video");
          broadcastPresence({ screenShare: false });
        };

        broadcastPresence({ screenShare: true });
        toast.success("Screen sharing started");
      } catch (err) {
        console.warn("Screen share cancelled:", err);
      }
    }
  };

  // Toggle Raise Hand
  const toggleRaiseHand = () => {
    const nextHand = !hand;
    setHand(nextHand);
    broadcastPresence({ hand: nextHand });
    if (nextHand) {
      toast.success("Hand raised — teacher notified");
    }
  };

  // Supabase Realtime Classroom Presence Synchronization
  useEffect(() => {
    if (!classId || !session?.id) return;

    const channel = supabase.channel(`classroom:${classId}:presence`, {
      config: { presence: { key: session.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const nextParticipants: Record<string, ParticipantState> = {};
        Object.keys(state).forEach((key) => {
          const list = state[key] as any[];
          if (list && list[0]) {
            nextParticipants[key] = list[0];
          }
        });
        setParticipants(nextParticipants);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        newPresences.forEach((p: any) => {
          if (p.userId !== session.id) {
            toast.info(`${p.name} (${p.role}) joined the class`);
          }
        });
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        leftPresences.forEach((p: any) => {
          if (p.userId !== session.id) {
            toast.info(`${p.name} left the class`);
          }
        });
      })
      .on("broadcast", { event: "hand_raise" }, ({ payload }) => {
        if (isTeacher) {
          toast.info(`✋ ${payload.name} raised their hand!`, { duration: 6000 });
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId: session.id,
            name: session.name || "Participant",
            role: session.role || "student",
            mic,
            cam,
            hand: false,
            screenShare: false,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, session]);

  const broadcastPresence = (updates: Partial<ParticipantState>) => {
    const channel = supabase.channel(`classroom:${classId}:presence`);
    channel.track({
      userId: session?.id,
      name: session?.name || "Participant",
      role: session?.role || "student",
      mic,
      cam,
      hand,
      screenShare: !!screenStream,
      ...updates,
    });

    if (updates.hand) {
      channel.send({
        type: "broadcast",
        event: "hand_raise",
        payload: { name: session?.name, userId: session?.id },
      });
    }
  };

  const [popupBlocked, setPopupBlocked] = useState(false);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      classroomContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Google Meet URL validation
  const hasValidMeetingUrl = useMemo(() => {
    if (!cls?.meeting_url) return false;
    const trimmed = cls.meeting_url.trim();
    return (
      trimmed.startsWith("https://meet.google.com/") ||
      trimmed.startsWith("http://meet.google.com/") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("http://")
    );
  }, [cls?.meeting_url]);

  // Google Meet Join Handler with popup-blocker handling & attendance tracking
  const handleJoinGoogleMeet = async () => {
    if (!cls?.meeting_url) {
      toast.error("Google Meet link is not available for this class yet.");
      return;
    }

    const meetUrl = cls.meeting_url.trim();
    if (!meetUrl.startsWith("http://") && !meetUrl.startsWith("https://")) {
      toast.error("Invalid Google Meet link provided for this class.");
      return;
    }

    // Automatically record attendance for student when joining
    if (session?.role === "student" && student?.id && cls.subject_id && cls.teacher_id) {
      try {
        const todayDate = new Date().toISOString().slice(0, 10);
        await attendanceService.markAttendance({
          student_id: student.id,
          subject_id: cls.subject_id,
          teacher_id: cls.teacher_id,
          attendance_date: todayDate,
          status: "present",
          session: cls.topic || cls.title || "Live Class",
          notes: `Attended Google Meet live class: ${cls.title}`,
        });
      } catch (attErr) {
        console.warn("Attendance auto-mark note:", attErr);
      }
    }

    // Safely open Google Meet in a new browser tab
    try {
      const newWindow = window.open(meetUrl, "_blank", "noopener,noreferrer");
      if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
        setPopupBlocked(true);
        toast.error("Unable to open Google Meet. Please allow pop-ups for EduLive and try again.", {
          duration: 7000,
        });
      } else {
        setPopupBlocked(false);
        toast.success("Opening Google Meet in a new tab…");
      }
    } catch (err) {
      setPopupBlocked(true);
      toast.error("Unable to open Google Meet. Please allow pop-ups for EduLive and try again.");
    }
  };

  // Teacher End Class Action
  const handleEndClass = async () => {
    if (!isTeacher) return;
    try {
      await scheduledClassService.updateStatus(classId, "completed");
      await queryClient.invalidateQueries({ queryKey: ["scheduled-class", classId] });
      await queryClient.invalidateQueries({ queryKey: ["scheduled-classes"] });
      toast.success("Class session marked as completed");
      navigate({ to: "/teacher/live" });
    } catch (err: any) {
      toast.error(err.message || "Failed to end class");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center space-y-3">
          <Radio className="size-8 animate-pulse text-primary mx-auto" />
          <p className="text-sm text-slate-400">Connecting to live virtual classroom…</p>
        </div>
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-100 gap-4 p-4 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <p className="text-lg font-medium">Class session not found</p>
        <p className="text-sm text-slate-400">
          This scheduled class may have been removed or does not exist.
        </p>
        <Button asChild variant="outline">
          <Link to="/app/live">Back to Live Classes</Link>
        </Button>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-100 gap-4 p-6 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive mx-auto">
          <Lock className="size-7" />
        </div>
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="max-w-md text-sm text-slate-400">
          You are not actively enrolled in{" "}
          <span className="font-semibold text-slate-200">{subjectName}</span>. Please enroll in this
          course to join its live sessions.
        </p>
        <div className="flex gap-3 mt-2">
          <Button asChild variant="outline">
            <Link to="/app/live">My Live Classes</Link>
          </Button>
          <Button asChild>
            <Link to="/app/courses">Explore Courses</Link>
          </Button>
        </div>
      </div>
    );
  }

  const participantCount = Object.keys(participants).length || 1;

  return (
    <div
      ref={classroomContainerRef}
      className="flex min-h-screen flex-col bg-slate-950 text-slate-100 select-none overflow-hidden"
    >
      {/* Top Header Bar */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 bg-slate-950/90 px-4 py-2.5 backdrop-blur-md">
        <div className="min-w-0 flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isLive ? (
              <LiveBadge />
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold uppercase text-slate-300">
                {cls.status}
              </span>
            )}
            <p className="truncate text-sm font-semibold">{topic}</p>
          </div>
          <span className="hidden sm:inline-block text-xs text-slate-400">
            {subjectName} · {teacherName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Stage View Selector */}
          <div className="flex items-center rounded-xl bg-white/5 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setStageView("video")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1.5",
                stageView === "video"
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              <VideoIcon className="size-3.5" /> Video
            </button>
            <button
              type="button"
              onClick={() => setStageView("whiteboard")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1.5",
                stageView === "whiteboard"
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              <PencilRuler className="size-3.5" /> Whiteboard
            </button>
            {screenStream ? (
              <button
                type="button"
                onClick={() => setStageView("screen")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1.5",
                  stageView === "screen"
                    ? "bg-primary text-primary-foreground"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                <MonitorUp className="size-3.5" /> Screen
              </button>
            ) : null}
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="size-8 text-slate-400 hover:text-white"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>

          {cls.status === "completed" ? (
            <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs text-slate-400 font-medium">
              Class Ended
            </span>
          ) : cls.status === "cancelled" ? (
            <span className="rounded-lg bg-destructive/20 px-2.5 py-1 text-xs text-destructive font-medium">
              Class Cancelled
            </span>
          ) : (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 shadow-md"
              onClick={handleJoinGoogleMeet}
              disabled={!hasValidMeetingUrl}
            >
              <ExternalLink className="size-3.5 mr-1.5" /> Join Google Meet
            </Button>
          )}

          {isTeacher ? (
            <Button
              size="sm"
              variant="destructive"
              className="text-xs h-8"
              onClick={handleEndClass}
            >
              End Class
            </Button>
          ) : (
            <Button asChild variant="destructive" size="sm" className="text-xs h-8">
              <Link to="/app/live">
                <LogOut className="size-3.5 mr-1" /> Leave
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* Main Classroom Body */}
      <div className="grid flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_340px] overflow-hidden">
        {/* Left: Main Stage (Video, Whiteboard, or Screen Share) */}
        <div className="flex flex-col gap-3 min-w-0 h-full">
          <div className="relative flex-1 rounded-2xl border border-white/10 bg-slate-900 overflow-hidden shadow-2xl">
            {stageView === "whiteboard" ? (
              <CollaborativeWhiteboard classId={classId} isTeacher={isTeacher} />
            ) : stageView === "screen" && screenStream ? (
              <div className="relative w-full h-full bg-black flex items-center justify-center">
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
                <span className="absolute top-3 left-3 rounded-lg bg-black/60 backdrop-blur-md px-2.5 py-1 text-xs text-white flex items-center gap-1.5">
                  <MonitorUp className="size-3.5 text-primary" /> Faculty Screen Share
                </span>
              </div>
            ) : (
              /* Video Stage & Google Meet Launch Card */
              <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-4">
                <div className="text-center space-y-4 max-w-md w-full p-6 rounded-2xl bg-slate-950/80 border border-white/10 backdrop-blur-md shadow-2xl">
                  <Avatar className="mx-auto size-20 ring-4 ring-primary/20">
                    <AvatarFallback className="bg-primary/20 text-2xl text-slate-100 font-semibold">
                      {initials(teacherName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{topic}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {subjectName} · {teacherName}
                    </p>
                  </div>

                  {cls.status === "completed" ? (
                    <div className="rounded-xl bg-white/5 p-3 text-xs text-slate-300">
                      <p className="font-medium">This live class has concluded.</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Class recordings and study notes will be published in the subject module.
                      </p>
                    </div>
                  ) : cls.status === "cancelled" ? (
                    <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                      <p className="font-medium">This live class was cancelled.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {isLive ? (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-400 text-xs font-semibold">
                          <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                          CLASS IS LIVE NOW
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-slate-300 text-xs font-medium">
                          Starts at {timeOf(cls.starts_at)} ({dateTimeOf(cls.starts_at)})
                        </div>
                      )}

                      {hasValidMeetingUrl ? (
                        <div className="space-y-2 pt-1">
                          <Button
                            size="lg"
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg text-sm h-11"
                            onClick={handleJoinGoogleMeet}
                          >
                            <ExternalLink className="size-4 mr-2" /> Join Google Meet
                          </Button>
                          <p className="text-[11px] text-slate-400">
                            Google Meet opens in a new tab. Attendance is recorded automatically.
                          </p>

                          {popupBlocked ? (
                            <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs text-left text-destructive mt-2">
                              <p className="font-semibold">Pop-up was blocked by your browser.</p>
                              <a
                                href={cls.meeting_url!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline font-medium mt-1 inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                              >
                                <ExternalLink className="size-3" /> Click here to open Google Meet
                                directly
                              </a>
                            </div>
                          ) : null}
                        </div>
                      ) : !cls.meeting_url ? (
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300">
                          <p className="font-medium">
                            Google Meet link is not available for this class yet.
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            The instructor has not added the meeting URL. Please check back shortly.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                          <p className="font-medium">
                            Invalid Google Meet link provided for this class.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Speaker View Tag & Audio Indicator */}
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <span className="rounded-lg bg-black/60 backdrop-blur-md px-2.5 py-1 text-xs text-slate-200">
                    {session?.name || "Participant"} ({session?.role || "Student"})
                  </span>
                  {mic ? (
                    <span className="grid size-6 place-items-center rounded-md bg-emerald-500/20 text-emerald-400">
                      <Volume2 className="size-3.5 animate-pulse" />
                    </span>
                  ) : (
                    <span className="grid size-6 place-items-center rounded-md bg-destructive/20 text-destructive">
                      <MicOff className="size-3.5" />
                    </span>
                  )}
                </div>

                {/* Hand Raised Badge on Stage */}
                {hand ? (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-lg animate-bounce">
                    <Hand className="size-3.5" /> Hand Raised
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Classroom Controls Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-900 p-2.5">
            <Button
              variant={mic ? "secondary" : "destructive"}
              size="sm"
              onClick={toggleMic}
              className="h-9 px-3 text-xs"
            >
              {mic ? <Mic className="size-4 mr-1.5" /> : <MicOff className="size-4 mr-1.5" />}
              {mic ? "Mute" : "Unmute"}
            </Button>

            <Button
              variant={cam ? "secondary" : "destructive"}
              size="sm"
              onClick={toggleCam}
              className="h-9 px-3 text-xs"
            >
              {cam ? (
                <VideoIcon className="size-4 mr-1.5" />
              ) : (
                <VideoOff className="size-4 mr-1.5" />
              )}
              {cam ? "Stop Cam" : "Start Cam"}
            </Button>

            <Button
              variant={hand ? "default" : "secondary"}
              size="sm"
              onClick={toggleRaiseHand}
              className="h-9 px-3 text-xs"
            >
              <Hand className="size-4 mr-1.5" />
              {hand ? "Lower Hand" : "Raise Hand"}
            </Button>

            {isTeacher ? (
              <Button
                variant={screenStream ? "default" : "secondary"}
                size="sm"
                onClick={toggleScreenShare}
                className="h-9 px-3 text-xs"
              >
                <MonitorUp className="size-4 mr-1.5" />
                {screenStream ? "Stop Sharing" : "Share Screen"}
              </Button>
            ) : null}

            <Button
              variant={stageView === "whiteboard" ? "default" : "secondary"}
              size="sm"
              onClick={() => setStageView(stageView === "whiteboard" ? "video" : "whiteboard")}
              className="h-9 px-3 text-xs"
            >
              <PencilRuler className="size-4 mr-1.5" /> Whiteboard
            </Button>
          </div>
        </div>

        {/* Right: Sidebar Tabs (Live Chat & Active Participants) */}
        <aside className="flex flex-col rounded-2xl border border-white/10 bg-slate-900 overflow-hidden h-full">
          <Tabs defaultValue="chat" className="flex flex-1 flex-col h-full">
            <TabsList className="m-3 mb-0 bg-white/5 border border-white/10">
              <TabsTrigger value="chat" className="flex-1 text-xs">
                <MessageSquare className="size-3.5 mr-1.5" /> Live Chat
              </TabsTrigger>
              <TabsTrigger value="people" className="flex-1 text-xs">
                <Users className="size-3.5 mr-1.5" /> People ({participantCount})
              </TabsTrigger>
            </TabsList>

            {/* Live Chat Tab */}
            <TabsContent value="chat" className="flex-1 p-0 mt-0 h-full overflow-hidden">
              <LiveChat
                classId={classId}
                userId={session?.id || "guest"}
                userName={session?.name || "Student"}
                userRole={(session?.role as any) || "student"}
              />
            </TabsContent>

            {/* Participants Tab */}
            <TabsContent value="people" className="flex-1 space-y-2 p-3 overflow-y-auto">
              <p className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                In Classroom ({participantCount})
              </p>

              {Object.keys(participants).length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2 text-sm">
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-primary/20 text-[11px] text-slate-100">
                      {initials(session?.name || "You")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-xs">{session?.name || "You"}</span>
                  <Badge variant="outline" className="text-[10px]">
                    You ({session?.role})
                  </Badge>
                </div>
              ) : (
                Object.values(participants).map((p) => (
                  <div
                    key={p.userId}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white/5 p-2.5 text-xs transition-colors hover:bg-white/10"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="size-7">
                        <AvatarFallback className="bg-white/10 text-[11px] text-slate-100">
                          {initials(p.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-200">
                          {p.name} {p.userId === session?.id ? "(You)" : ""}
                        </p>
                        <span className="capitalize text-[10px] text-slate-400">{p.role}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.hand ? (
                        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary flex items-center gap-1">
                          <Hand className="size-3" /> Raised
                        </span>
                      ) : null}
                      {p.mic ? (
                        <Mic className="size-3.5 text-emerald-400" />
                      ) : (
                        <MicOff className="size-3.5 text-slate-500" />
                      )}
                      {p.cam ? (
                        <VideoIcon className="size-3.5 text-emerald-400" />
                      ) : (
                        <VideoOff className="size-3.5 text-slate-500" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}
