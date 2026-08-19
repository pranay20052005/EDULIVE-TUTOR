import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ExternalLink,
  Hand,
  Lock,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PencilRuler,
  Radio,
  Send,
  Users,
  Video as VideoIcon,
  VideoOff,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

import { LiveBadge } from "@/components/ui-kit";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dateTimeOf, initials, timeOf } from "@/lib/format";
import { scheduledClassService } from "@/lib/db";
import { useStudentEnrollments } from "@/lib/db/hooks";
import { useLiveClassRealtime } from "@/lib/db/realtime";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/classroom/$classId")({
  head: () => ({
    meta: [
      { title: "Live classroom — EduLive" },
      {
        name: "description",
        content:
          "Join the EduLive virtual classroom with live video, chat, whiteboard and hand raise.",
      },
      { property: "og:title", content: "Live classroom — EduLive" },
      { property: "og:description", content: "Live video class with chat and whiteboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Classroom,
});

function Classroom() {
  const { classId } = Route.useParams();
  const { session, student, teacher, isEnrolled } = useSession();

  // Listen to realtime status updates on scheduled_classes
  useLiveClassRealtime();

  const { data: cls, isLoading } = useQuery({
    queryKey: ["scheduled-class", classId],
    queryFn: () => scheduledClassService.getById(classId),
    enabled: !!classId,
  });

  const { data: studentEnrollments = [] } = useStudentEnrollments(student?.id);

  const [mic, setMic] = useState(false);
  const [cam, setCam] = useState(false);
  const [hand, setHand] = useState(false);
  const [draft, setDraft] = useState("");

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
      const hasEnrollment =
        studentEnrollments.some(
          (e: any) => e.subject_id === cls.subject_id && e.status === "active",
        ) ||
        isEnrolled(cls.subject_id) ||
        student?.subjectIds?.includes(cls.subject_id);
      return hasEnrollment;
    }
    return false;
  }, [cls, session, teacher, studentEnrollments, isEnrolled, student]);

  const [chat, setChat] = useState([
    {
      id: "m1",
      who: "Faculty",
      text: "Welcome everyone! Open your notes.",
      me: false,
    },
    { id: "m2", who: "Aarav Sharma", text: "Good evening sir / ma'am", me: false },
    { id: "m3", who: "Ishita Verma", text: "Ready for the session!", me: false },
  ]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center space-y-3">
          <Radio className="size-8 animate-pulse text-primary mx-auto" />
          <p className="text-sm text-slate-400">Connecting to live classroom…</p>
        </div>
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-100 gap-4 p-4 text-center">
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
          You are not enrolled in{" "}
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

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isLive ? (
              <LiveBadge />
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold uppercase">
                {cls.status}
              </span>
            )}
            <p className="truncate text-sm font-semibold">{topic}</p>
          </div>
          <p className="truncate text-xs text-slate-400">
            {subjectName} · {teacherName} · {dateTimeOf(cls.starts_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {cls.meeting_url ? (
            <Button asChild size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500">
              <a href={cls.meeting_url} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="size-3.5 mr-1" /> Open Live Stream
              </a>
            </Button>
          ) : null}
          <Button asChild variant="destructive" size="sm">
            <Link to={session?.role === "teacher" ? "/teacher/live" : "/app/live"}>
              <LogOut className="size-4" /> Leave
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="relative grid aspect-video place-items-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
            <div className="text-center p-6 space-y-3">
              <Avatar className="mx-auto size-20">
                <AvatarFallback className="bg-primary/20 text-2xl text-slate-100">
                  {initials(teacherName)}
                </AvatarFallback>
              </Avatar>
              <p className="text-base font-semibold">{teacherName}</p>
              <p className="text-xs text-slate-400">
                {subjectName} · {topic}
              </p>

              {isLive ? (
                <div className="pt-2">
                  <p className="text-xs text-emerald-400 font-medium">Session is actively LIVE</p>
                  {cls.meeting_url ? (
                    <Button
                      asChild
                      size="sm"
                      className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <a href={cls.meeting_url} target="_blank" rel="noreferrer noopener">
                        <VideoIcon className="size-4 mr-1.5" /> Join Live Video Stream
                      </a>
                    </Button>
                  ) : (
                    <p className="text-xs text-slate-400 mt-2">Meeting URL connecting…</p>
                  )}
                </div>
              ) : cls.status === "completed" ? (
                <p className="text-xs text-slate-400 pt-2">This class session has ended.</p>
              ) : cls.status === "cancelled" ? (
                <p className="text-xs text-destructive pt-2">
                  This session was cancelled by faculty.
                </p>
              ) : (
                <div className="text-xs text-slate-400 pt-2 space-y-1">
                  <p>
                    Scheduled: {dateTimeOf(cls.starts_at)} – {timeOf(cls.ends_at)}
                  </p>
                  <p className="text-slate-500">
                    The session will go live when the instructor starts the class.
                  </p>
                </div>
              )}
            </div>
            <span className="absolute bottom-3 left-3 rounded-lg bg-black/50 px-2 py-1 text-xs">
              Speaker view
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-900 p-3">
            <ControlBtn
              active={mic}
              onClick={() => setMic(!mic)}
              on={Mic}
              off={MicOff}
              label="Mic"
            />
            <ControlBtn
              active={cam}
              onClick={() => setCam(!cam)}
              on={VideoIcon}
              off={VideoOff}
              label="Camera"
            />
            <Button
              variant={hand ? "default" : "secondary"}
              size="sm"
              onClick={() => {
                setHand(!hand);
                if (!hand) toast.success("Hand raised — teacher notified");
              }}
            >
              <Hand className="size-4" /> Raise hand
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => toast("Only the teacher can share")}
            >
              <MonitorUp className="size-4" /> Share
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => toast("Whiteboard opened by teacher")}
            >
              <PencilRuler className="size-4" /> Whiteboard
            </Button>
          </div>
        </div>

        <aside className="flex min-h-[420px] flex-col rounded-2xl border border-white/10 bg-slate-900">
          <Tabs defaultValue="chat" className="flex flex-1 flex-col">
            <TabsList className="m-3 bg-white/5">
              <TabsTrigger value="chat">
                <MessageSquare className="size-4" /> Chat
              </TabsTrigger>
              <TabsTrigger value="people">
                <Users className="size-4" /> People
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex flex-1 flex-col px-3 pb-3">
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px]">
                {chat.map((m) => (
                  <div key={m.id} className={cn("text-sm", m.me && "text-right")}>
                    <p className="text-[11px] text-slate-400">{m.who}</p>
                    <p
                      className={cn(
                        "mt-1 inline-block rounded-xl px-3 py-2",
                        m.me ? "bg-primary text-primary-foreground" : "bg-white/5",
                      )}
                    >
                      {m.text}
                    </p>
                  </div>
                ))}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!draft.trim()) return;
                  setChat((c) => [
                    ...c,
                    { id: `m${c.length + 1}`, who: "You", text: draft, me: true },
                  ]);
                  setDraft("");
                }}
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask a doubt…"
                  className="border-white/10 bg-white/5 text-slate-100 placeholder:text-slate-500"
                />
                <Button type="submit" size="icon">
                  <Send className="size-4" />
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="people" className="flex-1 space-y-2 px-3 pb-3">
              {[teacherName, session?.name || "Student"].map((n, i) => (
                <div key={n} className="flex items-center gap-3 rounded-xl bg-white/5 p-2 text-sm">
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-white/10 text-[11px] text-slate-100">
                      {initials(n)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate">{n}</span>
                  <span className="text-[11px] text-slate-400">{i === 0 ? "Host" : "You"}</span>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}

function ControlBtn({
  active,
  onClick,
  on: On,
  off: Off,
  label,
}: {
  active: boolean;
  onClick: () => void;
  on: typeof Mic;
  off: typeof MicOff;
  label: string;
}) {
  return (
    <Button variant={active ? "default" : "secondary"} size="sm" onClick={onClick}>
      {active ? <On className="size-4" /> : <Off className="size-4" />} {label}
    </Button>
  );
}
