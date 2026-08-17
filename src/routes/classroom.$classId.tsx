import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import {
  Hand,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PencilRuler,
  Send,
  Users,
  Video as VideoIcon,
  VideoOff,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

import { LiveBadge } from "@/components/ui-kit";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initials } from "@/lib/format";
import { scheduledClassService } from "@/lib/db";
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
  const { data: cls, isLoading } = useQuery({
    queryKey: ["scheduled-class", classId],
    queryFn: () => scheduledClassService.getById(classId),
    enabled: !!classId,
  });

  const [mic, setMic] = useState(false);
  const [cam, setCam] = useState(false);
  const [hand, setHand] = useState(false);
  const [draft, setDraft] = useState("");

  const teacherName = cls?.teacher?.user?.name || "EduLive Faculty";
  const topic = cls?.topic || cls?.title || "Live Lecture";
  const subjectName = cls?.subject?.name || "Subject";

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
        <p>Connecting to live classroom…</p>
      </div>
    );
  }

  if (!cls) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-100 gap-4">
        <p className="text-lg">Class session not found</p>
        <Button asChild variant="outline">
          <Link to="/app/live">Back to Live Classes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <LiveBadge />
            <p className="truncate text-sm font-semibold">{topic}</p>
          </div>
          <p className="truncate text-xs text-slate-400">
            {subjectName} · {teacherName}
          </p>
        </div>
        <Button asChild variant="destructive" size="sm">
          <Link to="/app/live">
            <LogOut className="size-4" /> Leave
          </Link>
        </Button>
      </header>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="relative grid aspect-video place-items-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
            <div className="text-center">
              <Avatar className="mx-auto size-20">
                <AvatarFallback className="bg-primary/20 text-2xl text-slate-100">
                  {initials(teacherName)}
                </AvatarFallback>
              </Avatar>
              <p className="mt-3 text-sm font-medium">{teacherName}</p>
              <p className="text-xs text-slate-400">Presenting · {topic}</p>
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

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {["Aarav", "Ishita", "Rohan", "Priya", "Sneha", "Karan"].map((name) => (
              <div
                key={name}
                className="grid aspect-video place-items-center rounded-xl border border-white/10 bg-slate-900 text-xs"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-white/10 text-[11px] text-slate-100">
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
              </div>
            ))}
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
              {[teacherName, "Aarav Sharma", "Ishita Verma", "Rohan Gupta"].map((n, i) => (
                <div key={n} className="flex items-center gap-3 rounded-xl bg-white/5 p-2 text-sm">
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-white/10 text-[11px] text-slate-100">
                      {initials(n)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate">{n}</span>
                  <span className="text-[11px] text-slate-400">{i === 0 ? "Host" : "Student"}</span>
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
