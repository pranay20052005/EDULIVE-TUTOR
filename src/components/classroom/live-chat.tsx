import { Pin, PinOff, Send, Trash2, Users } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initials, timeOf } from "@/lib/format";
import { supabase } from "@/lib/db/client";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: "teacher" | "student" | "admin";
  text: string;
  timestamp: string;
  isPinned?: boolean;
}

interface LiveChatProps {
  classId: string;
  userId: string;
  userName: string;
  userRole: "teacher" | "student" | "admin";
}

export function LiveChat({ classId, userId, userName, userRole }: LiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isTeacher = userRole === "teacher" || userRole === "admin";

  useEffect(() => {
    if (!classId) return;

    const channel = supabase.channel(`classroom:${classId}:chat`);

    channel
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        setMessages((prev) => [...prev, payload]);
      })
      .on("broadcast", { event: "pin_message" }, ({ payload }) => {
        setPinnedMessage(payload);
        if (payload) {
          toast.info(`Pinned by Faculty: "${payload.text.substring(0, 40)}..."`);
        }
      })
      .on("broadcast", { event: "clear_chat" }, () => {
        setMessages([]);
        setPinnedMessage(null);
        toast.info("Chat history cleared by teacher");
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    const msg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: userId,
      senderName: userName,
      senderRole: userRole,
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, msg]);
    setDraft("");

    const channel = supabase.channel(`classroom:${classId}:chat`);
    channel.send({
      type: "broadcast",
      event: "new_message",
      payload: msg,
    });
  };

  const togglePin = (msg: ChatMessage) => {
    if (!isTeacher) return;
    const nextPin = pinnedMessage?.id === msg.id ? null : msg;
    setPinnedMessage(nextPin);

    const channel = supabase.channel(`classroom:${classId}:chat`);
    channel.send({
      type: "broadcast",
      event: "pin_message",
      payload: nextPin,
    });
  };

  const clearChat = () => {
    if (!isTeacher) return;
    setMessages([]);
    setPinnedMessage(null);

    const channel = supabase.channel(`classroom:${classId}:chat`);
    channel.send({
      type: "broadcast",
      event: "clear_chat",
      payload: {},
    });
    toast.success("Classroom chat cleared");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Pinned Message Banner */}
      {pinnedMessage ? (
        <div className="m-3 mb-0 flex items-start justify-between gap-2 rounded-xl bg-primary/10 border border-primary/20 p-2.5 text-xs text-primary">
          <div className="flex items-start gap-2 min-w-0">
            <Pin className="size-3.5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[11px]">{pinnedMessage.senderName} (Pinned)</p>
              <p className="text-slate-200 mt-0.5">{pinnedMessage.text}</p>
            </div>
          </div>
          {isTeacher ? (
            <Button
              size="icon"
              variant="ghost"
              className="size-5 hover:bg-primary/20 shrink-0"
              onClick={() => togglePin(pinnedMessage)}
              title="Unpin"
            >
              <PinOff className="size-3" />
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Messages Feed */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3 max-h-[380px]">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            <p>No messages yet.</p>
            <p className="mt-1 text-[11px]">Feel free to ask questions or share doubts!</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === userId;
            const isTeacherMsg = m.senderRole === "teacher" || m.senderRole === "admin";

            return (
              <div
                key={m.id}
                className={cn(
                  "group relative flex flex-col gap-1 text-sm",
                  isMe ? "items-end" : "items-start",
                )}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="font-medium text-slate-300">{isMe ? "You" : m.senderName}</span>
                  {isTeacherMsg ? (
                    <Badge variant="default" className="text-[9px] py-0 px-1 h-3.5 bg-primary">
                      Faculty
                    </Badge>
                  ) : null}
                  <span className="text-[10px] text-slate-500">{timeOf(m.timestamp)}</span>

                  {isTeacher ? (
                    <button
                      type="button"
                      onClick={() => togglePin(m)}
                      className="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
                      title={pinnedMessage?.id === m.id ? "Unpin message" : "Pin message"}
                    >
                      <Pin className="size-3" />
                    </button>
                  ) : null}
                </div>

                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 text-xs leading-relaxed max-w-[85%] break-words",
                    isMe
                      ? "bg-primary text-primary-foreground rounded-tr-sm shadow-sm"
                      : isTeacherMsg
                        ? "bg-primary/15 border border-primary/20 text-slate-100 rounded-tl-sm"
                        : "bg-white/10 text-slate-200 rounded-tl-sm",
                  )}
                >
                  {m.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Controls & Input */}
      <div className="border-t border-white/10 p-3 pt-2 bg-slate-950/50">
        {isTeacher && messages.length > 0 ? (
          <div className="flex justify-end pb-1.5">
            <button
              type="button"
              onClick={clearChat}
              className="text-[10px] text-destructive/80 hover:text-destructive flex items-center gap-1"
            >
              <Trash2 className="size-2.5" /> Clear chat
            </button>
          </div>
        ) : null}

        <form onSubmit={sendMessage} className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a doubt or message…"
            className="border-white/10 bg-white/5 text-slate-100 text-xs placeholder:text-slate-500 focus-visible:ring-primary h-9"
          />
          <Button type="submit" size="icon" className="size-9 shrink-0">
            <Send className="size-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
